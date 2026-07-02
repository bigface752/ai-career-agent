/**
 * 竞争力评估模块
 *
 * E1：5 Agent 独立评估，BARS rubric + CoT + 3 次共识
 * E2：圆桌讨论综合，交叉质疑 → 综合共识
 *
 * 架构：
 * 1. schema.ts — 类型定义和验证（含 E2 交叉质疑/综合共识 Schema）
 * 2. bars.ts — BARS rubric 定义（维度、权重、锚定描述）
 * 3. prompts.ts — 5 个 Agent 的 prompt 模板 + E2 prompt
 * 4. consensus.ts — 3 次运行共识逻辑
 * 5. generator.ts — 主编排：E1 聚合 + E2 综合
 * 6. synthesis.ts — E2 圆桌讨论综合：交叉质疑 + 综合共识
 * 7. index.ts — 统一导出
 */

// Schema 类型
export type {
  DimensionScore,
  AgentEvaluation,
  MarketBenchmarkOutput,
  HeadhunterOutput,
  CareerMentorOutput,
  AiExpertOutput,
  PsychologistOutput,
  AgentRunResult,
  EvaluationResult,
  EvaluationInput,
  CrossExaminationItem,
  AgentCrossExamination,
  SynthesisConsensus,
  SynthesisResult,
} from "./schema";

export {
  DimensionScoreSchema,
  AgentEvaluationSchema,
  MarketBenchmarkOutputSchema,
  HeadhunterOutputSchema,
  CareerMentorOutputSchema,
  AiExpertOutputSchema,
  PsychologistOutputSchema,
  CrossExaminationItemSchema,
  AgentCrossExaminationSchema,
  SynthesisConsensusSchema,
} from "./schema";

// BARS Rubric
export {
  buildBarsRubric,
  getAllRubrics,
  getAgentWeightsForAggregation,
  mapScoreToRating,
} from "./bars";

// 权重配置
export {
  getWeightsConfig,
  getAgentWeights,
  getDimensionWeights,
  validateWeightsConfig,
} from "./config/loader";

export type { BarsDimension, BarsRubric, BarsAnchor } from "./bars";

// Prompt 模板
export { evaluationPrompts, evaluationAgentConfig } from "./prompts";

// 共识逻辑
export { runWithConsensus, majorityVote } from "./consensus";

export type { ConsensusResult } from "./consensus";

// 生成器
export { runEvaluation } from "./generator";

// E2 圆桌讨论综合
export { runSynthesisPhase } from "./synthesis";

// E2 Prompt 模板
export {
  CROSS_EXAMINATION_SYSTEM_PROMPT,
  SYNTHESIS_SYSTEM_PROMPT,
  buildCrossExaminationUserPrompt,
  buildSynthesisUserPrompt,
  synthesisAgentConfig,
} from "./prompts";
