/**
 * 知识卡加载器
 * 职责：三层数据加载 + placeholder 注入 + 过期检查
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  GlobalKnowledgeSchema,
  IndustryContextSchema,
  PositionKnowledgeSchema,
  type GlobalKnowledge,
  type IndustryContext,
  type PositionKnowledge,
} from "./schema";
import { findNearestPosition } from "./fallback";

// 知识库根目录
const KNOWLEDGE_BASE = join(
  process.cwd(),
  "kitty-specs/v1-career-cognition/agents/knowledge-base"
);
const POSITIONS_DIR = join(KNOWLEDGE_BASE, "positions");

// TTL：90 天
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

// ============================================================
// 加载函数
// ============================================================

function loadJson(filePath: string): unknown {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function isExpired(lastUpdated: string): boolean {
  const updated = new Date(lastUpdated).getTime();
  return Date.now() - updated > TTL_MS;
}

/** 加载第一层：global_knowledge.json */
export function loadGlobalKnowledge(): GlobalKnowledge {
  const path = join(KNOWLEDGE_BASE, "global_knowledge.json");
  if (!existsSync(path)) {
    throw new Error(`Global knowledge not found: ${path}`);
  }
  const data = GlobalKnowledgeSchema.parse(loadJson(path));

  if (isExpired(data.meta.last_updated)) {
    console.warn(
      `[knowledge] global_knowledge.json expired (last_updated: ${data.meta.last_updated})`
    );
  }

  return data;
}

/** 加载第二层：industry_context.json */
export function loadIndustryContext(): IndustryContext {
  const path = join(KNOWLEDGE_BASE, "industry_context.json");
  if (!existsSync(path)) {
    throw new Error(`Industry context not found: ${path}`);
  }
  const data = IndustryContextSchema.parse(loadJson(path));

  if (isExpired(data.meta.last_updated)) {
    console.warn(
      `[knowledge] industry_context.json expired (last_updated: ${data.meta.last_updated})`
    );
  }

  return data;
}

/** 加载第三层：positions/{position}.json */
export function loadPositionKnowledge(
  positionId: string
): PositionKnowledge | null {
  const path = join(POSITIONS_DIR, `${positionId}.json`);

  if (!existsSync(path)) {
    console.warn(
      `[knowledge] Position not found: ${positionId}, trying nearest match`
    );
    const nearest = findNearestPosition(positionId);
    if (!nearest) return null;
    return loadPositionKnowledge(nearest);
  }

  const data = PositionKnowledgeSchema.parse(loadJson(path));

  if (isExpired(data.meta.last_updated)) {
    console.warn(
      `[knowledge] ${positionId}.json expired (last_updated: ${data.meta.last_updated})`
    );
  }

  return data;
}

/** 加载多段经历的知识卡（最多 3 张） */
export function loadMultiPositionKnowledge(
  positionIds: string[]
): PositionKnowledge[] {
  const unique = Array.from(new Set(positionIds)).slice(0, 3);
  const results: PositionKnowledge[] = [];

  for (const id of unique) {
    const card = loadPositionKnowledge(id);
    if (card) results.push(card);
  }

  return results;
}

// ============================================================
// Placeholder 注入
// ============================================================

/** 序列化为可读文本（注入到 prompt 中） */
function serialize(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

export interface KnowledgeContext {
  global?: GlobalKnowledge;
  industry?: IndustryContext;
  positions?: PositionKnowledge[];
  company?: Record<string, unknown>;
}

/**
 * 将知识卡数据注入到 prompt 模板中
 * 替换所有 {placeholder} 为对应的序列化数据
 */
export function injectKnowledge(
  template: string,
  context: KnowledgeContext
): string {
  let result = template;

  if (context.global && result.includes("{global_knowledge}")) {
    result = result.replace(
      /\{global_knowledge\}/g,
      serialize(context.global)
    );
  }

  if (context.industry && result.includes("{industry_context}")) {
    result = result.replace(
      /\{industry_context\}/g,
      serialize(context.industry)
    );
  }

  // {knowledge_card}：单岗位时直接替换，多岗位时合并
  if (context.positions && result.includes("{knowledge_card}")) {
    if (context.positions.length === 1) {
      result = result.replace(
        /\{knowledge_card\}/g,
        serialize(context.positions[0])
      );
    } else if (context.positions.length > 1) {
      const combined = context.positions.map((p) => ({
        position_id: p.position_id,
        display_name: p.display_name,
        ai_impact: p.ai_impact,
        core_competencies: p.core_competencies,
        salary: p.salary,
        transformation_path: p.transformation_path,
      }));
      result = result.replace(/\{knowledge_card\}/g, serialize(combined));
    }
  }

  if (context.company && result.includes("{company_context}")) {
    result = result.replace(
      /\{company_context\}/g,
      serialize(context.company)
    );
  }

  return result;
}

/**
 * 完整的知识卡加载 + 注入流程
 * @param template Agent prompt 模板
 * @param positionIds 用户的岗位 ID 列表（从 career_segments 提取）
 * @param options 可选：是否加载 global/industry
 */
export function loadAndInject(
  template: string,
  positionIds: string[],
  options: {
    loadGlobal?: boolean;
    loadIndustry?: boolean;
  } = {}
): { prompt: string; context: KnowledgeContext } {
  const context: KnowledgeContext = {};

  if (options.loadGlobal !== false) {
    try {
      context.global = loadGlobalKnowledge();
    } catch (e) {
      console.warn("[knowledge] Failed to load global_knowledge:", e);
    }
  }

  if (options.loadIndustry !== false) {
    try {
      context.industry = loadIndustryContext();
    } catch (e) {
      console.warn("[knowledge] Failed to load industry_context:", e);
    }
  }

  if (positionIds.length > 0) {
    context.positions = loadMultiPositionKnowledge(positionIds);
  }

  const prompt = injectKnowledge(template, context);
  return { prompt, context };
}
