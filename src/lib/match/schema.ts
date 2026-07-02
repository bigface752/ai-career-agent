/**
 * 岗位匹配分析 Schema
 *
 * 对齐 specs/api-endpoints.md POST /api/match/analyze 响应结构
 * 4 维度 BARS 匹配：技能/经验/薪资/发展
 */
import { z } from "zod";
import type { ParsedJd } from "@/lib/jd/schema";

// ============================================================
// 定性评级
// ============================================================

const RatingLevel = z.enum(["强", "中", "弱"]);
export type RatingLevel = z.infer<typeof RatingLevel>;

// ============================================================
// 单维度匹配结果
// ============================================================

export const MatchDimensionSchema = z.object({
  name: z.string().describe("维度名称"),
  rating: RatingLevel.describe("定性评级"),
  score: z.number().int().min(1).max(5).describe("BARS 评分 1-5"),
  detail: z.string().min(20).max(500).describe("详细分析"),
});

export type MatchDimension = z.infer<typeof MatchDimensionSchema>;

// ============================================================
// 差距项
// ============================================================

export const MatchGapSchema = z.object({
  gap: z.string().describe("差距描述"),
  severity: z.enum(["大", "中", "小"]).describe("严重程度"),
  how_to_close: z.string().describe("如何弥补"),
});

export type MatchGap = z.infer<typeof MatchGapSchema>;

// ============================================================
// 优势项
// ============================================================

export const MatchStrengthSchema = z.object({
  strength: z.string().describe("优势描述"),
  market_value: z.string().describe("市场价值说明"),
});

export type MatchStrength = z.infer<typeof MatchStrengthSchema>;

// ============================================================
// 简历优化建议
// ============================================================

export const ResumeOptimizationSchema = z.object({
  priority: z.number().int().min(1).max(5).describe("优先级 1=最高"),
  section: z.string().describe("简历板块，如 项目经历/技能标签/工作描述"),
  what: z.string().describe("具体改什么"),
  how: z.string().describe("怎么改"),
  why: z.string().describe("为什么改"),
});

export type ResumeOptimization = z.infer<typeof ResumeOptimizationSchema>;

// ============================================================
// 完整匹配分析输出
// ============================================================

export const MatchAnalysisSchema = z.object({
  overall_rating: RatingLevel.describe("综合评级"),
  overall_score: z.number().min(0).max(1).describe("综合评分 0-1"),
  dimensions: z
    .object({
      skill: MatchDimensionSchema.describe("技能匹配"),
      experience: MatchDimensionSchema.describe("经验匹配"),
      salary: MatchDimensionSchema.describe("薪资匹配"),
      development: MatchDimensionSchema.describe("发展匹配"),
    })
    .describe("4 维度匹配结果"),
  gaps: z
    .array(MatchGapSchema)
    .min(1)
    .max(5)
    .describe("差距列表，按严重程度降序"),
  strengths: z
    .array(MatchStrengthSchema)
    .min(1)
    .max(5)
    .describe("优势列表，按市场价值降序"),
  resume_optimization: z
    .array(ResumeOptimizationSchema)
    .min(1)
    .max(5)
    .describe("简历优化建议，按优先级降序"),
});

export type MatchAnalysis = z.infer<typeof MatchAnalysisSchema>;

// ============================================================
// 匹配分析输入
// ============================================================

/**
 * 匹配分析输入参数
 *
 * 从 JobDescription + Portrait 组装
 */
export interface MatchAnalysisInput {
  /** JD 解析结果（直接复用 ParsedJd 类型） */
  jd: ParsedJd;
  /** 用户画像（从 Portrait 表读取） */
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
  /** 岗位知识卡数据（可选，用于薪资和能力对标） */
  knowledge_card?: {
    core_competencies?: {
      irreplaceable?: Array<{ capability: string; importance: string }>;
      being_replaced?: Array<{ capability: string; [key: string]: unknown }>;
    };
    salary?: {
      by_city?: Record<string, { P25: string | number; P50: string | number; P75: string | number; P90: string | number; [key: string]: unknown }>;
    };
  };
}

// ============================================================
// API 响应类型
// ============================================================

export interface MatchAnalyzeResponse {
  match_id: string;
  overall_rating: "强" | "中" | "弱";
  dimensions: {
    技能匹配: { rating: "强" | "中" | "弱"; score: number; detail: string };
    经验匹配: { rating: "强" | "中" | "弱"; score: number; detail: string };
    薪资匹配: { rating: "强" | "中" | "弱"; score: number; detail: string };
    发展匹配: { rating: "强" | "中" | "弱"; score: number; detail: string };
  };
  gaps: Array<{ gap: string; severity: "大" | "中" | "小"; how_to_close: string }>;
  strengths: Array<{ strength: string; market_value: string }>;
  resume_optimization: Array<{
    priority: number;
    section: string;
    what: string;
    how: string;
    why: string;
  }>;
}
