/**
 * 知识卡三层 Schema 定义
 * 基于 kitty-specs/v1-career-cognition/agents/knowledge-base/_schema.md
 *
 * 设计原则：schema 适配实际数据，不做过度约束
 * 实际 JSON 用中文值（"高/中/低"）、字符串数字（"8500万"、"90%"）
 */
import { z } from "zod";

// ============================================================
// 通用子 Schema
// ============================================================

const MetaSchema = z.object({
  schema_version: z.string(),
  last_updated: z.string(),
  confidence_level: z.string(), // "high" | "medium" | "low" | "high/medium/low"
  data_sources: z.array(z.string()),
  owner: z.string(),
});

// 数据点：允许 number 或 string（如 "8500万"、"80%的企业岗位将被AI显著改变"）
const FlexibleValueSchema = z.union([z.number(), z.string()]);

// 兼容：实际数据中数组字段可能是字符串（如 "续费率、ARPU、LTV"）
const StringOrArray = z.union([z.array(z.string()), z.string()]);

// ============================================================
// 第一层：global_knowledge.json
// ============================================================

const DataPointSchema = z.object({
  number: FlexibleValueSchema.optional(),
  percentage: FlexibleValueSchema.optional(),
  source: z.string(),
  year: z.number().optional(),
});

const FlagshipCaseSchema = z.object({
  company: z.string(),
  action: z.string(),
  data: z.string(),
  source: z.string(),
});

const AIToolSchema = z.object({
  name: z.string(),
  company: z.string().optional(),
  capabilities: z.string().optional(),
  impact: z.string().optional(),
  price: z.string().optional(),
});

export const GlobalKnowledgeSchema = z.object({
  meta: MetaSchema,
  macro_ai_data: z.object({
    jobs_displaced: DataPointSchema,
    jobs_created: DataPointSchema.extend({
      net: FlexibleValueSchema.optional(),
    }),
    enterprise_adoption: DataPointSchema,
    automation_rate: DataPointSchema,
    agent_market: z.object({
      size_2026: FlexibleValueSchema,
      size_2030: FlexibleValueSchema,
      cagr: z.string(),
      sources: StringOrArray,
    }),
    agentic_ai_adoption: DataPointSchema.optional(),
  }),
  flagship_cases: z.array(FlagshipCaseSchema),
  ai_tools_catalog: z.object({
    coding_agents: z.array(AIToolSchema),
    enterprise_platforms: z.array(AIToolSchema),
    sales_automation: z.array(AIToolSchema),
  }),
});

export type GlobalKnowledge = z.infer<typeof GlobalKnowledgeSchema>;

// ============================================================
// 第二层：industry_context.json
// ============================================================

const StringPairSchema = z.object({ b2b: z.string(), internet: z.string() });

export const IndustryContextSchema = z.object({
  meta: MetaSchema,
  b2b_vs_internet: z.object({
    ai_replacement_speed: StringPairSchema,
    ai_enhancement_opportunity: StringPairSchema,
    must_learn_ai: StringPairSchema,
    core_competitive_advantage: StringPairSchema,
    // salary_structure 字段名在实际数据中是 b2b_typical_3yr 等，用 record 兼容
    salary_structure: z.record(z.string(), z.string()),
    industry_mobility: StringPairSchema,
    promotion_logic: StringPairSchema,
    ceiling_cause: StringPairSchema,
    job_hopping_risk: StringPairSchema,
  }),
  b2b_characteristics: z.object({
    evaluation_focus: z.string(),
    scarcity_source: z.string(),
    decision_chain: z.string(),
    core_metrics: StringOrArray,
  }),
});

export type IndustryContext = z.infer<typeof IndustryContextSchema>;

// ============================================================
// 第三层：positions/{position}.json
// ============================================================

// 允许中文和英文的风险等级
const RiskLevelSchema = z.string(); // "高" | "中" | "低" | "high" | "medium" | "low"
const ImportanceSchema = z.string(); // "critical" | "high" | "medium" | "极高" | "高"

const SubTypeSchema = z.object({
  name: z.string(),
  description: z.string(),
  ai_risk_level: RiskLevelSchema,
});

const TaskReplacedSchema = z.object({
  task: z.string(),
  ai_tool: z.string(),
  replacement_rate: FlexibleValueSchema, // "90%" 或 0.9
});

const TaskEnhancedSchema = z.object({
  task: z.string(),
  how: z.string(),
});

const IrreplaceableCapabilitySchema = z.object({
  capability: z.string(),
  why_ai_cant: z.string(),
  importance: ImportanceSchema,
});

const BeingReplacedCapabilitySchema = z.object({
  capability: z.string(),
  ai_tool: z.string(),
  replacement_rate: FlexibleValueSchema,
});

const IndustryBarrierSchema = z.object({
  barrier: z.string(),
  description: z.string(),
  protection_level: RiskLevelSchema,
});

const SalaryPercentileSchema = z.object({
  P25: FlexibleValueSchema,
  P50: FlexibleValueSchema,
  P75: FlexibleValueSchema,
  P90: FlexibleValueSchema,
  sample_size: FlexibleValueSchema,
});

const TransformationStageSchema = z.object({
  stage: z.string(),
  timeframe: z.string(),
  role: z.string(),
  core_skills: StringOrArray,
  tools: z.union([z.array(z.string()), z.string()]),
});

const AIToolRequiredSchema = z.object({
  tool: z.string(),
  priority: z.string(), // "essential" | "recommended" | "nice-to-have" | "必备" | "推荐"
  use_case: z.string(),
  learning_time: z.string(),
  price: z.string(),
});

const AntiIntuitionInsightSchema = z.object({
  insight: z.string(),
  evidence: z.string(),
  implication: z.string(),
});

export const PositionKnowledgeSchema = z.object({
  meta: MetaSchema,
  position_id: z.string(),
  display_name: z.string(),
  display_name_en: z.string().optional(),
  sub_types: z.array(SubTypeSchema),
  ai_impact: z.object({
    tasks_replaced: z.array(TaskReplacedSchema),
    tasks_enhanced: z.array(TaskEnhancedSchema),
    efficiency_gain: z.string(),
    future_model: z.string(),
    replacement_mode: z
      .object({
        old_pattern: z.string(),
        new_pattern: z.string(),
      })
      .optional(),
  }),
  core_competencies: z.object({
    irreplaceable: z.array(IrreplaceableCapabilitySchema),
    being_replaced: z.array(BeingReplacedCapabilitySchema),
  }),
  industry_barriers: z.array(IndustryBarrierSchema),
  salary: z.object({
    confidence: z.string(),
    last_updated: z.string(),
    data_source: z.string(),
    methodology: z.string().optional(),
    limitations: z.array(z.string()).optional(),
    by_city: z.record(z.string(), SalaryPercentileSchema),
  }),
  transformation_path: z.array(TransformationStageSchema),
  required_ai_tools: z.array(AIToolRequiredSchema),
  anti_intuition_insights: z.array(AntiIntuitionInsightSchema),
});

export type PositionKnowledge = z.infer<typeof PositionKnowledgeSchema>;

// ============================================================
// 多段经历 composite_profile
// ============================================================

export const CompositeProfileSchema = z.object({
  rare_combination: z.string(),
  scarcity_level: z.string(), // "极高" | "高" | "中" | "低"
  market_value_multiplier: z.number(),
  core_narrative: z.string(),
  transferable_skills: z.array(
    z.object({
      skill: z.string(),
      from: z.string(),
      value_in: z.string(),
    })
  ),
});

export type CompositeProfile = z.infer<typeof CompositeProfileSchema>;

// ============================================================
// 占位符映射
// ============================================================

export const PLACEHOLDER_MAP = {
  "{global_knowledge}": "global",
  "{industry_context}": "industry",
  "{knowledge_card}": "position",
  "{company_context}": "company",
} as const;

export type PlaceholderKey = keyof typeof PLACEHOLDER_MAP;
