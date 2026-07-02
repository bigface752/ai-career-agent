/**
 * 3 次运行共识逻辑
 *
 * 基于 SPEC.md §11.3 Step 5：
 * - 运行 3 次评估，取多数评级
 * - 若 3 次结果不一致（如 强/中/弱 各一次），取中间值并标记 confidence=low
 *
 * 实现策略：
 * - 单 Agent 内部 3 次串行调用
 * - 每次独立评估，不受前次结果影响
 * - majorityVote 函数处理共识算法
 */

import { generateObject, type LanguageModel } from "ai";
import type { z } from "zod";

// ============================================================
// 类型定义
// ============================================================

/** 评级等级 */
type Rating = "强" | "中" | "弱";

/** 置信度 */
type Confidence = "high" | "medium" | "low";

/** 单次运行结果 */
interface SingleRunResult<T> {
  output: T;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
  };
  duration_ms: number;
}

/** 共识结果 */
export interface ConsensusResult<T> {
  /** 共识后的输出（取中间那次的结果） */
  output: T;
  /** 共识评级 */
  rating: Rating;
  /** 置信度 */
  confidence: Confidence;
  /** 3 次运行的评级 */
  runs: [Rating, Rating, Rating];
  /** 3 次运行的完整结果 */
  all_outputs: [T, T, T];
  /** 总 token 使用量 */
  total_usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** 总耗时（毫秒） */
  total_duration_ms: number;
}

// ============================================================
// 共识算法
// ============================================================

/**
 * 多数投票共识算法
 *
 * 基于 SPEC.md §11.3 Step 5：
 * - 2+ 次一致 → 取该评级，confidence=high
 * - 3 次各不同 → 取中间值，confidence=low
 */
export function majorityVote(
  runs: [Rating, Rating, Rating]
): { rating: Rating; confidence: Confidence } {
  const counts: Record<Rating, number> = { 强: 0, 中: 0, 弱: 0 };
  runs.forEach((r) => counts[r]++);

  // 找到出现次数最多的评级
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topRating, topCount] = sorted[0];

  // 2+ 次一致 → 高置信度
  if (topCount >= 2) {
    return { rating: topRating as Rating, confidence: "high" };
  }

  // 3 次各不同 → 取中间值，低置信度
  return { rating: "中", confidence: "low" };
}

/**
 * 从 3 次运行结果中选择代表输出
 *
 * 取与共识评级一致的那次结果
 * 若 3 次各不同，取中间那次
 */
function selectRepresentativeOutput<T extends { rating: string }>(
  outputs: [T, T, T],
  runs: [Rating, Rating, Rating],
  consensusRating: Rating
): T {
  // 找到与共识评级一致的那次
  for (let i = 0; i < 3; i++) {
    if (runs[i] === consensusRating) {
      return outputs[i];
    }
  }

  // 兜底：取中间那次
  return outputs[1];
}

// ============================================================
// 单次 Agent 调用
// ============================================================

/**
 * 调用单个 Agent 一次
 */
async function callAgentOnce<T>(
  agentId: string,
  model: LanguageModel,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>,
  temperature: number
): Promise<SingleRunResult<T>> {
  const startTime = Date.now();

  const result = await generateObject({
    model,
    schema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature,
    abortSignal: AbortSignal.timeout(30_000), // 30s 超时
  });

  return {
    output: result.object as T,
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    },
    duration_ms: Date.now() - startTime,
  };
}

// ============================================================
// 3 次运行共识
// ============================================================

/**
 * 运行 3 次评估并取共识
 *
 * 策略：串行运行（避免并发时 prompt 互相影响）
 * 失败处理：单次失败不影响其他运行，若全部失败则抛出错误
 */
export async function runWithConsensus<T extends { rating: string }>(
  agentId: string,
  model: LanguageModel,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>,
  temperature: number
): Promise<ConsensusResult<T>> {
  const startTime = Date.now();
  const outputs: T[] = [];
  const runs: Rating[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // 串行运行 3 次
  for (let i = 0; i < 3; i++) {
    try {
      const result = await callAgentOnce(
        agentId,
        model,
        systemPrompt,
        userPrompt,
        schema,
        temperature
      );

      outputs.push(result.output);
      runs.push(result.output.rating as Rating);
      totalInputTokens += result.usage.inputTokens || 0;
      totalOutputTokens += result.usage.outputTokens || 0;
    } catch (error) {
      // 单次失败：记录为 "中" 评级，继续其他运行
      console.error(
        `Agent ${agentId} run ${i + 1} failed:`,
        error instanceof Error ? error.message : String(error)
      );

      // 如果已有 2 次成功结果，可以用默认值填充
      if (outputs.length >= 2) {
        // 不再尝试，直接用已有结果
        break;
      }

      // 如果全部失败，抛出错误
      if (i === 2 && outputs.length === 0) {
        throw new Error(
          `Agent ${agentId} failed all 3 runs: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  // 至少需要 1 次成功结果
  if (outputs.length === 0) {
    throw new Error(`Agent ${agentId} failed all 3 runs`);
  }

  // 如果只有 1 次成功，用该结果作为共识
  if (outputs.length === 1) {
    return {
      output: outputs[0],
      rating: runs[0],
      confidence: "low",
      runs: [runs[0], runs[0], runs[0]],
      all_outputs: [outputs[0], outputs[0], outputs[0]],
      total_usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
      total_duration_ms: Date.now() - startTime,
    };
  }

  // 如果只有 2 次成功，用 2 次结果取共识
  // 规则：相同 → 取该评级 high；不同 → 取中间值 low
  if (outputs.length === 2) {
    let rating: Rating;
    let confidence: Confidence;

    if (runs[0] === runs[1]) {
      rating = runs[0];
      confidence = "high";
    } else {
      // 不同评级 → 取中间值
      const ratingOrder: Rating[] = ["弱", "中", "强"];
      const idx0 = ratingOrder.indexOf(runs[0]);
      const idx1 = ratingOrder.indexOf(runs[1]);
      rating = ratingOrder[Math.round((idx0 + idx1) / 2)];
      confidence = "low";
    }

    return {
      output: selectRepresentativeOutput(
        [outputs[0], outputs[1], outputs[1]],
        [runs[0], runs[1], runs[1]],
        rating
      ),
      rating,
      confidence,
      runs: [runs[0], runs[1], runs[1]],
      all_outputs: [outputs[0], outputs[1], outputs[1]],
      total_usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
      total_duration_ms: Date.now() - startTime,
    };
  }

  // 3 次全部成功
  const fullRuns: [Rating, Rating, Rating] = [runs[0], runs[1], runs[2]];
  const { rating, confidence } = majorityVote(fullRuns);

  return {
    output: selectRepresentativeOutput(
      [outputs[0], outputs[1], outputs[2]],
      fullRuns,
      rating
    ),
    rating,
    confidence,
    runs: fullRuns,
    all_outputs: [outputs[0], outputs[1], outputs[2]],
    total_usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    },
    total_duration_ms: Date.now() - startTime,
  };
}
