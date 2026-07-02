/**
 * 岗位匹配圆桌讨论 Schema
 *
 * 基于 SPEC.md §3.13 设计
 * 3 角色辩论式圆桌 + MiMo 综合层
 *
 * 与模块一圆桌（roundtable/schema.ts）的区别：
 * - 模块一：4 Agent 并发生成 industry_specific 维度
 * - 模块二：3 Agent 辩论式讨论 + 综合结论
 */

import { z } from "zod";
import type { MatchAnalysis } from "@/lib/match/schema";

// ============================================================
// 角色发言输出（每个 Agent 的完整输出）
// ============================================================

/**
 * 单角色圆桌发言 Schema
 *
 * 每个 Agent 输出 2 轮立场 + 一句话核心观点
 */
export const RoleDiscussionSchema = z.object({
  round1_position: z
    .string()
    .min(80)
    .max(600)
    .describe("Round 1 立场：基于匹配分析亮明核心判断（目标 150-250 字）"),
  round2_position: z
    .string()
    .min(80)
    .max(600)
    .describe("Round 2 立场：交叉质疑 + 最终立场（目标 150-250 字）"),
  key_point: z
    .string()
    .min(10)
    .max(100)
    .describe("一句话核心观点"),
});

export type RoleDiscussion = z.infer<typeof RoleDiscussionSchema>;

// ============================================================
// 综合结论输出（MiMo 综合层）
// ============================================================

/**
 * 投递建议 Schema
 */
export const RecommendationSchema = z.object({
  decision: z
    .enum(["值得投", "谨慎考虑", "不建议"])
    .describe("投递决策"),
  reason: z
    .string()
    .min(20)
    .max(500)
    .describe("个性化理由（引用圆桌讨论中的具体观点）"),
  next_step: z
    .string()
    .min(10)
    .max(300)
    .describe("下一步行动建议"),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

/**
 * 综合结论 Schema
 */
export const SynthesisOutputSchema = z.object({
  consensus: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("共识结论（多个角色都提到的观点）"),
  disagreements: z
    .array(z.string())
    .min(0)
    .max(5)
    .describe("分歧点（角色之间有冲突的观点）"),
  recommendation: RecommendationSchema.describe("投递建议"),
  risk_level: z
    .enum(["低", "中", "高"])
    .describe("投递风险等级"),
});

export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>;

// ============================================================
// 角色配置
// ============================================================

export type MatchRoundtableRole = "job_insight" | "industry_director" | "headhunter";

export interface RoleConfig {
  id: MatchRoundtableRole;
  label: string;
  model: "mimo" | "deepseek" | "qwen";
  temperature: number;
}

export const roleConfigs: Record<MatchRoundtableRole, RoleConfig> = {
  job_insight: {
    id: "job_insight",
    label: "岗位洞察",
    model: "deepseek",
    temperature: 0.3,
  },
  industry_director: {
    id: "industry_director",
    label: "行业总监",
    model: "qwen",
    temperature: 0.3,
  },
  headhunter: {
    id: "headhunter",
    label: "猎头",
    model: "mimo",
    temperature: 0.4,
  },
};

// ============================================================
// 输入参数
// ============================================================

/**
 * 圆桌讨论输入
 *
 * 从 match_results + job_descriptions + portraits 组装
 */
export interface MatchRoundtableInput {
  /** JD 解析结果 */
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
  /** 用户画像 */
  portrait: {
    basic_info: {
      current_role: string;
      industry: string;
      years_of_experience: number;
      city: string;
      company?: string;
    };
    career_summary: {
      motivation: string;
      value_ranking: string[];
      risk_tolerance: "低" | "中" | "高";
      life_constraints: string;
      development_goal: string;
    };
    strengths: string[];
    gaps: string[];
    career_segments?: Array<{
      position_id: string;
      industry: string;
      company: string;
      duration_years: number;
      key_skills: string[];
      key_achievements: string[];
    }>;
  };
  /** K2 匹配分析结果 */
  match_analysis: {
    overall_rating: "强" | "中" | "弱";
    dimensions: MatchAnalysis["dimensions"];
    gaps: MatchAnalysis["gaps"];
    strengths: MatchAnalysis["strengths"];
  };
  /** 岗位知识卡（可选） */
  knowledge_card?: {
    core_competencies?: {
      irreplaceable?: Array<{ capability: string; importance: string }>;
    };
    salary?: {
      by_city?: Record<string, { P25: string | number; P50: string | number; P75: string | number; P90: string | number }>;
    };
  };
}

// ============================================================
// Agent 发言结果（内部使用）
// ============================================================

/**
 * 单个 Agent 的发言结果
 */
export interface AgentDiscussionResult {
  agent_id: string;
  output: RoleDiscussion | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  duration_ms: number;
  success: boolean;
  error?: string;
}

// ============================================================
// API 响应类型（对齐 api-endpoints.md）
// ============================================================

export interface MatchRoundtableResponse {
  roundtable_id: string;
  participants: Array<{
    role: string;
    analysis: string; // round1 + round2 合并展示
    key_point: string;
  }>;
  consensus: string[];
  disagreements: string[];
  recommendation: {
    decision: "值得投" | "谨慎考虑" | "不建议";
    reason: string;
    next_step: string;
  };
  risk_level: "低" | "中" | "高";
}
