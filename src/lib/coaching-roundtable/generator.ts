/**
 * 模块零圆桌讨论生成器
 *
 * 4 Agent 并发 + 1 主持 Agent 综合
 * 基于 module-0-career-coaching.md 设计
 */

import { generateObject, type LanguageModel } from "ai";
import { models } from "@/lib/ai";
import {
  CareerMentorOutputSchema,
  HeadhunterOutputSchema,
  BigTechExpertOutputSchema,
  AiExpertOutputSchema,
  HostSynthesisSchema,
  type CoachingRoundtableInput,
  type CoachingRoundtableResult,
  type AgentContribution,
  type CareerMentorOutput,
  type HeadhunterOutput,
  type BigTechExpertOutput,
  type AiExpertOutput,
  type HostSynthesis,
} from "./schema";
import { prompts, agentConfig } from "./prompts";

// ============================================================
// 单个 Agent 调用
// ============================================================

async function callAgent<T>(
  agentId: string,
  model: LanguageModel,
  systemPrompt: string,
  userPrompt: string,
  schema: ReturnType<typeof import("zod").z.object>,
  temperature: number
): Promise<AgentContribution<T>> {
  const startTime = Date.now();
  try {
    const result = await generateObject({
      model,
      schema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature,
    });
    return {
      agent_id: agentId,
      output: result.object as T,
      usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens },
      duration_ms: Date.now() - startTime,
      success: true,
    };
  } catch (error) {
    return {
      agent_id: agentId,
      output: {} as T,
      usage: {},
      duration_ms: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================
// 并发调用 4 个 Agent
// ============================================================

async function callAllAgents(input: CoachingRoundtableInput) {
  return Promise.allSettled([
    callAgent<CareerMentorOutput>(
      agentConfig.careerMentor.id,
      models[agentConfig.careerMentor.model],
      prompts.careerMentor.system,
      prompts.careerMentor.buildUserPrompt(input),
      CareerMentorOutputSchema,
      agentConfig.careerMentor.temperature
    ),
    callAgent<HeadhunterOutput>(
      agentConfig.headhunter.id,
      models[agentConfig.headhunter.model],
      prompts.headhunter.system,
      prompts.headhunter.buildUserPrompt(input),
      HeadhunterOutputSchema,
      agentConfig.headhunter.temperature
    ),
    callAgent<BigTechExpertOutput>(
      agentConfig.bigtechExpert.id,
      models[agentConfig.bigtechExpert.model],
      prompts.bigtechExpert.system,
      prompts.bigtechExpert.buildUserPrompt(input),
      BigTechExpertOutputSchema,
      agentConfig.bigtechExpert.temperature
    ),
    callAgent<AiExpertOutput>(
      agentConfig.aiExpert.id,
      models[agentConfig.aiExpert.model],
      prompts.aiExpert.system,
      prompts.aiExpert.buildUserPrompt(input),
      AiExpertOutputSchema,
      agentConfig.aiExpert.temperature
    ),
  ]);
}

// ============================================================
// 辅助函数
// ============================================================

function extractResult<T>(
  settled: PromiseSettledResult<AgentContribution<T>>,
  agentId: string
): AgentContribution<T> {
  if (settled.status === "fulfilled") return settled.value;
  return {
    agent_id: agentId,
    output: {} as T,
    usage: {},
    duration_ms: 0,
    success: false,
    error: String(settled.reason),
  };
}

function formatAgentOutput(output: unknown): string {
  if (!output || typeof output !== "object") return "（分析失败）";
  const lines: string[] = [];
  for (const [key, value] of Object.entries(output as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      lines.push(`- ${key}: ${value.join(", ")}`);
    } else if (typeof value === "object" && value !== null) {
      lines.push(`- ${key}: ${JSON.stringify(value)}`);
    } else {
      lines.push(`- ${key}: ${value}`);
    }
  }
  return lines.join("\n");
}

function calculateTotalUsage(
  results: Array<AgentContribution<unknown>>
): { inputTokens: number; outputTokens: number } {
  let inputTokens = 0;
  let outputTokens = 0;
  results.forEach((r) => {
    if (r?.usage) {
      inputTokens += r.usage.inputTokens || 0;
      outputTokens += r.usage.outputTokens || 0;
    }
  });
  return { inputTokens, outputTokens };
}

// ============================================================
// 主函数
// ============================================================

export async function generateCoachingRoundtable(
  input: CoachingRoundtableInput
): Promise<CoachingRoundtableResult> {
  const startTime = Date.now();

  // 1. 并发调用 4 个 Agent
  const settled = await callAllAgents(input);
  const careerMentor = extractResult(settled[0], agentConfig.careerMentor.id);
  const headhunter = extractResult(settled[1], agentConfig.headhunter.id);
  const bigtechExpert = extractResult(settled[2], agentConfig.bigtechExpert.id);
  const aiExpert = extractResult(settled[3], agentConfig.aiExpert.id);

  // 1.5 检查：所有子 Agent 失败则抛错
  const subAgents = [careerMentor, headhunter, bigtechExpert, aiExpert];
  if (subAgents.every((a) => !a.success)) {
    throw new Error("所有子 Agent 调用失败，无法生成圆桌讨论");
  }

  // 2. 主持 Agent 综合
  const hostResult = await callAgent<HostSynthesis>(
    agentConfig.host.id,
    models[agentConfig.host.model],
    prompts.host.system,
    prompts.host.buildUserPrompt(input, {
      careerMentor: formatAgentOutput(careerMentor.output),
      headhunter: formatAgentOutput(headhunter.output),
      bigtechExpert: formatAgentOutput(bigtechExpert.output),
      aiExpert: formatAgentOutput(aiExpert.output),
    }),
    HostSynthesisSchema,
    agentConfig.host.temperature
  );

  // 3. 计算总 token
  const allAgents = [careerMentor, headhunter, bigtechExpert, aiExpert, hostResult];
  const total_usage = calculateTotalUsage(allAgents);

  return {
    career_mentor: careerMentor,
    headhunter,
    bigtech_expert: bigtechExpert,
    ai_expert: aiExpert,
    host_synthesis: hostResult,
    total_usage,
    total_duration_ms: Date.now() - startTime,
  };
}
