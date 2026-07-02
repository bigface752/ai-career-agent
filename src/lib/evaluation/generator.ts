/**
 * 竞争力评估生成器
 *
 * 5 Agent × 3 运行 = 15 次并发调用 → 共识聚合 → 定性评级
 *
 * 架构：
 * 1. 5 个 Agent 各自独立运行 3 次取共识
 * 2. Agent 间用 Promise.allSettled 并发
 * 3. 单 Agent 内部串行（共识语义要求）
 * 4. 加权聚合 → 整体评级
 * 5. 合并优势/短板
 */

import { models } from "@/lib/ai";
import {
  MarketBenchmarkOutputSchema,
  HeadhunterOutputSchema,
  CareerMentorOutputSchema,
  AiExpertOutputSchema,
  PsychologistOutputSchema,
  type EvaluationInput,
  type EvaluationResult,
  type AgentRunResult,
  type MarketBenchmarkOutput,
  type HeadhunterOutput,
  type CareerMentorOutput,
  type AiExpertOutput,
  type PsychologistOutput,
  type AgentEvaluation,
} from "./schema";
import { evaluationPrompts, evaluationAgentConfig } from "./prompts";
import { runWithConsensus, type ConsensusResult } from "./consensus";
import { getAgentWeightsForAggregation, mapScoreToRating } from "./bars";
import { runSynthesisPhase } from "./synthesis";

// ============================================================
// 默认失败输出
// ============================================================

/**
 * 创建 Agent 失败时的默认输出
 *
 * 返回带默认值的完整对象，避免下游访问 undefined
 */
function createFailedOutput(agentId: string, error: string): AgentEvaluation {
  return {
    agent_id: agentId,
    rating: "中",
    confidence: "low",
    composite_score: 0.5,
    dimensions: [],
    summary: `评估失败：${error}`,
    strengths: [],
    weaknesses: [],
  };
}

// ============================================================
// 单个 Agent 评估（3 次运行 + 共识）
// ============================================================

/**
 * 运行单个 Agent 的完整评估（3 次 + 共识）
 */
async function evaluateWithAgent<T extends { rating: string }>(
  agentKey: keyof typeof evaluationAgentConfig,
  schema: Parameters<typeof runWithConsensus<T>>[4],
  input: EvaluationInput
): Promise<AgentRunResult<T>> {
  const config = evaluationAgentConfig[agentKey];
  const prompt = evaluationPrompts[agentKey];

  try {
    // 动态构建 System Prompt（支持按岗位差异化权重）
    const systemPrompt = prompt.buildSystemPrompt(input.positionId);

    const consensus = await runWithConsensus<T>(
      config.id,
      models[config.model],
      systemPrompt,
      prompt.buildUserPrompt(input),
      schema,
      config.temperature
    );

    return {
      agent_id: config.id,
      output: consensus.output,
      usage: consensus.total_usage,
      duration_ms: consensus.total_duration_ms,
      success: true,
    };
  } catch (error) {
    // 单 Agent 失败不阻塞整体评估
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      agent_id: config.id,
      output: createFailedOutput(config.id, errorMsg) as unknown as T,
      usage: {},
      duration_ms: 0,
      success: false,
      error: errorMsg,
    };
  }
}

// ============================================================
// 并发运行 5 个 Agent
// ============================================================

/**
 * 并发运行 5 个 Agent 的评估
 *
 * 使用 Promise.allSettled 保证单个 Agent 失败不阻塞整体
 */
async function runAllAgents(input: EvaluationInput) {
  const [
    marketBenchmark,
    headhunter,
    careerMentor,
    aiExpert,
    psychologist,
  ] = await Promise.allSettled([
    evaluateWithAgent<MarketBenchmarkOutput>(
      "market_benchmark",
      MarketBenchmarkOutputSchema,
      input
    ),
    evaluateWithAgent<HeadhunterOutput>(
      "headhunter",
      HeadhunterOutputSchema,
      input
    ),
    evaluateWithAgent<CareerMentorOutput>(
      "career_mentor",
      CareerMentorOutputSchema,
      input
    ),
    evaluateWithAgent<AiExpertOutput>(
      "ai_expert",
      AiExpertOutputSchema,
      input
    ),
    evaluateWithAgent<PsychologistOutput>(
      "psychologist",
      PsychologistOutputSchema,
      input
    ),
  ]);

  return {
    marketBenchmark,
    headhunter,
    careerMentor,
    aiExpert,
    psychologist,
  };
}

// ============================================================
// 结果提取
// ============================================================

/**
 * 从 Promise.allSettled 结果中提取 Agent 结果
 */
function extractResult<T>(
  result: PromiseSettledResult<AgentRunResult<T>>,
  agentId: string
): AgentRunResult<T> {
  if (result.status === "fulfilled") {
    return result.value;
  }

  // 失败时返回带默认值的完整对象
  const errorMsg = String(result.reason);
  return {
    agent_id: agentId,
    output: createFailedOutput(agentId, errorMsg) as unknown as T,
    usage: {},
    duration_ms: 0,
    success: false,
    error: errorMsg,
  };
}

// ============================================================
// 整体评级聚合
// ============================================================

/**
 * 从 5 个 Agent 的结果中计算整体评级
 *
 * 加权平均：每个 Agent 的 composite_score × Agent 权重
 */
function aggregateOverallRating(
  agents: EvaluationResult["agents"],
  positionId?: string
): {
  overall_rating: "强" | "中" | "弱";
  overall_score: number;
  overall_confidence: "high" | "medium" | "low";
} {
  // 从配置加载权重（支持按岗位差异化）
  const agentWeights = getAgentWeightsForAggregation(positionId);

  let weightedSum = 0;
  let totalWeight = 0;
  let lowConfidenceCount = 0;

  const agentEntries = Object.entries(agents) as [
    string,
    AgentRunResult<{ composite_score: number; confidence: string }>
  ][];

  for (const [key, agent] of agentEntries) {
    if (agent.success && agent.output.composite_score !== undefined) {
      const weight = agentWeights[key];
      if (weight === undefined) {
        console.warn(`Missing agent weight for "${key}", skipping`);
        continue;
      }
      weightedSum += agent.output.composite_score * weight;
      totalWeight += weight;

      if (agent.output.confidence === "low") {
        lowConfidenceCount++;
      }
    }
  }

  // 没有成功结果时默认 "中"
  if (totalWeight === 0) {
    return { overall_rating: "中", overall_score: 0.5, overall_confidence: "low" };
  }

  const overallScore = weightedSum / totalWeight;
  const overallRating = mapScoreToRating(overallScore);

  // 置信度：如果多数 Agent 置信度低，整体也低
  const overallConfidence =
    lowConfidenceCount >= 3 ? "low" : lowConfidenceCount >= 1 ? "medium" : "high";

  return {
    overall_rating: overallRating,
    overall_score: overallScore,
    overall_confidence: overallConfidence,
  };
}

// ============================================================
// 优势/短板合并
// ============================================================

/**
 * 从 5 个 Agent 的结果中合并优势和短板
 *
 * 策略：去重 + 按频率排序
 */
function mergeStrengthsAndWeaknesses(
  agents: EvaluationResult["agents"]
): {
  strengths: string[];
  weaknesses: string[];
} {
  const strengthCounts = new Map<string, number>();
  const weaknessCounts = new Map<string, number>();

  const agentEntries = Object.values(agents) as AgentRunResult<{
    strengths?: string[];
    weaknesses?: string[];
  }>[];

  for (const agent of agentEntries) {
    if (agent.success && agent.output) {
      if (agent.output.strengths) {
        for (const s of agent.output.strengths) {
          strengthCounts.set(s, (strengthCounts.get(s) || 0) + 1);
        }
      }
      if (agent.output.weaknesses) {
        for (const w of agent.output.weaknesses) {
          weaknessCounts.set(w, (weaknessCounts.get(w) || 0) + 1);
        }
      }
    }
  }

  // 按频率排序，取 Top 3
  const strengths = Array.from(strengthCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([s]) => s);

  const weaknesses = Array.from(weaknessCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w);

  return { strengths, weaknesses };
}

/**
 * 生成一句话定位
 */
function generateOneSentence(
  overallRating: "强" | "中" | "弱",
  agents: EvaluationResult["agents"]
): string {
  // 收集各 Agent 的 summary
  const summaries: string[] = [];

  const agentEntries = Object.values(agents) as AgentRunResult<{
    summary?: string;
  }>[];

  for (const agent of agentEntries) {
    if (agent.success && agent.output?.summary) {
      summaries.push(agent.output.summary);
    }
  }

  if (summaries.length === 0) {
    return `综合竞争力评估：${overallRating}`;
  }

  // 取第一个成功的 summary 作为基础
  return summaries[0];
}

// ============================================================
// 总 token 使用量
// ============================================================

function calculateTotalUsage(
  agents: EvaluationResult["agents"]
): { inputTokens: number; outputTokens: number } {
  let inputTokens = 0;
  let outputTokens = 0;

  const agentEntries = Object.values(agents) as AgentRunResult<{
    [key: string]: unknown;
  }>[];

  for (const agent of agentEntries) {
    if (agent.usage) {
      inputTokens += agent.usage.inputTokens || 0;
      outputTokens += agent.usage.outputTokens || 0;
    }
  }

  return { inputTokens, outputTokens };
}

// ============================================================
// 主函数：生成评估结果
// ============================================================

/**
 * 运行竞争力评估
 *
 * E1：5 Agent × 3 运行 → 共识聚合 → 定性评级
 * E2：交叉质疑 → 综合共识（可选）
 *
 * @param input 评估输入
 * @param enableSynthesis 是否启用 E2 圆桌讨论综合（默认 true）
 */
export async function runEvaluation(
  input: EvaluationInput,
  enableSynthesis: boolean = true
): Promise<EvaluationResult> {
  const startTime = Date.now();

  // ========== E1：独立评估 ==========

  // 1. 并发运行 5 个 Agent
  const settled = await runAllAgents(input);

  // 2. 提取结果
  const agents: EvaluationResult["agents"] = {
    market_benchmark: extractResult(settled.marketBenchmark, "market_benchmark"),
    headhunter: extractResult(settled.headhunter, "headhunter"),
    career_mentor: extractResult(settled.careerMentor, "career_mentor"),
    ai_expert: extractResult(settled.aiExpert, "ai_expert"),
    psychologist: extractResult(settled.psychologist, "psychologist"),
  };

  // 3. 聚合整体评级（支持按岗位差异化权重）
  const { overall_rating, overall_score, overall_confidence } =
    aggregateOverallRating(agents, input.positionId);

  // 4. 合并优势/短板
  const { strengths, weaknesses } = mergeStrengthsAndWeaknesses(agents);

  // 5. 生成一句话定位
  const one_sentence = generateOneSentence(overall_rating, agents);

  // 6. 计算 E1 token 使用量
  const e1Usage = calculateTotalUsage(agents);

  // ========== E2：圆桌讨论综合 ==========

  let synthesis: EvaluationResult["synthesis"];

  if (enableSynthesis) {
    try {
      const e1Result: EvaluationResult = {
        overall_rating,
        overall_score,
        overall_confidence,
        one_sentence,
        agents,
        strengths,
        weaknesses,
        total_usage: e1Usage,
        total_duration_ms: Date.now() - startTime,
      };

      const synthesisResult = await runSynthesisPhase(e1Result, input);
      synthesis = synthesisResult;

      // 用综合共识的结果覆盖 E1 的聚合结果
      // 但保留 E1 的 agents 原始数据（供前端展示对比）
      return {
        overall_rating: synthesisResult.synthesis.overall_rating,
        overall_score: synthesisResult.synthesis.overall_score,
        overall_confidence: synthesisResult.synthesis.overall_confidence,
        one_sentence: synthesisResult.synthesis.one_sentence,
        agents,
        strengths: synthesisResult.synthesis.revised_strengths,
        weaknesses: synthesisResult.synthesis.revised_weaknesses,
        synthesis,
        total_usage: {
          inputTokens: e1Usage.inputTokens + synthesisResult.total_usage.inputTokens,
          outputTokens: e1Usage.outputTokens + synthesisResult.total_usage.outputTokens,
        },
        total_duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      // E2 失败不阻塞：降级为 E1 结果
      console.error(
        "E2 synthesis failed, falling back to E1 result:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return {
    overall_rating,
    overall_score,
    overall_confidence,
    one_sentence,
    agents,
    strengths,
    weaknesses,
    synthesis,
    total_usage: e1Usage,
    total_duration_ms: Date.now() - startTime,
  };
}
