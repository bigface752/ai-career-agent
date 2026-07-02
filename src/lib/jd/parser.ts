/**
 * JD 解析器
 * 职责：非结构化 JD 文本 → 结构化岗位要求
 * 模式：generateObject + Zod（与 dialogue/message 一致）
 */
import { generateObject } from "ai";
import { models } from "@/lib/ai";
import { ParsedJdSchema, type ParsedJd } from "./schema";
import { loadPositionKnowledge } from "@/lib/knowledge/loader";

// ============================================================
// System Prompts
// ============================================================

const SYSTEM_PROMPT_TEXT = `你是一个专业的岗位分析师。用户会给你一段JD（职位描述）文字，你需要解析并提取结构化的岗位要求。

规则：
1. 从JD原文中提取信息，不要编造
2. 如果某些信息JD中未提及，填写"未提及"
3. 薪资范围如果未明确，填写"未提及"
4. skills 提取最核心的 3-6 项
5. nice_to_have 提取加分项，如果JD中没有明确区分，留空数组
6. key_challenges 提取岗位面临的核心挑战（通常在"岗位职责"或"工作描述"中）
7. company_type 从公司描述中推断，如"某B2B SaaS公司"→"B2B SaaS"`;

const SYSTEM_PROMPT_POSITION = `用户只输入了一个岗位名称，没有完整JD。请基于行业常识推断该岗位的典型要求。

规则：
1. 基于该岗位在B2B企业软件行业的通用情况推断
2. 每个字段都要填写，但标注为推断
3. 推断要合理，不要过度发散
4. 如果有参考知识卡，优先使用知识卡中的数据`;

// ============================================================
// 知识卡匹配（模糊输入时补充行业常识）
// ============================================================

// 中文关键词 → position_id 映射
const KEYWORD_MAP: Record<string, string> = {
  销售: "b2b-sales",
  售前: "b2b-sales",
  客户成功: "b2b-sales",
  BD: "b2b-sales",
  数据分析: "data-analyst",
  BI: "data-analyst",
  数据运营: "data-analyst",
  产品营销: "pmm",
  PMM: "pmm",
};

function matchPositionFromKeyword(text: string): string | null {
  for (const [keyword, positionId] of Object.entries(KEYWORD_MAP)) {
    if (text.includes(keyword)) {
      return positionId;
    }
  }
  return null;
}

// ============================================================
// 核心解析函数
// ============================================================

export interface ParseJdResult {
  parsed: ParsedJd;
  confidence: "high" | "low";
  note: string | null;
}

/**
 * 解析 JD 文本或岗位名
 * @param jdText JD 文字或岗位名
 * @param inputMethod 解析方式：text=完整JD，position_name=仅岗位名
 */
export async function parseJd(
  jdText: string,
  inputMethod: "text" | "position_name"
): Promise<ParseJdResult> {
  const isPositionName = inputMethod === "position_name";
  const systemPrompt = isPositionName
    ? SYSTEM_PROMPT_POSITION
    : SYSTEM_PROMPT_TEXT;

  // 模糊输入时尝试加载知识卡（失败不阻塞核心解析）
  let knowledgeContext = "";
  if (isPositionName) {
    const positionId = matchPositionFromKeyword(jdText);
    if (positionId) {
      try {
        const card = loadPositionKnowledge(positionId);
        if (card) {
          knowledgeContext = `\n\n参考知识卡（${card.display_name}）：\n${JSON.stringify(card, null, 2)}`;
        }
      } catch (e) {
        console.warn("[parse-jd] Failed to load knowledge card:", e);
      }
    }
  }

  const result = await generateObject({
    model: models.mimo,
    schema: ParsedJdSchema,
    system: systemPrompt,
    prompt: `请解析以下${isPositionName ? "岗位名称" : "JD"}：\n\n${jdText}${knowledgeContext}`,
    temperature: 0.1,
  });

  return {
    parsed: result.object as ParsedJd,
    confidence: isPositionName ? "low" : "high",
    note: isPositionName
      ? "以下为基于行业常识的推断结果，可能与实际JD有差异"
      : null,
  };
}
