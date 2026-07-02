/**
 * 面试辅导 — 面试评估器
 *
 * 职责：面试结束后 → BARS 评分 + 逐题评估 + 答案优化
 * 模式：generateObject + Zod（复用 generator.ts 的模式）
 *
 * 对齐 specs/api-endpoints.md POST /api/interview/evaluate
 * 对齐 specs/report-templates.md 模块三：面试报告
 */

import { generateObject } from "ai";
import { models } from "@/lib/ai";
import { db } from "@/lib/db";
import {
  EvaluateOutputSchema,
  type EvaluateOutput,
  type EvaluateInput,
  type QuestionThread,
  type InterviewQuestion,
  type InterviewMessage,
} from "./schema";
import { EVALUATE_SYSTEM_PROMPT, buildEvaluatePrompt } from "./evaluate-prompts";

// ============================================================
// 核心评估函数
// ============================================================

export interface EvaluateResult {
  output: EvaluateOutput;
  tokenUsage: number;
}

/**
 * 评估面试表现
 *
 * @param input 评估输入（题目 + 对话线索程 + JD）
 * @returns 评估结果 + token 使用量
 */
export async function evaluateInterview(
  input: EvaluateInput
): Promise<EvaluateResult> {
  const userPrompt = buildEvaluatePrompt(input);

  const result = await generateObject({
    model: models.mimo,
    schema: EvaluateOutputSchema,
    system: EVALUATE_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.2, // 评估需要稳定，低 temperature
    abortSignal: AbortSignal.timeout(90_000), // 评估内容较多，给更多时间
  });

  const tokenUsage =
    (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0);

  return {
    output: result.object as EvaluateOutput,
    tokenUsage,
  };
}

// ============================================================
// 从 DB 构建输入
// ============================================================

/**
 * 从数据库加载面试会话，组装评估输入
 *
 * 核心逻辑：从 conversationHistory 按 questionId 分组，
 * 拼出每题的完整对话线索程（含追问轮次）
 *
 * @param interviewId 面试会话 ID
 * @param userId 用户 ID（权限校验）
 * @returns 评估输入
 */
export async function buildEvaluationInput(
  interviewId: string,
  userId: string
): Promise<{ input: EvaluateInput; session: { id: string; jdId: string | null; evaluation: string | null } }> {
  // 1. 加载 session
  const session = await db.interviewSession.findFirst({
    where: {
      id: interviewId,
      userId,
    },
  });

  if (!session) {
    throw new Error("SESSION_NOT_FOUND");
  }

  // 2. 状态校验：只允许 completed 状态
  if (session.status !== "completed") {
    throw new Error("SESSION_NOT_COMPLETED");
  }

  // 3. 解析题目列表
  let questions: InterviewQuestion[];
  try {
    questions = JSON.parse(session.questions) as InterviewQuestion[];
  } catch {
    throw new Error("INVALID_QUESTIONS_DATA");
  }

  // 4. 解析对话历史
  let conversationHistory: InterviewMessage[] = [];
  try {
    if (session.conversationHistory) {
      conversationHistory = JSON.parse(
        session.conversationHistory
      ) as InterviewMessage[];
    }
  } catch {
    console.warn("[interview/evaluate] conversationHistory JSON 解析失败，session:", session.id);
    throw new Error("INVALID_CONVERSATION_DATA");
  }

  // 5. 解析已回答题目
  let answeredQuestions: Array<{
    questionId: string;
    answer: string;
    followUpCount: number;
    feedback?: string;
  }> = [];
  try {
    if (session.answeredQuestions) {
      answeredQuestions = JSON.parse(session.answeredQuestions);
    }
  } catch {
    answeredQuestions = [];
  }

  if (answeredQuestions.length === 0) {
    throw new Error("NO_ANSWERS");
  }

  // 6. 按 questionId 分组对话历史，构建每题的完整线索程
  const questionThreads = buildQuestionThreads(
    questions,
    conversationHistory,
    answeredQuestions
  );

  // 7. 加载 JD 信息（可选，失败不阻塞）
  let jd = { position: "未知岗位", company_type: "未知" };
  if (session.jdId) {
    try {
      const jdRecord = await db.jobDescription.findUnique({
        where: { id: session.jdId },
      });
      if (jdRecord) {
        const parsed = JSON.parse(jdRecord.parsedJson) as Record<string, unknown>;
        jd = {
          position: (parsed.position as string) || "未知岗位",
          company_type: (parsed.company_type as string) || "未知",
        };
      }
    } catch {
      // JD 加载失败不阻塞评估
    }
  }

  return {
    input: {
      questions,
      questionThreads,
      jd,
      round: session.round,
    },
    session: { id: session.id, jdId: session.jdId, evaluation: session.evaluation },
  };
}

// ============================================================
// 对话线索程构建
// ============================================================

/**
 * 按题目分组对话历史，构建每题的完整对话线索程
 *
 * 策略：以 answeredQuestions 为主线（确定哪些题已回答），
 * 从 conversationHistory 中提取该题的全部对话消息。
 */
function buildQuestionThreads(
  questions: InterviewQuestion[],
  conversationHistory: InterviewMessage[],
  answeredQuestions: Array<{
    questionId: string;
    answer: string;
    followUpCount: number;
    feedback?: string;
  }>
): QuestionThread[] {
  const threads: QuestionThread[] = [];

  for (const aq of answeredQuestions) {
    const question = questions.find((q) => q.id === aq.questionId);
    if (!question) continue;

    // 从对话历史中提取该题的全部消息
    const messages = conversationHistory.filter(
      (msg) => msg.questionId === aq.questionId
    );

    threads.push({
      questionId: aq.questionId,
      question: question.question,
      type: question.type,
      focus: question.focus,
      difficulty: question.difficulty,
      messages,
      followUpCount: aq.followUpCount,
    });
  }

  return threads;
}
