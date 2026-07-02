/**
 * 竞争力评估 Schema
 *
 * 基于 SPEC.md §11.3 + agents/*.md 设计
 * 5 个 Agent 独立评估，BARS rubric + CoT + 3 次共识
 *
 * 架构：
 * 1. 5 个 Agent 各有独立的 BARS 维度
 * 2. 每个 Agent 运行 3 次取多数共识
 * 3. 加权聚合映射定性评级
 */

import { z } from "zod";

// ============================================================
// 基础类型
// ============================================================

/** 定性评估等级 */
const RatingLevel = z.enum(["强", "中", "弱"]);

/** 置信度 */
const ConfidenceLevel = z.enum(["high", "medium", "low"]);

// ============================================================
// 通用维度评分项
// ============================================================

/**
 * 单个维度的 BARS 评分
 *
 * 每个 Agent 对每个维度的评分都遵循此结构
 * 必须包含 CoT 推理链（用户可查看 WHY）
 */
export const DimensionScoreSchema = z.object({
  name: z.string().describe("维度名称"),
  score: z.number().int().min(1).max(5).describe("BARS 评分 1-5"),
  weight: z.number().min(0).max(1).describe("权重"),
  cot_reasoning: z
    .string()
    .describe("CoT 推理链：先写推理过程，再给分数"),
  evidence: z.string().describe("评分证据"),
});

export type DimensionScore = z.infer<typeof DimensionScoreSchema>;

// ============================================================
// 通用 Agent 评估输出
// ============================================================

/**
 * 单个 Agent 的评估结果
 *
 * 所有 Agent 共享此基础结构
 */
export const AgentEvaluationSchema = z.object({
  agent_id: z.string().describe("Agent 标识"),
  rating: RatingLevel.describe("定性评级"),
  confidence: ConfidenceLevel.describe("置信度"),
  composite_score: z.number().min(0).max(1).describe("加权聚合分 0-1"),
  dimensions: z
    .array(DimensionScoreSchema)
    .min(1)
    .describe("维度评分列表"),
  summary: z.string().describe("一句话定位"),
  strengths: z.array(z.string()).min(1).max(3).describe("Top 优势"),
  weaknesses: z.array(z.string()).min(1).max(3).describe("Top 短板"),
});

export type AgentEvaluation = z.infer<typeof AgentEvaluationSchema>;

// ============================================================
// 市场对标 Agent 特化输出
// ============================================================

export const MarketBenchmarkOutputSchema = AgentEvaluationSchema.extend({
  salary_positioning: z
    .object({
      percentile: z.string().describe("薪资分位 P25/P50/P75/P90"),
      range: z.string().describe("市场薪资区间"),
      market_context: z.string().describe("市场上下文"),
      data_source: z.string().describe("数据来源"),
      confidence: ConfidenceLevel.describe("薪资数据置信度"),
    })
    .optional()
    .describe("薪资定位"),
});

export type MarketBenchmarkOutput = z.infer<
  typeof MarketBenchmarkOutputSchema
>;

// ============================================================
// 猎头 Agent 特化输出
// ============================================================

export const HeadhunterOutputSchema = AgentEvaluationSchema.extend({
  market_scarcity: z
    .object({
      level: RatingLevel.describe("稀缺度"),
      description: z.string().describe("稀缺性描述"),
    })
    .describe("市场稀缺性"),
  core_selling_point: z
    .object({
      primary: z.string().describe("核心卖点"),
      why: z.string().describe("为什么是卖点"),
    })
    .describe("核心卖点"),
  timing: z
    .object({
      assessment: z.enum(["好", "一般", "差"]).describe("跳槽时机"),
      reason: z.string().describe("原因"),
    })
    .describe("跳槽时机"),
});

export type HeadhunterOutput = z.infer<typeof HeadhunterOutputSchema>;

// ============================================================
// 职业导师 Agent 特化输出
// ============================================================

export const CareerMentorOutputSchema = AgentEvaluationSchema.extend({
  ceiling_analysis: z
    .object({
      distance_to_ceiling: z.string().describe("距天花板距离"),
      ceiling_type: z.string().describe("天花板类型"),
      years_to_ceiling: z.string().describe("预计几年到达"),
    })
    .describe("天花板分析"),
  blocker_analysis: z
    .object({
      primary_blocker: z.string().describe("最关键卡点"),
      blocker_type: z.string().describe("卡点类型"),
    })
    .describe("卡点分析"),
  breakthrough_strategy: z
    .object({
      most_important: z.string().describe("最重要的突破方向"),
      timeline: z.string().describe("时间线"),
    })
    .describe("突破策略"),
});

export type CareerMentorOutput = z.infer<typeof CareerMentorOutputSchema>;

// ============================================================
// AI 效能专家 Agent 特化输出
// ============================================================

export const AiExpertOutputSchema = AgentEvaluationSchema.extend({
  ai_replacement_risk: z
    .object({
      level: RatingLevel.describe("替代风险等级"),
      detail: z.string().describe("具体风险描述"),
    })
    .describe("AI 替代风险"),
  ai_enhancement: z
    .object({
      opportunity: z.string().describe("增效机会"),
      tools: z.array(z.string()).describe("推荐 AI 工具"),
    })
    .describe("AI 增效机会"),
  skill_gap: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("AI 技能缺口"),
});

export type AiExpertOutput = z.infer<typeof AiExpertOutputSchema>;

// ============================================================
// 心理学家 Agent 特化输出
// ============================================================

export const PsychologistOutputSchema = AgentEvaluationSchema.extend({
  adaptability: z
    .object({
      level: RatingLevel.describe("适应力等级"),
      detail: z.string().describe("适应力描述"),
    })
    .describe("适应力评估"),
  anxiety_source: z
    .object({
      type: z.string().describe("焦虑类型"),
      description: z.string().describe("焦虑描述"),
    })
    .describe("焦虑来源"),
  challenger_insight: z
    .string()
    .optional()
    .describe("质疑者洞察：独立的风险警告，不参与共识投票"),
});

export type PsychologistOutput = z.infer<typeof PsychologistOutputSchema>;

// ============================================================
// E2：交叉质疑类型
// ============================================================

/**
 * 单条交叉质疑（Agent A 对 Agent B 的质疑）
 */
export const CrossExaminationItemSchema = z.object({
  target_agent: z.string().describe("被质疑的 Agent ID"),
  agreement: z.boolean().describe("是否同意其评级"),
  challenge: z
    .string()
    .min(20)
    .max(500)
    .describe("质疑内容：指出评估中的盲点、偏差或遗漏；若同意则说明为什么认同"),
  revised_perspective: z
    .string()
    .max(300)
    .optional()
    .describe("修正后的视角：仅在不同意时填写，你认为应该怎么看"),
});

export type CrossExaminationItem = z.infer<typeof CrossExaminationItemSchema>;

/**
 * 单个 Agent 的交叉质疑输出
 *
 * 看到其他 4 个 Agent 的评估后：
 * 1. 可能修正自己的评级（revised_rating）
 * 2. 对每个 Agent 提出质疑或认同
 */
export const AgentCrossExaminationSchema = z.object({
  agent_id: z.string().describe("发起质疑的 Agent ID"),
  original_rating: z.enum(["强", "中", "弱"]).describe("E1 阶段的原始评级"),
  original_score: z.number().min(0).max(1).describe("E1 阶段的原始评分"),
  revised_rating: z
    .enum(["强", "中", "弱"])
    .describe("看到其他评估后是否修正评级"),
  revised_score: z
    .number()
    .min(0)
    .max(1)
    .describe("修正后的评分（可与原始相同）"),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("修正后评级的置信度"),
  examinations: z
    .array(CrossExaminationItemSchema)
    .min(1)
    .max(4)
    .describe("对其他 Agent 的逐一质疑"),
  key_insight: z
    .string()
    .min(20)
    .max(300)
    .describe("交叉质疑后的核心洞察：最大的共识和分歧是什么"),
});

export type AgentCrossExamination = z.infer<
  typeof AgentCrossExaminationSchema
>;

// ============================================================
// E2：综合共识类型
// ============================================================

/**
 * 综合共识输出（圆桌主持人 Agent）
 *
 * 读取全部 5 个评估 + 全部 5 份交叉质疑后：
 * 1. 做出最终裁决
 * 2. 说明共识区和分歧区
 * 3. 给出裁决理由
 */
export const SynthesisConsensusSchema = z.object({
  overall_rating: z.enum(["强", "中", "弱"]).describe("最终评级"),
  overall_score: z.number().min(0).max(1).describe("最终评分 0-1"),
  overall_confidence: z
    .enum(["high", "medium", "low"])
    .describe("最终置信度"),
  consensus_narrative: z
    .string()
    .min(50)
    .max(800)
    .describe("共识叙述：综合各 Agent 视角的整体判断"),
  key_disagreements: z
    .array(z.string())
    .max(5)
    .describe("未解决的关键分歧点"),
  resolution_rationale: z
    .string()
    .min(30)
    .max(500)
    .describe("裁决理由：为什么给出这个最终评级"),
  revised_strengths: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("综合后的优势（考虑交叉质疑后）"),
  revised_weaknesses: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("综合后的短板（考虑交叉质疑后）"),
  one_sentence: z
    .string()
    .min(10)
    .max(200)
    .describe("一句话定位"),
});

export type SynthesisConsensus = z.infer<typeof SynthesisConsensusSchema>;

/**
 * E2 完整结果
 */
export interface SynthesisResult {
  /** 交叉质疑结果（null 表示跳过） */
  cross_examinations: AgentCrossExamination[] | null;
  /** 综合共识 */
  synthesis: SynthesisConsensus;
  /** E2 阶段 token 使用量 */
  total_usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** E2 阶段耗时（毫秒） */
  total_duration_ms: number;
}

// ============================================================
// Agent 调用结果（包含元数据）
// ============================================================

export interface AgentRunResult<T> {
  agent_id: string;
  output: T;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
  };
  duration_ms: number;
  success: boolean;
  error?: string;
}

// ============================================================
// 完整评估结果
// ============================================================

/**
 * 5 Agent 评估的完整结果
 */
export interface EvaluationResult {
  /** 整体评级 */
  overall_rating: "强" | "中" | "弱";
  /** 整体评分 0-1 */
  overall_score: number;
  /** 整体置信度 */
  overall_confidence: "high" | "medium" | "low";
  /** 一句话定位 */
  one_sentence: string;
  /** 5 个 Agent 的评估结果 */
  agents: {
    market_benchmark: AgentRunResult<MarketBenchmarkOutput>;
    headhunter: AgentRunResult<HeadhunterOutput>;
    career_mentor: AgentRunResult<CareerMentorOutput>;
    ai_expert: AgentRunResult<AiExpertOutput>;
    psychologist: AgentRunResult<PsychologistOutput>;
  };
  /** 跨 Agent 合并的优势 */
  strengths: string[];
  /** 跨 Agent 合并的短板 */
  weaknesses: string[];
  /** E2 圆桌讨论综合结果 */
  synthesis?: SynthesisResult;
  /** 总 token 使用量 */
  total_usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** 总耗时（毫秒） */
  total_duration_ms: number;
}

// ============================================================
// 评估输入
// ============================================================

/**
 * 评估输入参数
 *
 * 复用 roundtable 的 RoundtableInput + 画像模板的定制化维度
 */
export interface EvaluationInput {
  /** 岗位 ID（用于加载差异化权重配置） */
  positionId?: string;
  /** 用户基础信息 */
  basicInfo: {
    current_role: string;
    industry: string;
    years_of_experience: number;
    city: string;
    company?: string;
  };
  /** 职业摘要 */
  careerSummary: {
    motivation: string;
    value_ranking: string[];
    risk_tolerance: "低" | "中" | "高";
    life_constraints: string;
    development_goal: string;
  };
  /** 优势列表 */
  strengths: string[];
  /** 短板列表 */
  gaps: string[];
  /** 多段经历 */
  careerSegments?: Array<{
    position_id: string;
    industry: string;
    company: string;
    duration_years: number;
    key_skills: string[];
    key_achievements: string[];
  }>;
  /** 对话摘要 */
  dialogueSummary?: string;
  /** 定制化维度（圆桌讨论生成） */
  industrySpecific?: Record<
    string,
    {
      value: string;
      assessment: "强" | "中" | "弱";
      evidence?: string;
      confidence: "high" | "medium" | "low";
    }
  >;
  /** 用户补充的薪资数据（F1 新增） */
  userSalary?: {
    annualSalary: number;
    city: string;
    position: string;
    marketPercentile: number;
    label: "强" | "中" | "弱";
    confidence: "high" | "medium" | "low";
  };
}
