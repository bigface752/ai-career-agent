/**
 * 圆桌讨论模块
 *
 * 4 Agent 并发生成 industry_specific 维度
 *
 * 架构：
 * 1. schema.ts — 类型定义和验证
 * 2. prompts.ts — 4 个 Agent 的 prompt 模板
 * 3. generator.ts — 并发调用 + 结果合并
 * 4. index.ts — 统一导出
 */

// Schema 类型
export type {
  DimensionItem,
  PsychologistOutput,
  IndustryDirectorOutput,
  CareerMentorOutput,
  AiExpertOutput,
  AgentContribution,
  RoundtableResult,
  RoundtableInput,
} from "./schema";

export {
  DimensionItemSchema,
  PsychologistOutputSchema,
  IndustryDirectorOutputSchema,
  CareerMentorOutputSchema,
  AiExpertOutputSchema,
} from "./schema";

// Prompt 模板
export { prompts, agentConfig } from "./prompts";

// 生成器
export { generateRoundtable } from "./generator";
