/**
 * neat-freak 画像提炼器
 *
 * 对比「对话信息」与「现有画像」，识别三类变化：
 * - new：画像中没有的新信息
 * - updated：画像中有，但值变了
 * - contradicted：画像中有，但用户明确说了不同的事
 *
 * 基于 SPEC.md §11.4 neat-freak 机制
 */

import { generateObject } from "ai";
import { z } from "zod";
import { models } from "@/lib/ai";
import type { PortraitTemplate } from "./schema";
import { db } from "@/lib/db";

// ============================================================
// 类型定义
// ============================================================

/** 单个变更 */
export interface PortraitChange {
  /** 字段路径，如 "career_summary.motivation" */
  field: string;
  /** 变更类型 */
  changeType: "new" | "updated" | "contradicted";
  /** 新值 */
  newValue: unknown;
  /** 当前值（updated/contradicted 时有值） */
  currentValue?: unknown;
  /** 对话中的原话证据 */
  evidence: string;
  /** 置信度 */
  confidence: "high" | "medium" | "low";
}

/** 提炼结果 */
export interface ExtractorResult {
  /** 变更列表 */
  changes: PortraitChange[];
  /** 一句话摘要 */
  summary: string;
  /** Token 使用量 */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ============================================================
// AI Schema（结构化输出约束）
// ============================================================

const ChangeSchema = z.object({
  field: z
    .string()
    .describe(
      "字段路径，如 career_summary.motivation、strengths、gaps、career_narrative.main_theme"
    ),
  changeType: z
    .enum(["new", "updated", "contradicted"])
    .describe("变更类型：new=新增, updated=更新, contradicted=矛盾"),
  newValue: z
    .union([z.string(), z.array(z.string()), z.number()])
    .describe("新值"),
  currentValue: z
    .union([z.string(), z.array(z.string()), z.number()])
    .optional()
    .describe("当前值（updated/contradicted 时填写）"),
  evidence: z.string().describe("对话中的原话证据，引用用户原话"),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("置信度：high=用户明确说的, medium=推断的, low=猜测的"),
});

const ExtractorOutputSchema = z.object({
  changes: z.array(ChangeSchema).describe("变更列表"),
  summary: z.string().describe("一句话摘要，如'发现2个新增、1个更新'"),
});

// ============================================================
// System Prompt
// ============================================================

const EXTRACTOR_SYSTEM_PROMPT = `你是一个职业画像提炼专家。你的任务是对比「用户现有画像」和「最近对话记录」，识别需要更新的信息。

## 可追踪字段
以下是画像中可以追踪的字段（只分析这些字段）：

基础信息：
- basic_info.current_role（当前职位）
- basic_info.industry（所在行业）
- basic_info.years_of_experience（工作年限）
- basic_info.city（所在城市）
- basic_info.education（最高学历）
- basic_info.company（当前公司）

职业摘要：
- career_summary.motivation（跳槽动机）
- career_summary.value_ranking（价值排序，数组）
- career_summary.risk_tolerance（风险承受度：低/中/高）
- career_summary.life_constraints（生活约束）
- career_summary.development_goal（3年发展目标）

优势短板：
- strengths（核心优势，数组）
- gaps（待提升短板，数组）

职业叙事：
- career_narrative.main_theme（贯穿主线）
- career_narrative.transition_rationale（转变逻辑）
- career_narrative.composite_strength（组合优势）

AI 能力：
- ai_capability.ai_literacy（AI素养自评）
- ai_capability.replacement_risk（AI替代风险：强/中/弱）
- ai_capability.enhancement_opportunity（AI增效机会：强/中/弱）
- ai_capability.skill_gap（AI技能缺口，数组）

## 分类规则

### new（新增）
对话中提到了某信息，但画像中该字段为空/空数组/默认值。
例：画像中 motivation 为空，对话中用户说了跳槽动机。

### updated（更新）
对话中提到了某信息，画像中已有值，AI 判断是同一维度的新信息（更准确/更详细）。
例：画像中 motivation 是"想涨薪"，对话中用户详细说了"希望薪资涨30%，因为家庭开支增加"。

### contradicted（矛盾）
对话中用户明确说了与画像不同的事，或者之前的推断被推翻。
例：画像中 risk_tolerance 是"高"，对话中用户说"我不太能接受风险"。
例：画像中 motivation 是"想转行"，对话中用户说"我其实不想转行，只是想换个公司"。

## 输出原则
1. 只输出有变化的字段，没变化的不要输出
2. evidence 必须引用用户原话（截取关键部分即可）
3. 数组字段（strengths/gaps/value_ranking/skill_gap）如果是整体更新，newValue 返回完整新数组
4. confidence 依据：用户明确说=high, 从对话推断=medium, 猜测=low
5. 不要过度推断，只提取用户确实表达过的信息`;

// ============================================================
// 构建用户 Prompt
// ============================================================

function buildExtractorPrompt(
  currentPortrait: PortraitTemplate,
  messages: Array<{ role: string; content: string }>
): string {
  // 构建画像摘要（只包含可追踪字段的当前值）
  const portraitSummary = buildPortraitSummary(currentPortrait);

  // 构建对话摘要（最近 20 条消息，每条截取 300 字）
  const dialogueText = messages
    .slice(-20)
    .map((msg) => {
      const role = msg.role === "user" ? "用户" : "AI";
      const content =
        msg.content.length > 300
          ? msg.content.slice(0, 300) + "..."
          : msg.content;
      return `${role}: ${content}`;
    })
    .join("\n");

  return `## 用户现有画像
${portraitSummary}

## 最近对话记录
${dialogueText}

---

请对比画像和对话，识别需要更新的字段。只输出有变化的字段。`;
}

/**
 * 构建画像可追踪字段的摘要
 */
function buildPortraitSummary(portrait: PortraitTemplate): string {
  const lines: string[] = [];

  // 基础信息
  lines.push(`- 职位：${portrait.basic_info.current_role || "未知"}`);
  lines.push(`- 行业：${portrait.basic_info.industry || "未知"}`);
  lines.push(`- 年限：${portrait.basic_info.years_of_experience} 年`);
  lines.push(`- 城市：${portrait.basic_info.city || "未知"}`);
  if (portrait.basic_info.education)
    lines.push(`- 学历：${portrait.basic_info.education}`);
  if (portrait.basic_info.company)
    lines.push(`- 公司：${portrait.basic_info.company}`);

  // 职业摘要
  lines.push(
    `- 跳槽动机：${portrait.career_summary.motivation || "未填写"}`
  );
  lines.push(
    `- 价值排序：${
      portrait.career_summary.value_ranking.length > 0
        ? portrait.career_summary.value_ranking.join("、")
        : "未填写"
    }`
  );
  lines.push(`- 风险承受度：${portrait.career_summary.risk_tolerance}`);
  lines.push(
    `- 生活约束：${portrait.career_summary.life_constraints || "未填写"}`
  );
  lines.push(
    `- 发展目标：${portrait.career_summary.development_goal || "未填写"}`
  );

  // 优势短板
  lines.push(
    `- 核心优势：${
      portrait.strengths.length > 0 ? portrait.strengths.join("、") : "未填写"
    }`
  );
  lines.push(
    `- 待提升短板：${
      portrait.gaps.length > 0 ? portrait.gaps.join("、") : "未填写"
    }`
  );

  // 职业叙事
  lines.push(
    `- 贯穿主线：${portrait.career_narrative.main_theme || "未填写"}`
  );
  lines.push(
    `- 转变逻辑：${portrait.career_narrative.transition_rationale || "未填写"}`
  );
  lines.push(
    `- 组合优势：${portrait.career_narrative.composite_strength || "未填写"}`
  );

  // AI 能力
  lines.push(
    `- AI素养：${portrait.ai_capability.ai_literacy || "未填写"}`
  );
  lines.push(`- AI替代风险：${portrait.ai_capability.replacement_risk}`);
  lines.push(
    `- AI增效机会：${portrait.ai_capability.enhancement_opportunity}`
  );
  lines.push(
    `- AI技能缺口：${
      portrait.ai_capability.skill_gap.length > 0
        ? portrait.ai_capability.skill_gap.join("、")
        : "未填写"
    }`
  );

  return lines.join("\n");
}

// ============================================================
// 核心提炼函数
// ============================================================

/**
 * 从对话中提炼画像变更
 *
 * @param currentPortrait - 用户现有画像
 * @param messages - 对话消息列表
 * @param model - AI 模型（默认 qwen）
 * @returns 提炼结果
 */
export async function extractPortraitChanges(params: {
  currentPortrait: PortraitTemplate;
  messages: Array<{ role: string; content: string }>;
  model?: Parameters<typeof generateObject>[0]["model"];
}): Promise<ExtractorResult> {
  const { currentPortrait, messages, model = models.qwen } = params;

  const result = await generateObject({
    model,
    schema: ExtractorOutputSchema,
    system: EXTRACTOR_SYSTEM_PROMPT,
    prompt: buildExtractorPrompt(currentPortrait, messages),
    temperature: 0.2,
  });

  return {
    changes: result.object.changes as PortraitChange[],
    summary: result.object.summary,
    usage: {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    },
  };
}

// ============================================================
// 应用变更到画像
// ============================================================

/**
 * 将 new/updated 类型的变更应用到画像
 *
 * 不修改原对象，返回新 PortraitTemplate
 */
export function applyPortraitChanges(
  portrait: PortraitTemplate,
  changes: PortraitChange[]
): PortraitTemplate {
  // 只处理 new 和 updated
  const applicable = changes.filter(
    (c) => c.changeType === "new" || c.changeType === "updated"
  );

  if (applicable.length === 0) return portrait;

  // 深拷贝
  const updated: PortraitTemplate = JSON.parse(JSON.stringify(portrait));

  for (const change of applicable) {
    applySingleChange(updated, change);
  }

  // 更新 meta
  updated.meta.updated_at = new Date().toISOString();

  return updated;
}

/**
 * 允许的字段白名单
 *
 * 只有白名单内的字段才允许写入画像，防止 AI 返回意外路径覆盖关键数据
 */
const ALLOWED_FIELDS = new Set([
  // 顶层数组字段
  "strengths",
  "gaps",
  // basic_info 子字段
  "basic_info.current_role",
  "basic_info.industry",
  "basic_info.years_of_experience",
  "basic_info.city",
  "basic_info.education",
  "basic_info.company",
  // career_summary 子字段
  "career_summary.motivation",
  "career_summary.value_ranking",
  "career_summary.risk_tolerance",
  "career_summary.life_constraints",
  "career_summary.development_goal",
  // career_narrative 子字段
  "career_narrative.main_theme",
  "career_narrative.transition_rationale",
  "career_narrative.composite_strength",
  // ai_capability 子字段
  "ai_capability.ai_literacy",
  "ai_capability.replacement_risk",
  "ai_capability.enhancement_opportunity",
  "ai_capability.skill_gap",
]);

/**
 * 应用单个变更到画像
 *
 * 支持的字段路径：
 * - 嵌套对象：career_summary.motivation, ai_capability.ai_literacy
 * - 数组字段：strengths, gaps, career_summary.value_ranking, ai_capability.skill_gap
 */
function applySingleChange(
  portrait: PortraitTemplate,
  change: PortraitChange
): void {
  const { field, newValue } = change;

  // 白名单校验
  if (!ALLOWED_FIELDS.has(field)) {
    console.warn(`[extractor] 忽略非白名单字段: ${field}`);
    return;
  }

  const parts = field.split(".");

  if (parts.length === 1) {
    // 顶层字段：strengths, gaps
    const key = parts[0] as keyof PortraitTemplate;
    if (key === "strengths" || key === "gaps") {
      (portrait as Record<string, unknown>)[key] = Array.isArray(newValue)
        ? newValue
        : [newValue];
    }
    return;
  }

  if (parts.length === 2) {
    const [section, key] = parts;
    const sectionObj = (portrait as Record<string, unknown>)[section];
    if (sectionObj && typeof sectionObj === "object") {
      const target = sectionObj as Record<string, unknown>;
      // 数组类型字段
      if (key === "value_ranking" || key === "skill_gap") {
        target[key] = Array.isArray(newValue) ? newValue : [newValue];
      } else {
        target[key] = newValue;
      }
    }
    return;
  }

  // 超过2层嵌套（当前画像结构不支持）
  console.warn(`[extractor] 不支持的字段路径: ${field}（超过2层嵌套）`);
}

// ============================================================
// 存储矛盾变更到 pending_updates
// ============================================================

/**
 * 将 contradicted 类型的变更存入 pending_updates 表
 */
export async function savePendingUpdates(params: {
  userId: string;
  sessionId: string;
  changes: PortraitChange[];
}): Promise<number> {
  const { userId, sessionId, changes } = params;

  const contradicted = changes.filter(
    (c) => c.changeType === "contradicted"
  );

  if (contradicted.length === 0) return 0;

  const records = contradicted.map((change) => {
    if (change.currentValue == null) {
      console.warn(
        `[extractor] contradicted 变更缺少 currentValue: ${change.field}`
      );
    }
    return {
      userId,
      field: change.field,
      currentValue:
        change.currentValue != null
          ? JSON.stringify(change.currentValue)
          : null,
      proposedValue: JSON.stringify(change.newValue),
      source: "neat_freak",
      sessionId,
      status: "pending",
    };
  });

  await db.pendingUpdate.createMany({ data: records });
  return records.length;
}

// ============================================================
// 记录变更日志
// ============================================================

/**
 * 记录所有变更到 portrait_update_logs 表
 */
export type ExtractTrigger = "manual" | "dialogue_round" | "session_end";

export async function savePortraitUpdateLog(params: {
  userId: string;
  sessionId: string;
  changes: PortraitChange[];
  trigger?: ExtractTrigger;
}): Promise<void> {
  const { userId, sessionId, changes, trigger = "manual" } = params;

  if (changes.length === 0) return;

  await db.portraitUpdateLog.create({
    data: {
      userId,
      sessionId,
      trigger,
      changes: JSON.stringify(changes),
    },
  });
}
