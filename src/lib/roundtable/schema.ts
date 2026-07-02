/**
 * 圆桌讨论 Schema
 *
 * 基于 SPEC.md §3.7 + portrait-builder.md Layer 2 设计
 * 4 个 Agent 并发生成 industry_specific 维度
 *
 * 架构：
 * 1. 每个 Agent 独立生成自己的维度
 * 2. 结果合并到 PortraitTemplate.industry_specific
 */

import { z } from "zod";

// ============================================================
// 基础类型（复用 portrait/schema.ts）
// ============================================================

/** 定性评估等级 */
const AssessmentLevel = z.enum(["强", "中", "弱"]);

/** 置信度 */
const ConfidenceLevel = z.enum(["high", "medium", "low"]);

// ============================================================
// 单个维度项（通用结构）
// ============================================================

/**
 * 维度项 Schema
 *
 * 每个 Agent 输出的每个维度都遵循这个结构
 */
export const DimensionItemSchema = z.object({
  value: z.string().describe("维度值"),
  assessment: AssessmentLevel.describe("评估等级"),
  evidence: z.string().optional().describe("支撑证据"),
  confidence: ConfidenceLevel.describe("置信度"),
});

export type DimensionItem = z.infer<typeof DimensionItemSchema>;

// ============================================================
// 心理学家 Agent 输出
// ============================================================

/**
 * 心理学家 Agent 输出 Schema
 *
 * 职责：决策心理视角
 * - 分析用户的焦虑来源
 * - 评估决策心理状态
 * - 提供心理调适建议
 */
export const PsychologistOutputSchema = z.object({
  /** 焦虑来源分析 */
  anxiety_source: DimensionItemSchema.describe("焦虑来源：AI替代焦虑/晋升焦虑/行业焦虑等"),

  /** 决策心理状态 */
  decision_readiness: DimensionItemSchema.describe("决策准备度：理性/感性/回避/冲动"),

  /** 风险感知偏差 */
  risk_perception_bias: DimensionItemSchema.describe("风险感知偏差：过度悲观/过度乐观/合理"),

  /** 心理韧性 */
  psychological_resilience: DimensionItemSchema.describe("心理韧性：面对职业变化的适应能力"),

  /** 心理调适建议 */
  psychological_advice: z.string().describe("心理调适建议（一句话）"),
});

export type PsychologistOutput = z.infer<typeof PsychologistOutputSchema>;

// ============================================================
// 行业总监 Agent 输出
// ============================================================

/**
 * 行业总监 Agent 输出 Schema
 *
 * 职责：行业趋势视角（100%动态生成）
 * - 分析行业核心能力要求
 * - 评估行业特定因素
 * - 判断市场供需状况
 */
export const IndustryDirectorOutputSchema = z.object({
  /** 核心能力维度 */
  core_competencies: z
    .array(DimensionItemSchema)
    .min(2)
    .max(5)
    .describe("核心能力维度（2-5个）"),

  /** 行业特定因素 */
  industry_factors: z
    .array(DimensionItemSchema)
    .min(2)
    .max(4)
    .describe("行业特定因素（2-4个）"),

  /** 市场供需 */
  market_supply: DimensionItemSchema.describe("市场供需：供不应求/供需平衡/供过于求"),

  /** 行业趋势判断 */
  industry_trend: z.string().describe("行业趋势判断（一句话）"),
});

export type IndustryDirectorOutput = z.infer<typeof IndustryDirectorOutputSchema>;

// ============================================================
// 职业导师 Agent 输出
// ============================================================

/**
 * 职业导师 Agent 输出 Schema
 *
 * 职责：职业发展视角
 * - 分析职业路径
 * - 评估天花板
 * - 找到突破点
 */
export const CareerMentorOutputSchema = z.object({
  /** 职业路径分析 */
  career_path: DimensionItemSchema.describe("职业路径：当前→目标的可行路径"),

  /** 天花板分析 */
  ceiling: DimensionItemSchema.describe("天花板：限制职业发展的核心因素"),

  /** 突破点分析 */
  breakthrough: DimensionItemSchema.describe("突破点：最有可能的突破方向"),

  /** 发展建议 */
  development_advice: z.string().describe("发展建议（一句话）"),
});

export type CareerMentorOutput = z.infer<typeof CareerMentorOutputSchema>;

// ============================================================
// AI效能专家 Agent 输出
// ============================================================

/**
 * AI效能专家 Agent 输出 Schema
 *
 * 职责：AI影响视角
 * - 评估AI替代风险
 * - 分析AI增效机会
 * - 识别AI技能缺口
 */
export const AiExpertOutputSchema = z.object({
  /** AI替代风险 */
  ai_replacement_risk: DimensionItemSchema.describe("AI替代风险：哪些工作正在被替代"),

  /** AI增效机会 */
  ai_enhancement: DimensionItemSchema.describe("AI增效机会：AI可以提升哪些效率"),

  /** AI技能缺口 */
  ai_skill_gap: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("AI技能缺口（1-5个具体工具/技能）"),

  /** AI工具推荐 */
  ai_tool_recommendation: z.string().describe("AI工具推荐（一句话）"),
});

export type AiExpertOutput = z.infer<typeof AiExpertOutputSchema>;

// ============================================================
// 圆桌讨论完整结果
// ============================================================

/**
 * 单个 Agent 的发言结果
 */
export interface AgentContribution<T> {
  /** Agent 标识 */
  agent_id: string;
  /** Agent 输出 */
  output: T;
  /** Token 使用量 */
  usage: {
    inputTokens?: number;
    outputTokens?: number;
  };
  /** 耗时（毫秒） */
  duration_ms: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（失败时） */
  error?: string;
}

/**
 * 圆桌讨论完整结果
 */
export interface RoundtableResult {
  /** 心理学家发言 */
  psychologist: AgentContribution<PsychologistOutput>;
  /** 行业总监发言 */
  industry_director: AgentContribution<IndustryDirectorOutput>;
  /** 职业导师发言 */
  career_mentor: AgentContribution<CareerMentorOutput>;
  /** AI效能专家发言 */
  ai_expert: AgentContribution<AiExpertOutput>;
  /** 合并后的 industry_specific */
  industry_specific: Record<
    string,
    {
      value: string;
      assessment: "强" | "中" | "弱";
      evidence?: string;
      confidence: "high" | "medium" | "low";
    }
  >;
  /** 总 token 使用量 */
  total_usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** 总耗时（毫秒） */
  total_duration_ms: number;
}

// ============================================================
// 输入参数
// ============================================================

/**
 * 圆桌讨论输入参数
 */
export interface RoundtableInput {
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
  }>;
  /** 对话摘要（最近 5 轮） */
  dialogueSummary?: string;
}
