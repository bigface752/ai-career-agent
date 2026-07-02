/**
 * 面试辅导 — 回答处理器
 *
 * 职责：用户回答 → AI 评估 → 追问/转下一题/重新提问
 * 模式：generateObject + Zod（复用 generator.ts 的模式）
 *
 * 对齐 specs/api-endpoints.md POST /api/interview/answer
 * 对齐 SPEC.md §3.15 面试辅导：模拟面试
 */

import { generateObject } from "ai";
import { models } from "@/lib/ai";
import { db } from "@/lib/db";
import {
  AiAnswerEvaluationSchema,
  type AiAnswerEvaluation,
  type AnswerInput,
  type AnswerResponse,
  type InterviewMessage,
  type InterviewQuestion,
} from "./schema";
import {
  ANSWER_EVALUATION_SYSTEM_PROMPT,
  buildAnswerEvaluationPrompt,
} from "./prompts";

// ============================================================
// 常量
// ============================================================

const MAX_FOLLOW_UP = 3;

// ============================================================
// 核心处理函数
// ============================================================

export interface ProcessAnswerResult {
  response: AnswerResponse;
  tokenUsage: number;
}

/**
 * 处理用户面试回答
 *
 * @param input 用户回答输入
 * @param userId 用户 ID（用于权限校验）
 * @returns AI 回复 + token 使用量
 */
export async function processAnswer(
  input: AnswerInput,
  userId: string
): Promise<ProcessAnswerResult> {
  // 1. 加载 session
  const session = await db.interviewSession.findFirst({
    where: {
      id: input.interview_id,
      userId,
    },
  });

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  // 2. 状态校验：只允许 in_progress 状态提交回答
  if (session.status !== "in_progress") {
    const errorMap: Record<string, string> = {
      not_started: "SESSION_NOT_STARTED",
      paused: "SESSION_PAUSED",
      completed: "SESSION_COMPLETED",
      expired: "SESSION_EXPIRED",
      abandoned: "SESSION_ABANDONED",
    };
    throw new Error(errorMap[session.status] || "INVALID_STATUS");
  }

  // 3. 解析题目列表
  let questions: InterviewQuestion[];
  try {
    questions = JSON.parse(session.questions) as InterviewQuestion[];
  } catch {
    throw new Error("INVALID_QUESTIONS_DATA");
  }

  // 4. 找到当前题目
  const currentQuestion = questions.find((q) => q.id === input.question_id);
  if (!currentQuestion) {
    throw new Error("QUESTION_NOT_FOUND");
  }

  // 5. 判断是否最后一题
  const isLastQuestion = session.currentQuestionIndex >= questions.length - 1;

  // 6. 解析对话历史
  let conversationHistory: InterviewMessage[] = [];
  try {
    if (session.conversationHistory) {
      conversationHistory = JSON.parse(session.conversationHistory) as InterviewMessage[];
    }
  } catch {
    // 对话历史损坏，从空开始
    conversationHistory = [];
  }

  // 7. 记录用户回答到对话历史
  const now = new Date().toISOString();
  conversationHistory.push({
    type: "answer",
    questionId: input.question_id,
    content: input.answer,
    timestamp: now,
  });

  // 8. 构建画像摘要（可选，失败不阻塞）
  let portraitSummary: string | undefined;
  try {
    const portrait = await db.portrait.findUnique({ where: { userId } });
    if (portrait) {
      const data = JSON.parse(portrait.portraitJson) as Record<string, unknown>;
      const basic = (data.basic_info || {}) as Record<string, unknown>;
      portraitSummary = [
        basic.current_role ? `当前职位：${basic.current_role}` : "",
        basic.industry ? `行业：${basic.industry}` : "",
        basic.years_of_experience ? `工作年限：${basic.years_of_experience}年` : "",
      ]
        .filter(Boolean)
        .join("；");
    }
  } catch {
    // 画像加载失败不阻塞
  }

  // 9. AI 评估回答
  const evaluation = await evaluateAnswer(
    currentQuestion,
    input.answer,
    session.followUpCount,
    MAX_FOLLOW_UP,
    portraitSummary
  );

  // 10. 服务端决策：追问/转题/重新提问/完成
  const decision = makeDecision(
    evaluation,
    session.followUpCount,
    MAX_FOLLOW_UP,
    isLastQuestion
  );

  // 11. 更新对话历史和 session 状态
  let newFollowUpCount = session.followUpCount;
  let newCurrentQuestionIndex = session.currentQuestionIndex;
  let newStatus: string = session.status;

  // 将 AI 回复加入对话历史
  conversationHistory.push({
    type:
      decision.type === "追问"
        ? "follow_up"
        : decision.type === "重新提问"
          ? "re_question"
          : "feedback",
    questionId: input.question_id,
    content: decision.content,
    timestamp: new Date().toISOString(),
  });

  // 解析已回答题目列表
  let answeredQuestions: Record<string, unknown>[] = [];
  try {
    if (session.answeredQuestions) {
      answeredQuestions = JSON.parse(session.answeredQuestions) as Record<string, unknown>[];
    }
  } catch {
    answeredQuestions = [];
  }

  if (decision.type === "追问") {
    // 追问：计数+1
    newFollowUpCount = session.followUpCount + 1;
    newStatus = "in_progress";
  } else if (decision.type === "重新提问") {
    // 重新提问：不计数，保持当前题目
    newFollowUpCount = session.followUpCount;
    newStatus = "in_progress";
  } else if (decision.type === "完成") {
    // 最后一题答完 → completed
    answeredQuestions.push({
      questionId: input.question_id,
      answer: input.answer,
      followUpCount: session.followUpCount,
      feedback: decision.feedback,
    });
    newStatus = "completed";
  } else if (decision.type === "转下一题") {
    // 记录当前题目回答
    answeredQuestions.push({
      questionId: input.question_id,
      answer: input.answer,
      followUpCount: session.followUpCount,
      feedback: decision.feedback,
    });

    // 转下一题
    newCurrentQuestionIndex = session.currentQuestionIndex + 1;
    newFollowUpCount = 0; // 重置追问计数

    // 检查是否还有下一题（防御性检查，makeDecision 应已处理）
    const nextQuestion = questions[newCurrentQuestionIndex];
    if (nextQuestion) {
      // 有下一题：在对话历史中记录
      conversationHistory.push({
        type: "question",
        questionId: nextQuestion.id,
        content: nextQuestion.question,
        timestamp: new Date().toISOString(),
      });
      newStatus = "in_progress";
    } else {
      // 无下一题：标记完成（防御性兜底）
      newStatus = "completed";
    }
  }

  // 12. 单次 DB update（合并 answeredQuestions + 状态更新，避免两次写入不一致）
  await db.interviewSession.update({
    where: { id: session.id },
    data: {
      status: newStatus,
      currentQuestionIndex: newCurrentQuestionIndex,
      followUpCount: newFollowUpCount,
      answeredQuestions: JSON.stringify(answeredQuestions),
      conversationHistory: JSON.stringify(conversationHistory),
      lastActivityAt: new Date(),
    },
  });

  // 13. 构建响应
  const response: AnswerResponse = {
    question_id: input.question_id,
    ai_response: {
      type: decision.type,
      content: decision.content,
      reason: decision.reason,
    },
    follow_up_count: newFollowUpCount,
    max_follow_up: MAX_FOLLOW_UP,
    session_status: newStatus as "in_progress" | "completed",
  };

  return { response, tokenUsage: evaluation.tokenUsage };
}

// ============================================================
// AI 评估
// ============================================================

interface EvaluationResult extends AiAnswerEvaluation {
  tokenUsage: number;
}

async function evaluateAnswer(
  question: InterviewQuestion,
  userAnswer: string,
  followUpCount: number,
  maxFollowUp: number,
  portraitSummary?: string
): Promise<EvaluationResult> {
  const prompt = buildAnswerEvaluationPrompt(
    question,
    userAnswer,
    followUpCount,
    maxFollowUp,
    portraitSummary
  );

  const result = await generateObject({
    model: models.mimo,
    schema: AiAnswerEvaluationSchema,
    system: ANSWER_EVALUATION_SYSTEM_PROMPT,
    prompt,
    temperature: 0.3,
    abortSignal: AbortSignal.timeout(30_000),
  });

  const tokenUsage =
    (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0);

  return {
    ...(result.object as AiAnswerEvaluation),
    tokenUsage,
  };
}

// ============================================================
// 服务端决策逻辑
// ============================================================

interface Decision {
  type: "追问" | "转下一题" | "完成" | "重新提问";
  content: string;
  reason?: string;
  feedback?: string;
}

/**
 * 服务端决策：基于 AI 评估 + 状态约束决定下一步动作
 *
 * @param evaluation AI 评估结果
 * @param currentFollowUpCount 当前题已追问次数
 * @param maxFollowUp 最大追问次数
 * @param isLastQuestion 是否最后一题
 */
function makeDecision(
  evaluation: AiAnswerEvaluation,
  currentFollowUpCount: number,
  maxFollowUp: number,
  isLastQuestion: boolean
): Decision {
  // 回答质量差 → 重新提问（不计追问次数）
  if (
    evaluation.answerQuality === "too_short" ||
    evaluation.answerQuality === "off_topic"
  ) {
    return {
      type: "重新提问",
      content: evaluation.reQuestion || "请更详细地回答这个问题。",
      reason:
        evaluation.answerQuality === "too_short"
          ? "回答过于简短"
          : "回答偏离主题",
    };
  }

  // 追问次数已满 → 必须转下一题（或完成）
  if (currentFollowUpCount >= maxFollowUp) {
    if (isLastQuestion) {
      return {
        type: "完成",
        content: evaluation.feedback || "好的，面试到此结束。",
        reason: "最后一题，追问次数已达上限",
        feedback: evaluation.feedback,
      };
    }
    return {
      type: "转下一题",
      content: evaluation.feedback || "好的，我们来看下一题。",
      reason: "追问次数已达上限",
      feedback: evaluation.feedback,
    };
  }

  // AI 建议追问 → 追问
  if (evaluation.shouldFollowUp && evaluation.followUpQuestion) {
    return {
      type: "追问",
      content: evaluation.followUpQuestion,
      reason: "回答有价值，需要深挖",
    };
  }

  // 默认转下一题（或完成）
  if (isLastQuestion) {
    return {
      type: "完成",
      content: evaluation.feedback || "好的，面试到此结束。",
      reason: "最后一题已回答充分",
      feedback: evaluation.feedback,
    };
  }

  return {
    type: "转下一题",
    content: evaluation.feedback || "好的，我们来看下一题。",
    reason: "回答已充分",
    feedback: evaluation.feedback,
  };
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 构建画像摘要
 */
export function buildPortraitSummary(
  portraitData: Record<string, unknown>
): string {
  const basic = (portraitData.basic_info || {}) as Record<string, unknown>;
  const parts: string[] = [];

  if (basic.current_role) parts.push(`当前职位：${basic.current_role}`);
  if (basic.industry) parts.push(`行业：${basic.industry}`);
  if (basic.years_of_experience)
    parts.push(`工作年限：${basic.years_of_experience}年`);

  return parts.join("；");
}
