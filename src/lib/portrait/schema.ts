/**
 * 画像模板 Schema
 *
 * 基于 SPEC.md §3.6 + §11.3 设计
 * 使用 Zod 进行运行时验证
 *
 * 三层结构：
 * 1. 通用基础模板（职业导师生成）
 * 2. 定制化模板（圆桌讨论生成）
 * 3. 最终模板 = 通用 + 定制
 */

import { z } from "zod";

// ============================================================
// 基础类型
// ============================================================

/** 定性评估等级 */
const AssessmentLevel = z.enum(["强", "中", "弱"]);

/** 置信度 */
const ConfidenceLevel = z.enum(["high", "medium", "low"]);

/** 风险等级 */
const RiskLevel = z.enum(["低", "中", "高"]);

/** 稀缺度等级 */
const ScarcityLevel = z.enum(["低", "中", "高", "极高"]);

// ============================================================
// 1. 基础信息（从简历解析）
// ============================================================

export const BasicInfoSchema = z.object({
  current_role: z.string().describe("当前职位"),
  industry: z.string().describe("所在行业"),
  years_of_experience: z.number().min(0).max(80).describe("工作年限"),
  city: z.string().describe("所在城市"),
  education: z
    .string()
    .optional()
    .describe("最高学历"),
  company: z
    .string()
    .optional()
    .describe("当前公司"),
});

export type BasicInfo = z.infer<typeof BasicInfoSchema>;

// ============================================================
// 2. 多段经历
// ============================================================

export const CareerSegmentSchema = z.object({
  position_id: z.string().describe("岗位标识"),
  industry: z.string().describe("行业"),
  company: z.string().describe("公司"),
  duration_years: z.number().describe("任职年限"),
  key_skills: z.array(z.string()).describe("核心技能"),
  key_achievements: z.array(z.string()).describe("关键成就"),
  departure_reason: z.string().optional().describe("离职原因"),
});

export type CareerSegment = z.infer<typeof CareerSegmentSchema>;

// ============================================================
// 3. 职业摘要（通用基础模板核心）
// ============================================================

export const CareerSummarySchema = z.object({
  motivation: z.string().describe("跳槽动机"),
  value_ranking: z.array(z.string()).describe("价值排序"),
  risk_tolerance: RiskLevel.describe("风险承受度"),
  life_constraints: z.string().describe("生活约束"),
  development_goal: z.string().describe("3年发展目标"),
});

export type CareerSummary = z.infer<typeof CareerSummarySchema>;

// ============================================================
// 4. 职业叙事（多段经历的主线）
// ============================================================

export const CareerNarrativeSchema = z.object({
  main_theme: z.string().describe("贯穿多段经历的主线"),
  transition_rationale: z.string().describe("转变逻辑"),
  composite_strength: z.string().describe("组合优势"),
});

export type CareerNarrative = z.infer<typeof CareerNarrativeSchema>;

// ============================================================
// 5. 组合稀缺度评估
// ============================================================

export const CompositeProfileSchema = z.object({
  rare_combination: z.string().describe("稀有组合描述"),
  scarcity_level: ScarcityLevel.describe("稀缺度"),
  market_value_multiplier: z.number().min(0).describe("市场价值倍数"),
  core_narrative: z.string().describe("组合价值叙事"),
});

export type CompositeProfile = z.infer<typeof CompositeProfileSchema>;

// ============================================================
// 6. AI 能力维度
// ============================================================

export const AiCapabilitySchema = z.object({
  ai_literacy: z.string().describe("AI素养自评"),
  replacement_risk: AssessmentLevel.describe("AI替代风险"),
  enhancement_opportunity: AssessmentLevel.describe("AI增效机会"),
  skill_gap: z.array(z.string()).describe("AI技能缺口"),
});

export type AiCapability = z.infer<typeof AiCapabilitySchema>;

// ============================================================
// 7. 当前工作信息（模块零收集）
// ============================================================

export const CurrentWorkSchema = z.object({
  leader_style: z.string().describe("直属领导风格"),
  team_size: z.string().describe("团队规模与管理职责"),
  biggest_bottleneck: z.string().describe("当前岗位最大瓶颈"),
  pain_point: z.string().describe("最近半年最头疼的工作问题"),
  unrealized_goal: z.string().describe("想争取但没争取到的东西"),
});

export type CurrentWork = z.infer<typeof CurrentWorkSchema>;

// ============================================================
// 8. 定制化维度（圆桌讨论生成，按岗位动态）
// ============================================================

export const IndustrySpecificSchema = z.record(
  z.string(),
  z.object({
    value: z.string().describe("维度值"),
    assessment: AssessmentLevel.describe("评估等级"),
    evidence: z.string().optional().describe("支撑证据"),
    confidence: ConfidenceLevel.describe("置信度"),
  })
);

export type IndustrySpecific = z.infer<typeof IndustrySpecificSchema>;

// ============================================================
// 完整画像模板
// ============================================================

export const PortraitTemplateSchema = z.object({
  /** Schema 版本 */
  schema_version: z.number().default(1),

  /** 基础信息（简历解析） */
  basic_info: BasicInfoSchema,

  /** 职业摘要（通用基础模板） */
  career_summary: CareerSummarySchema,

  /** 优势列表 */
  strengths: z.array(z.string()).describe("核心优势"),

  /** 短板列表 */
  gaps: z.array(z.string()).describe("待提升短板"),

  /** 多段经历 */
  career_segments: z.array(CareerSegmentSchema).describe("职业经历"),

  /** 职业叙事 */
  career_narrative: CareerNarrativeSchema,

  /** 组合稀缺度 */
  composite_profile: CompositeProfileSchema,

  /** 定制化维度（圆桌讨论生成） */
  industry_specific: IndustrySpecificSchema.optional().describe(
    "行业/岗位特定维度"
  ),

  /** AI 能力 */
  ai_capability: AiCapabilitySchema,

  /** 当前工作信息（模块零收集，可选） */
  current_work: CurrentWorkSchema.optional().describe("当前工作信息"),

  /** 职业清晰度评分（0-1） */
  career_clarity_score: z
    .number()
    .min(0)
    .max(1)
    .describe("职业清晰度评分"),

  /** 元数据 */
  meta: z.object({
    /** 生成时间 */
    created_at: z.string().describe("生成时间"),
    /** 最后更新 */
    updated_at: z.string().describe("最后更新"),
    /** 数据来源 */
    sources: z
      .array(z.enum(["resume", "dialogue", "roundtable", "inference", "coaching"]))
      .describe("数据来源"),
    /** 整体置信度 */
    overall_confidence: ConfidenceLevel.describe("整体置信度"),
  }),
});

export type PortraitTemplate = z.infer<typeof PortraitTemplateSchema>;

// ============================================================
// 通用基础模板（职业导师生成）
// ============================================================

/**
 * 通用基础模板结构
 *
 * 职业导师 Agent 从对话 Slot 中提取，填充到画像模板
 * 不包含定制化维度（由圆桌讨论生成）
 */
export const BasePortraitSchema = z.object({
  career_summary: CareerSummarySchema,
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  career_narrative: CareerNarrativeSchema,
  ai_capability: AiCapabilitySchema,
});

export type BasePortrait = z.infer<typeof BasePortraitSchema>;

// ============================================================
// 工具函数
// ============================================================

/**
 * 创建空的画像模板
 */
export function createEmptyPortrait(
  basicInfo: BasicInfo
): PortraitTemplate {
  return {
    schema_version: 1,
    basic_info: basicInfo,
    career_summary: {
      motivation: "",
      value_ranking: [],
      risk_tolerance: "中",
      life_constraints: "",
      development_goal: "",
    },
    strengths: [],
    gaps: [],
    career_segments: [],
    career_narrative: {
      main_theme: "",
      transition_rationale: "",
      composite_strength: "",
    },
    composite_profile: {
      rare_combination: "",
      scarcity_level: "中",
      market_value_multiplier: 1.0,
      core_narrative: "",
    },
    ai_capability: {
      ai_literacy: "",
      replacement_risk: "中",
      enhancement_opportunity: "中",
      skill_gap: [],
    },
    career_clarity_score: 0,
    meta: {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sources: [],
      overall_confidence: "low",
    },
  };
}

/**
 * 计算画像完成度
 *
 * 返回 0-1 的完成度比例
 */
export function calculateCompleteness(portrait: PortraitTemplate): {
  score: number;
  filled: string[];
  missing: string[];
} {
  const checks: [string, boolean][] = [
    ["跳槽动机", !!portrait.career_summary.motivation],
    ["价值排序", portrait.career_summary.value_ranking.length > 0],
    // risk_tolerance 有默认值 "中"，无法区分"用户说了"和"默认值"，不纳入检查
    ["生活约束", !!portrait.career_summary.life_constraints],
    ["发展目标", !!portrait.career_summary.development_goal],
    ["核心优势", portrait.strengths.length > 0],
    ["待提升短板", portrait.gaps.length > 0],
    ["职业叙事主线", !!portrait.career_narrative.main_theme],
    ["AI素养", !!portrait.ai_capability.ai_literacy],
    [
      "职业经历",
      portrait.career_segments.length > 0,
    ],
  ];

  const filled = checks.filter(([, v]) => v).map(([k]) => k);
  const missing = checks.filter(([, v]) => !v).map(([k]) => k);

  return {
    score: filled.length / checks.length,
    filled,
    missing,
  };
}

/**
 * 合并定制化维度到画像模板
 */
export function mergeIndustrySpecific(
  portrait: PortraitTemplate,
  industrySpecific: IndustrySpecific
): PortraitTemplate {
  const uniqueSources = Array.from(
    new Set([...portrait.meta.sources, "roundtable"])
  ) as PortraitTemplate["meta"]["sources"];

  return {
    ...portrait,
    industry_specific: industrySpecific,
    meta: {
      ...portrait.meta,
      updated_at: new Date().toISOString(),
      sources: uniqueSources,
    },
  };
}
