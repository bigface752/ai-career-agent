/**
 * 画像模板生成器
 *
 * 职业导师 Agent：从对话 SlotState 提取画像信息
 * 基于 SPEC.md §11.3 画像模板生成流程
 */

import { generateObject } from "ai";
import { models } from "@/lib/ai";
import type { SlotState } from "@/lib/dialogue/types";
import type { BasicInfo, BasePortrait } from "./schema";
import { BasePortraitSchema } from "./schema";

// ============================================================
// Prompt 模板
// ============================================================

const PORTRAIT_SYSTEM_PROMPT = `你是职业导师 Agent，负责从用户对话中提取职业画像信息。

## 你的任务
分析用户的对话记录和 Slot 状态，提取以下维度：
1. 职业摘要（动机、价值排序、风险偏好、约束、目标）
2. 核心优势（3-5 个）
3. 待提升短板（2-3 个）
4. 职业叙事（主线、转变逻辑、组合优势）
5. AI 能力评估

## 提取原则
- **只提取用户明确说过的**，不要推断或猜测
- **保留用户的原话风格**，不要过度美化
- **标记置信度**：用户直接说的=high，推断的=medium，猜测的=low
- **多段经历**：如果用户提到多段经历，分别记录

## 输出格式
严格按 JSON Schema 输出，不要添加额外字段。`;

function buildUserPrompt(
  basicInfo: BasicInfo,
  slotState: SlotState,
  recentWindow: { role: string; content: string }[]
): string {
  // 构建 Slot 摘要
  const slotSummary = Object.entries(slotState.filled)
    .map(([key, entry]) => {
      const confidence =
        entry.confidence === "high"
          ? "✓ 用户明确"
          : entry.confidence === "medium"
          ? "~ 推断"
          : "? 猜测";
      return `- ${key}: ${entry.value} [${confidence}]`;
    })
    .join("\n");

  // 构建对话摘要（最近 5 轮，每轮最多 500 字符）
  const dialogueSummary = recentWindow
    .slice(-5)
    .map((turn) => {
      const content =
        turn.content.length > 500
          ? turn.content.slice(0, 500) + "..."
          : turn.content;
      return `${turn.role === "user" ? "用户" : "AI"}: ${content}`;
    })
    .join("\n");

  return `
## 用户基础信息
- 当前职位：${basicInfo.current_role}
- 行业：${basicInfo.industry}
- 年限：${basicInfo.years_of_experience} 年
- 城市：${basicInfo.city}
${basicInfo.company ? `- 公司：${basicInfo.company}` : ""}
${basicInfo.education ? `- 学历：${basicInfo.education}` : ""}

## 已收集的 Slot 信息
${slotSummary || "暂无"}

## 最近对话
${dialogueSummary || "暂无"}

---

请基于以上信息，生成职业画像的基础部分。`;
}

// ============================================================
// 生成函数
// ============================================================

export interface GeneratePortraitParams {
  /** 用户基础信息（简历解析） */
  basicInfo: BasicInfo;
  /** 对话 Slot 状态 */
  slotState: SlotState;
  /** 最近对话窗口 */
  recentWindow: { role: string; content: string }[];
}

export interface GeneratePortraitResult {
  /** 生成的基础画像 */
  portrait: BasePortrait;
  /** Token 使用量 */
  usage: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

/**
 * 生成基础画像（职业导师 Agent）
 *
 * 从对话 Slot 提取信息，生成通用基础模板
 * 不包含定制化维度（由圆桌讨论生成）
 */
export async function generateBasePortrait(
  params: GeneratePortraitParams
): Promise<GeneratePortraitResult> {
  const { basicInfo, slotState, recentWindow } = params;

  try {
    const result = await generateObject({
      model: models.qwen, // 千问 Max
      schema: BasePortraitSchema,
      system: PORTRAIT_SYSTEM_PROMPT,
      prompt: buildUserPrompt(basicInfo, slotState, recentWindow),
      temperature: 0.3, // 低温度，稳定输出
    });

    return {
      portrait: result.object,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
    };
  } catch (error) {
    throw new Error(
      `Portrait generation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ============================================================
// Slot → 画像映射
// ============================================================

// ============================================================
// 类型守卫
// ============================================================

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && !isNaN(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === "string");
}

/**
 * 从 SlotState 直接映射基础信息
 *
 * 用于快速填充不需要 AI 推断的字段
 */
export function mapSlotsToBasicInfo(
  slotState: SlotState,
  basicInfo: BasicInfo
): BasicInfo {
  const filled = slotState.filled;

  return {
    ...basicInfo,
    // 如果 Slot 中有更准确的信息，覆盖简历解析结果
    current_role: isString(filled.current_role?.value)
      ? filled.current_role.value
      : basicInfo.current_role,
    industry: isString(filled.industry?.value)
      ? filled.industry.value
      : basicInfo.industry,
    years_of_experience: isNumber(filled.years_of_experience?.value)
      ? filled.years_of_experience.value
      : basicInfo.years_of_experience,
    city: isString(filled.city?.value)
      ? filled.city.value
      : basicInfo.city,
  };
}

/**
 * 从 SlotState 直接映射职业摘要
 *
 * 用于快速填充，避免 AI 调用
 */
export function mapSlotsToCareerSummary(
  slotState: SlotState
): BasePortrait["career_summary"] {
  const filled = slotState.filled;

  const riskValue = filled.risk_tolerance?.value;
  const validRiskLevels: Array<"低" | "中" | "高"> = ["低", "中", "高"];
  const risk_tolerance = validRiskLevels.includes(riskValue as "低" | "中" | "高")
    ? (riskValue as "低" | "中" | "高")
    : "中";

  return {
    motivation: isString(filled.motivation?.value) ? filled.motivation.value : "",
    value_ranking: isStringArray(filled.value_ranking?.value)
      ? filled.value_ranking.value
      : [],
    risk_tolerance,
    life_constraints: isString(filled.life_constraints?.value)
      ? filled.life_constraints.value
      : "",
    development_goal: isString(filled.development_goal?.value)
      ? filled.development_goal.value
      : "",
  };
}
