/**
 * 面试辅导 — Zod 类型定义
 *
 * 对齐 specs/api-endpoints.md POST /api/interview/generate-questions
 * 对齐 specs/api-endpoints.md POST /api/interview/evaluate
 * 对齐 SPEC.md §3.14-3.16
 */
import { z } from "zod";

// ============================================================
// 面试轮次
// ============================================================

export const InterviewRound = z.enum(["一面", "二面", "终面", "HR面"]);
export type InterviewRound = z.infer<typeof InterviewRound>;

// ============================================================
// 单道面试题
// ============================================================

export const InterviewQuestionSchema = z.object({
  id: z.string().describe("题目 ID，如 q1、q2"),
  type: z
    .enum(["专业题", "行为题", "非标准题"])
    .describe("题目类型"),
  question: z.string().min(10).describe("面试题内容"),
  focus: z.string().describe("考察重点"),
  difficulty: z.enum(["简单", "中等", "困难"]).describe("难度"),
});
export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>;

// ============================================================
// AI 输出（generateObject 的 schema）
// ============================================================

export const GenerateQuestionsOutputSchema = z.object({
  questions: z
    .array(InterviewQuestionSchema)
    .min(6)
    .max(10)
    .describe("面试题列表，6-10 道"),
});
export type GenerateQuestionsOutput = z.infer<typeof GenerateQuestionsOutputSchema>;

// ============================================================
// 生成输入（内部使用）
// ============================================================

export interface GenerateQuestionsInput {
  /** JD 信息 */
  jd: {
    position: string;
    company_type: string;
    requirements: {
      skills: string[];
      experience: string;
      education: string;
      salary_range: string;
      location: string;
    };
    nice_to_have: string[];
    key_challenges: string[];
  };
  /** 用户画像（精简版，只取出题需要的字段） */
  portrait: {
    basic_info: {
      current_role: string;
      industry: string;
      years_of_experience: number;
    };
    strengths: string[];
    gaps: string[];
    career_segments?: Array<{
      position_id: string;
      industry: string;
      company: string;
      key_skills: string[];
      key_achievements: string[];
    }>;
  };
  /** 面试轮次 */
  round: InterviewRound;
  /** 岗位知识卡（可选） */
  knowledge_card?: {
    core_competencies?: {
      irreplaceable?: Array<{ capability: string; importance: string }>;
    };
  };
}

// ============================================================
// API 响应类型
// ============================================================

export interface GenerateQuestionsResponse {
  interview_id: string;
  questions: Array<{
    id: string;
    type: "专业题" | "行为题" | "非标准题";
    question: string;
    focus: string;
    difficulty: "简单" | "中等" | "困难";
  }>;
  total_questions: number;
  estimated_time: string;
}

// ============================================================
// L2：模拟面试 — 回答评估
// ============================================================

/** 回答质量 */
export const AnswerQualitySchema = z.enum([
  "good",       // 回答有效，可以追问或转题
  "too_short",  // 过于简短，需要重新提问（不计追问次数）
  "off_topic",  // 跑题，需要重新提问（不计追问次数）
]);
export type AnswerQuality = z.infer<typeof AnswerQualitySchema>;

/** AI 评估输出（generateObject 的 schema） */
export const AiAnswerEvaluationSchema = z.object({
  answerQuality: AnswerQualitySchema.describe("回答质量评估"),
  shouldFollowUp: z.boolean().describe("是否建议追问"),
  followUpQuestion: z
    .string()
    .optional()
    .describe("追问内容（shouldFollowUp=true 时必填）"),
  reQuestion: z
    .string()
    .optional()
    .describe("重新提问内容（answerQuality=too_short/off_topic 时必填）"),
  feedback: z
    .string()
    .optional()
    .describe("简短反馈（转下一题时给出）"),
});
export type AiAnswerEvaluation = z.infer<typeof AiAnswerEvaluationSchema>;

/** API 请求：用户提交回答 */
export const AnswerInputSchema = z.object({
  interview_id: z.string().min(1, "缺少 interview_id"),
  question_id: z.string().min(1, "缺少 question_id"),
  answer: z.string().min(1, "回答不能为空").max(5000, "回答过长"),
});
export type AnswerInput = z.infer<typeof AnswerInputSchema>;

/** 对话记录条目 */
export interface InterviewMessage {
  type: "question" | "answer" | "follow_up" | "re_question" | "feedback";
  questionId: string;
  content: string;
  timestamp: string;
}

/** API 响应：回答结果 */
export interface AnswerResponse {
  question_id: string;
  ai_response: {
    type: "追问" | "转下一题" | "完成" | "重新提问";
    content: string;
    reason?: string;
  };
  follow_up_count: number;
  max_follow_up: number;
  session_status: "in_progress" | "completed";
}

// ============================================================
// L3：面试评估 + 答案优化
// ============================================================

/** 评分维度名称 */
export const EVAL_DIMENSIONS = [
  "专业深度",
  "表达清晰度",
  "STAR结构运用",
  "抗压表现",
] as const;

/** 单题评估 */
export const PerQuestionEvaluationSchema = z.object({
  question_id: z.string().describe("题目 ID"),
  rating: z.number().int().min(1).max(5).describe("该题评分 1-5"),
  strength: z.string().describe("该题回答的优势"),
  weakness: z.string().describe("该题回答的不足"),
  optimized_answer: z
    .string()
    .describe("基于 STAR 法则优化后的示范答案"),
  key_improvement: z.string().describe("最关键的改进点"),
});
export type PerQuestionEvaluation = z.infer<typeof PerQuestionEvaluationSchema>;

/** 评估输出（generateObject 的 schema） */
export const EvaluateOutputSchema = z.object({
  overall_rating: z
    .string()
    .describe("整体评级，格式如 '4/5：良好'"),
  dimensions: z
    .record(
      z.enum(EVAL_DIMENSIONS),
      z.object({
        score: z.number().int().min(1).max(5).describe("维度评分 1-5"),
        comment: z.string().describe("维度评语"),
      })
    )
    .describe("四维度评分，key 为维度名"),
  per_question: z
    .array(PerQuestionEvaluationSchema)
    .min(1)
    .describe("逐题评估"),
  top_3_improvements: z
    .array(
      z.object({
        priority: z.number().int().min(1).max(3).describe("优先级 1-3"),
        what: z.string().describe("需要改进什么"),
        how: z.string().describe("如何改进"),
      })
    )
    .length(3)
    .describe("Top 3 改进建议"),
  preparation_directions: z
    .array(
      z.object({
        direction: z.string().describe("准备方向"),
        reason: z.string().describe("原因"),
      })
    )
    .min(1)
    .max(5)
    .describe("需要重点准备的方向"),
});
export type EvaluateOutput = z.infer<typeof EvaluateOutputSchema>;

/** 评估输入（内部使用） */
export interface EvaluateInput {
  /** 面试题目列表 */
  questions: InterviewQuestion[];
  /** 逐题完整对话线索程（含追问轮次） */
  questionThreads: QuestionThread[];
  /** JD 信息 */
  jd: {
    position: string;
    company_type: string;
  };
  /** 面试轮次 */
  round: string;
}

/** 单题完整对话线索程 */
export interface QuestionThread {
  questionId: string;
  question: string;
  type: string;
  focus: string;
  difficulty: string;
  /** 该题全部对话（初次回答 + 追问 + 追问回答 + 反馈） */
  messages: InterviewMessage[];
  /** 追问次数 */
  followUpCount: number;
}

/** 评估 API 请求 */
export const EvaluateInputSchema = z.object({
  interview_id: z.string().min(1, "缺少 interview_id"),
});
export type EvaluateApiInput = z.infer<typeof EvaluateInputSchema>;

/** 评估 API 响应 */
export interface EvaluateResponse {
  evaluation: EvaluateOutput;
}
