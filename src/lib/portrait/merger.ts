/**
 * 画像模板合并器
 *
 * 将通用基础模板（职业导师）+ 定制化维度（圆桌讨论）合并为最终模板
 * 基于 SPEC.md §3.6 画像模板生成流程
 *
 * 流程：
 * 1. 基础信息 + 职业摘要 + 叙事 → 直接从 BasePortrait 映射
 * 2. 定制化维度 → 从 RoundtableResult.industry_specific 直接合并
 * 3. 组合稀缺度 → AI 生成（基于完整画像）
 * 4. 职业清晰度 → 规则计算
 * 5. 持久化到 Portrait 表
 */

import { generateObject } from "ai";
import { z } from "zod";
import { models } from "@/lib/ai";
import type {
  PortraitTemplate,
  BasePortrait,
  BasicInfo,
  CareerSegment,
  CompositeProfile,
  IndustrySpecific,
} from "./schema";
import type { RoundtableResult } from "@/lib/roundtable/schema";

// ============================================================
// 输入参数
// ============================================================

export interface MergePortraitParams {
  /** 基础信息（简历解析） */
  basicInfo: BasicInfo;
  /** 职业经历 */
  careerSegments: CareerSegment[];
  /** 通用基础画像（职业导师生成） */
  basePortrait: BasePortrait;
  /** 圆桌讨论结果（4 Agent 并发生成） */
  roundtableResult: RoundtableResult;
}

export interface MergePortraitResult {
  /** 最终画像模板 */
  portrait: PortraitTemplate;
  /** Token 使用量（仅组合稀缺度生成） */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ============================================================
// 组合稀缺度生成
// ============================================================

const CompositeProfileSchema = z.object({
  rare_combination: z.string().describe("稀有组合描述：用户独特的能力/经历组合"),
  scarcity_level: z.enum(["低", "中", "高", "极高"]).describe("稀缺度等级"),
  market_value_multiplier: z
    .number()
    .min(0.5)
    .max(5)
    .describe("市场价值倍数：0.5=低于市场, 1.0=持平, 2.0=显著溢价"),
  core_narrative: z.string().describe("组合价值叙事：一句话说明为什么这个组合有价值"),
});

const COMPOSITE_SYSTEM_PROMPT = `你是一个职业竞争力分析师。你的任务是评估用户职业组合的稀缺度。

## 评估维度
1. **稀有组合**：用户有哪些不常见的能力/经历组合？
2. **稀缺度**：这个组合在市场上的稀缺程度
3. **市场价值倍数**：这个组合能带来多少溢价
4. **核心叙事**：一句话说明为什么这个组合有价值

## 评估原则
- 基于真实市场情况，不要过度乐观
- 稀缺度要考虑行业和岗位的具体情况
- 市场价值倍数要有依据，不要随意给高倍数
- 核心叙事要具体，不要泛泛而谈

## 输出格式
严格按 JSON Schema 输出，不要添加额外字段。`;

function buildCompositePrompt(
  basicInfo: BasicInfo,
  basePortrait: BasePortrait,
  industrySpecific: IndustrySpecific
): string {
  const strengths = basePortrait.strengths.join("、");
  const gaps = basePortrait.gaps.join("、");

  // 提取圆桌讨论的关键维度
  const keyDimensions = Object.entries(industrySpecific)
    .filter(([, item]) => item.assessment === "强")
    .map(([key, item]) => `${key}: ${item.value}`)
    .join("\n");

  return `## 用户基础信息
- 当前职位：${basicInfo.current_role}
- 行业：${basicInfo.industry}
- 年限：${basicInfo.years_of_experience} 年

## 核心优势
${strengths || "暂无"}

## 待提升短板
${gaps || "暂无"}

## 职业叙事
- 主线：${basePortrait.career_narrative.main_theme}
- 转变逻辑：${basePortrait.career_narrative.transition_rationale}
- 组合优势：${basePortrait.career_narrative.composite_strength}

## 圆桌讨论中的强项维度
${keyDimensions || "暂无"}

---

请基于以上信息，评估该用户职业组合的稀缺度和市场价值。`;
}

// ============================================================
// 合并逻辑
// ============================================================

/**
 * 计算职业清晰度评分
 *
 * 基于画像完成度和圆桌讨论结果综合计算
 */
function calculateCareerClarityScore(
  basePortrait: BasePortrait,
  industrySpecific: IndustrySpecific
): number {
  let score = 0;
  let maxScore = 0;

  // 1. 基础信息完成度（40%）
  maxScore += 40;
  if (basePortrait.career_summary.motivation) score += 8;
  if (basePortrait.career_summary.value_ranking.length > 0) score += 8;
  if (basePortrait.career_summary.life_constraints) score += 8;
  if (basePortrait.career_summary.development_goal) score += 8;
  if (basePortrait.strengths.length > 0) score += 8;

  // 2. 叙事清晰度（30%）
  maxScore += 30;
  if (basePortrait.career_narrative.main_theme) score += 10;
  if (basePortrait.career_narrative.transition_rationale) score += 10;
  if (basePortrait.career_narrative.composite_strength) score += 10;

  // 3. 定制化维度丰富度（30%）
  maxScore += 30;
  const dimensionCount = Object.keys(industrySpecific).length;
  const strongCount = Object.values(industrySpecific).filter(
    (d) => d.assessment === "强"
  ).length;
  score += Math.min(15, dimensionCount * 2); // 最多 15 分
  score += Math.min(15, strongCount * 5); // 最多 15 分

  return Math.round((score / maxScore) * 100) / 100;
}

/**
 * 合并通用基础模板 + 定制化维度 → 最终画像模板
 *
 * 流程：
 * 1. 从 BasePortrait 映射通用字段
 * 2. 从 RoundtableResult 合并定制化维度
 * 3. AI 生成组合稀缺度评估
 * 4. 计算职业清晰度评分
 * 5. 组装完整 PortraitTemplate
 */
export async function mergePortrait(
  params: MergePortraitParams
): Promise<MergePortraitResult> {
  const {
    basicInfo,
    careerSegments,
    basePortrait,
    roundtableResult,
  } = params;

  // 1. 合并定制化维度
  const industrySpecific = roundtableResult.industry_specific;

  // 2. AI 生成组合稀缺度评估
  let compositeProfile: CompositeProfile;
  let compositeUsage = { inputTokens: 0, outputTokens: 0 };

  try {
    const result = await generateObject({
      model: models.qwen,
      schema: CompositeProfileSchema,
      system: COMPOSITE_SYSTEM_PROMPT,
      prompt: buildCompositePrompt(basicInfo, basePortrait, industrySpecific),
      temperature: 0.3,
    });

    compositeProfile = result.object;
    compositeUsage = {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    };
  } catch (error) {
    throw new Error(
      `组合稀缺度生成失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // 3. 计算职业清晰度评分
  const careerClarityScore = calculateCareerClarityScore(
    basePortrait,
    industrySpecific
  );

  // 4. 组装最终模板
  const portrait: PortraitTemplate = {
    schema_version: 1,
    basic_info: basicInfo,
    career_summary: basePortrait.career_summary,
    strengths: basePortrait.strengths,
    gaps: basePortrait.gaps,
    career_segments: careerSegments,
    career_narrative: basePortrait.career_narrative,
    composite_profile: compositeProfile,
    industry_specific: industrySpecific,
    ai_capability: basePortrait.ai_capability,
    career_clarity_score: careerClarityScore,
    meta: {
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sources: ["resume", "dialogue", "roundtable", "inference"],
      overall_confidence: "medium",
    },
  };

  return {
    portrait,
    usage: compositeUsage,
  };
}

// ============================================================
// 持久化
// ============================================================

/**
 * 保存画像到数据库
 *
 * Portrait 表结构：
 * - portraitJson: 完整职业画像（JSON 字符串）
 * - templateJson: 动态模板（可选）
 * - completion: 完成度 0-1
 */
export async function savePortrait(
  userId: string,
  portrait: PortraitTemplate,
  db: {
    portrait: {
      upsert: (args: {
        where: { userId: string };
        create: { userId: string; portraitJson: string; completion: number };
        update: { portraitJson: string; completion: number; updatedAt: Date };
      }) => Promise<unknown>;
    };
  }
): Promise<void> {
  const completion = calculateCompletionFromPortrait(portrait);

  await db.portrait.upsert({
    where: { userId },
    create: {
      userId,
      portraitJson: JSON.stringify(portrait),
      completion,
    },
    update: {
      portraitJson: JSON.stringify(portrait),
      completion,
      updatedAt: new Date(),
    },
  });
}

/**
 * 从画像模板计算完成度
 *
 * 基于关键字段的填充情况
 */
function calculateCompletionFromPortrait(portrait: PortraitTemplate): number {
  let filled = 0;
  let total = 0;

  // 基础信息（权重 20%）
  total += 4;
  if (portrait.basic_info.current_role) filled++;
  if (portrait.basic_info.industry) filled++;
  if (portrait.basic_info.years_of_experience > 0) filled++;
  if (portrait.basic_info.city) filled++;

  // 职业摘要（权重 30%）
  total += 5;
  if (portrait.career_summary.motivation) filled++;
  if (portrait.career_summary.value_ranking.length > 0) filled++;
  if (portrait.career_summary.risk_tolerance) filled++;
  if (portrait.career_summary.life_constraints) filled++;
  if (portrait.career_summary.development_goal) filled++;

  // 优势短板（权重 10%）
  total += 2;
  if (portrait.strengths.length > 0) filled++;
  if (portrait.gaps.length > 0) filled++;

  // 叙事（权重 15%）
  total += 3;
  if (portrait.career_narrative.main_theme) filled++;
  if (portrait.career_narrative.transition_rationale) filled++;
  if (portrait.career_narrative.composite_strength) filled++;

  // 定制化维度（权重 25%）
  total += 1;
  if (portrait.industry_specific && Object.keys(portrait.industry_specific).length > 0) {
    filled++;
  }

  return Math.round((filled / total) * 100) / 100;
}
