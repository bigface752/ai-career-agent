/**
 * E2：圆桌讨论综合
 *
 * 流程：
 * 1. 交叉质疑：5 个 Agent 各看其他 4 个评估结果，提出质疑（5 次 LLM）
 * 2. 综合共识：圆桌主持人读取全部评估 + 全部质疑，输出最终共识（1 次 LLM）
 *
 * 共 6 次 LLM 调用，全部并发（交叉质疑之间）+ 串行（质疑 → 综合）
 */

import { generateObject } from "ai";
import { models } from "@/lib/ai";
import {
  AgentCrossExaminationSchema,
  SynthesisConsensusSchema,
  type EvaluationInput,
  type EvaluationResult,
  type AgentEvaluation,
  type AgentRunResult,
  type AgentCrossExamination,
  type SynthesisConsensus,
  type SynthesisResult,
} from "./schema";
import {
  CROSS_EXAMINATION_SYSTEM_PROMPT,
  SYNTHESIS_SYSTEM_PROMPT,
  buildCrossExaminationUserPrompt,
  buildSynthesisUserPrompt,
  evaluationAgentConfig,
  synthesisAgentConfig,
} from "./prompts";

// ============================================================
// 工具函数
// ============================================================

/**
 * 将 EvaluationResult["agents"] 转为通用 Record 类型
 *
 * 避免多处 `as unknown as` 双重断言
 */
function toEvaluationMap(
  evaluations: EvaluationResult["agents"]
): Record<string, AgentRunResult<AgentEvaluation>> {
  return {
    market_benchmark:
      evaluations.market_benchmark as unknown as AgentRunResult<AgentEvaluation>,
    headhunter:
      evaluations.headhunter as unknown as AgentRunResult<AgentEvaluation>,
    career_mentor:
      evaluations.career_mentor as unknown as AgentRunResult<AgentEvaluation>,
    ai_expert:
      evaluations.ai_expert as unknown as AgentRunResult<AgentEvaluation>,
    psychologist:
      evaluations.psychologist as unknown as AgentRunResult<AgentEvaluation>,
  };
}

// ============================================================
// 交叉质疑：5 Agent 并发
// ============================================================

/** 单次交叉质疑调用结果 */
interface CrossExaminationCallResult {
  output: AgentCrossExamination | null;
  usage: { inputTokens: number; outputTokens: number };
}

/**
 * 单个 Agent 的交叉质疑调用
 */
async function runSingleCrossExamination(
  agentKey: keyof typeof evaluationAgentConfig,
  evaluations: Record<string, AgentRunResult<AgentEvaluation>>,
  input: EvaluationInput
): Promise<CrossExaminationCallResult> {
  const config = evaluationAgentConfig[agentKey];

  // 跳过失败的 Agent（用默认值的没有质疑价值）
  const selfResult = evaluations[agentKey];
  if (!selfResult || !selfResult.success) {
    return { output: null, usage: { inputTokens: 0, outputTokens: 0 } };
  }

  try {
    const userPrompt = buildCrossExaminationUserPrompt(
      config.id,
      evaluations,
      input
    );

    const result = await generateObject({
      model: models[config.model],
      schema: AgentCrossExaminationSchema,
      system: CROSS_EXAMINATION_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: config.temperature,
      abortSignal: AbortSignal.timeout(60_000), // 60s 超时，交叉质疑需要更多推理
    });

    return {
      output: result.object as AgentCrossExamination,
      usage: {
        inputTokens: result.usage.inputTokens || 0,
        outputTokens: result.usage.outputTokens || 0,
      },
    };
  } catch (error) {
    console.error(
      `Cross-examination failed for ${config.id}:`,
      error instanceof Error ? error.message : String(error)
    );
    return { output: null, usage: { inputTokens: 0, outputTokens: 0 } };
  }
}

/**
 * 并发运行所有 Agent 的交叉质疑
 *
 * 5 个 Agent 同时审视其他 4 个的评估结果
 */
async function runAllCrossExaminations(
  evaluations: EvaluationResult["agents"],
  input: EvaluationInput
): Promise<{
  examinations: AgentCrossExamination[];
  usage: { inputTokens: number; outputTokens: number };
}> {
  const evaluationMap = toEvaluationMap(evaluations);

  const results = await Promise.allSettled([
    runSingleCrossExamination("market_benchmark", evaluationMap, input),
    runSingleCrossExamination("headhunter", evaluationMap, input),
    runSingleCrossExamination("career_mentor", evaluationMap, input),
    runSingleCrossExamination("ai_expert", evaluationMap, input),
    runSingleCrossExamination("psychologist", evaluationMap, input),
  ]);

  const examinations: AgentCrossExamination[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (const r of results) {
    if (r.status === "fulfilled") {
      inputTokens += r.value.usage.inputTokens;
      outputTokens += r.value.usage.outputTokens;
      if (r.value.output !== null) {
        examinations.push(r.value.output);
      }
    }
  }

  return {
    examinations,
    usage: { inputTokens, outputTokens },
  };
}

// ============================================================
// 综合共识：圆桌主持人
// ============================================================

/**
 * 运行综合共识 Agent
 *
 * 读取全部评估结果 + 全部交叉质疑，输出最终裁决
 */
async function runSynthesisAgent(
  evaluations: EvaluationResult["agents"],
  crossExaminations: AgentCrossExamination[],
  input: EvaluationInput
): Promise<{
  output: SynthesisConsensus;
  usage: { inputTokens: number; outputTokens: number };
  duration_ms: number;
}> {
  const startTime = Date.now();
  const evaluationMap = toEvaluationMap(evaluations);

  const userPrompt = buildSynthesisUserPrompt(
    evaluationMap,
    crossExaminations,
    input
  );

  const result = await generateObject({
    model: models[synthesisAgentConfig.model],
    schema: SynthesisConsensusSchema,
    system: SYNTHESIS_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: synthesisAgentConfig.temperature,
    abortSignal: AbortSignal.timeout(60_000),
  });

  return {
    output: result.object as SynthesisConsensus,
    usage: {
      inputTokens: result.usage.inputTokens || 0,
      outputTokens: result.usage.outputTokens || 0,
    },
    duration_ms: Date.now() - startTime,
  };
}

// ============================================================
// 主函数：E2 圆桌讨论综合
// ============================================================

/**
 * 运行 E2 圆桌讨论综合
 *
 * 完整流程：
 * 1. E1 结果 → 5 Agent 并发交叉质疑
 * 2. 交叉质疑结果 → 综合共识 Agent 裁决
 * 3. 返回 SynthesisResult
 *
 * @param evaluationResult E1 阶段的评估结果
 * @param input 评估输入（用于构建 prompt）
 */
export async function runSynthesisPhase(
  evaluationResult: EvaluationResult,
  input: EvaluationInput
): Promise<SynthesisResult> {
  const startTime = Date.now();

  // Step 1: 交叉质疑（5 Agent 并发）
  const crossExaminationResult = await runAllCrossExaminations(
    evaluationResult.agents,
    input
  );

  // Step 2: 综合共识
  // 即使交叉质疑全部失败，也要运行综合共识（只看评估结果）
  const synthesis = await runSynthesisAgent(
    evaluationResult.agents,
    crossExaminationResult.examinations,
    input
  );

  return {
    cross_examinations:
      crossExaminationResult.examinations.length > 0
        ? crossExaminationResult.examinations
        : null,
    synthesis: synthesis.output,
    total_usage: {
      inputTokens:
        crossExaminationResult.usage.inputTokens + synthesis.usage.inputTokens,
      outputTokens:
        crossExaminationResult.usage.outputTokens +
        synthesis.usage.outputTokens,
    },
    total_duration_ms: Date.now() - startTime,
  };
}
