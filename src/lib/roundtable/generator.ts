/**
 * 圆桌讨论生成器
 *
 * 4 Agent 并发调用 + 结果合并
 * 基于 SPEC.md §4.2 圆桌讨论机制
 *
 * 架构：
 * 1. Promise.allSettled 并发调用 4 个 Agent
 * 2. 单个 Agent 失败不阻塞讨论
 * 3. 结果合并到 industry_specific
 */

import { generateObject, type LanguageModel } from "ai";
import { models, type ModelKey } from "@/lib/ai";
import {
  PsychologistOutputSchema,
  IndustryDirectorOutputSchema,
  CareerMentorOutputSchema,
  AiExpertOutputSchema,
  type RoundtableInput,
  type RoundtableResult,
  type AgentContribution,
  type PsychologistOutput,
  type IndustryDirectorOutput,
  type CareerMentorOutput,
  type AiExpertOutput,
} from "./schema";
import { prompts, agentConfig } from "./prompts";

// ============================================================
// 单个 Agent 调用
// ============================================================

/**
 * 调用单个 Agent
 *
 * @param agentId Agent 标识
 * @param model 模型实例
 * @param systemPrompt 系统提示词
 * @param userPrompt 用户提示词
 * @param schema 输出 Schema
 * @param temperature 温度参数
 * @returns Agent 输出结果
 */
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
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      },
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

/**
 * 并发调用 4 个 Agent
 *
 * 使用 Promise.allSettled 保证单个 Agent 失败不阻塞讨论
 */
async function callAllAgents(input: RoundtableInput) {
  const userPrompt = buildPortraitSummary(input);

  // 并发调用 4 个 Agent
  const [psychologist, industryDirector, careerMentor, aiExpert] =
    await Promise.allSettled([
      // 心理学家 Agent
      callAgent<PsychologistOutput>(
        agentConfig.psychologist.id,
        models[agentConfig.psychologist.model],
        prompts.psychologist.system,
        prompts.psychologist.buildUserPrompt(input),
        PsychologistOutputSchema,
        agentConfig.psychologist.temperature
      ),
      // 行业总监 Agent
      callAgent<IndustryDirectorOutput>(
        agentConfig.industryDirector.id,
        models[agentConfig.industryDirector.model],
        prompts.industryDirector.system,
        prompts.industryDirector.buildUserPrompt(input),
        IndustryDirectorOutputSchema,
        agentConfig.industryDirector.temperature
      ),
      // 职业导师 Agent
      callAgent<CareerMentorOutput>(
        agentConfig.careerMentor.id,
        models[agentConfig.careerMentor.model],
        prompts.careerMentor.system,
        prompts.careerMentor.buildUserPrompt(input),
        CareerMentorOutputSchema,
        agentConfig.careerMentor.temperature
      ),
      // AI效能专家 Agent
      callAgent<AiExpertOutput>(
        agentConfig.aiExpert.id,
        models[agentConfig.aiExpert.model],
        prompts.aiExpert.system,
        prompts.aiExpert.buildUserPrompt(input),
        AiExpertOutputSchema,
        agentConfig.aiExpert.temperature
      ),
    ]);

  return {
    psychologist,
    industryDirector,
    careerMentor,
    aiExpert,
  };
}

// ============================================================
// 结果合并
// ============================================================

/**
 * 构建用户画像摘要（共享上下文）
 */
function buildPortraitSummary(input: RoundtableInput): string {
  const lines: string[] = [];

  // 基础信息
  lines.push("## 用户基础信息");
  lines.push(`- 当前职位：${input.basicInfo.current_role}`);
  lines.push(`- 行业：${input.basicInfo.industry}`);
  lines.push(`- 年限：${input.basicInfo.years_of_experience} 年`);
  lines.push(`- 城市：${input.basicInfo.city}`);
  if (input.basicInfo.company) {
    lines.push(`- 公司：${input.basicInfo.company}`);
  }

  // 职业摘要
  lines.push("\n## 职业摘要");
  lines.push(`- 跳槽动机：${input.careerSummary.motivation}`);
  lines.push(`- 价值排序：${input.careerSummary.value_ranking.join(" > ")}`);
  lines.push(`- 风险承受度：${input.careerSummary.risk_tolerance}`);
  lines.push(`- 生活约束：${input.careerSummary.life_constraints}`);
  lines.push(`- 3年目标：${input.careerSummary.development_goal}`);

  // 优势与短板
  lines.push("\n## 优势与短板");
  lines.push(`- 核心优势：${input.strengths.join("、")}`);
  lines.push(`- 待提升短板：${input.gaps.join("、")}`);

  // 多段经历
  if (input.careerSegments && input.careerSegments.length > 0) {
    lines.push("\n## 职业经历");
    input.careerSegments.forEach((seg, i) => {
      lines.push(`### 经历 ${i + 1}：${seg.company}（${seg.duration_years}年）`);
      lines.push(`- 岗位：${seg.position_id}`);
      lines.push(`- 行业：${seg.industry}`);
      lines.push(`- 核心技能：${seg.key_skills.join("、")}`);
    });
  }

  // 对话摘要
  if (input.dialogueSummary) {
    lines.push("\n## 对话摘要");
    lines.push(input.dialogueSummary);
  }

  return lines.join("\n");
}

/**
 * 合并 4 个 Agent 的结果到 industry_specific
 *
 * 将每个 Agent 的输出转换为 DimensionItem 结构
 */
function mergeResults(
  psychologist: AgentContribution<PsychologistOutput> | null,
  industryDirector: AgentContribution<IndustryDirectorOutput> | null,
  careerMentor: AgentContribution<CareerMentorOutput> | null,
  aiExpert: AgentContribution<AiExpertOutput> | null
): Record<
  string,
  {
    value: string;
    assessment: "强" | "中" | "弱";
    evidence?: string;
    confidence: "high" | "medium" | "low";
  }
> {
  const result: Record<
    string,
    {
      value: string;
      assessment: "强" | "中" | "弱";
      evidence?: string;
      confidence: "high" | "medium" | "low";
    }
  > = {};

  // 心理学家维度
  if (psychologist?.success && psychologist.output) {
    const p = psychologist.output;
    result.anxiety_source = p.anxiety_source;
    result.decision_readiness = p.decision_readiness;
    result.risk_perception_bias = p.risk_perception_bias;
    result.psychological_resilience = p.psychological_resilience;
  }

  // 行业总监维度
  if (industryDirector?.success && industryDirector.output) {
    const d = industryDirector.output;
    // 核心能力（数组）
    d.core_competencies.forEach((comp, i) => {
      result[`core_competency_${i + 1}`] = comp;
    });
    // 行业因素（数组）
    d.industry_factors.forEach((factor, i) => {
      result[`industry_factor_${i + 1}`] = factor;
    });
    // 市场供需
    result.market_supply = d.market_supply;
  }

  // 职业导师维度
  if (careerMentor?.success && careerMentor.output) {
    const m = careerMentor.output;
    result.career_path = m.career_path;
    result.ceiling = m.ceiling;
    result.breakthrough = m.breakthrough;
  }

  // AI效能专家维度
  if (aiExpert?.success && aiExpert.output) {
    const a = aiExpert.output;
    result.ai_replacement_risk = a.ai_replacement_risk;
    result.ai_enhancement = a.ai_enhancement;
  }

  return result;
}

/**
 * 计算总 token 使用量
 */
function calculateTotalUsage(
  results: Array<AgentContribution<unknown> | null>
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
// 主函数：生成圆桌讨论结果
// ============================================================

/**
 * 生成圆桌讨论结果
 *
 * 1. 并发调用 4 个 Agent
 * 2. 合并结果到 industry_specific
 * 3. 计算总 token 使用量
 */
export async function generateRoundtable(
  input: RoundtableInput
): Promise<RoundtableResult> {
  const startTime = Date.now();

  // 并发调用 4 个 Agent
  const { psychologist, industryDirector, careerMentor, aiExpert } =
    await callAllAgents(input);

  // 提取结果（Promise.allSettled 返回 {status, value/reason}）
  const psychologistResult =
    psychologist.status === "fulfilled" ? psychologist.value : null;
  const industryDirectorResult =
    industryDirector.status === "fulfilled" ? industryDirector.value : null;
  const careerMentorResult =
    careerMentor.status === "fulfilled" ? careerMentor.value : null;
  const aiExpertResult =
    aiExpert.status === "fulfilled" ? aiExpert.value : null;

  // 合并结果
  const industry_specific = mergeResults(
    psychologistResult,
    industryDirectorResult,
    careerMentorResult,
    aiExpertResult
  );

  // 计算总 token 使用量
  const total_usage = calculateTotalUsage([
    psychologistResult,
    industryDirectorResult,
    careerMentorResult,
    aiExpertResult,
  ]);

  return {
    psychologist: psychologistResult || {
      agent_id: "psychologist",
      output: {} as PsychologistOutput,
      usage: {},
      duration_ms: 0,
      success: false,
      error:
        psychologist.status === "rejected"
          ? String(psychologist.reason)
          : "Unknown error",
    },
    industry_director: industryDirectorResult || {
      agent_id: "industry_director",
      output: {} as IndustryDirectorOutput,
      usage: {},
      duration_ms: 0,
      success: false,
      error:
        industryDirector.status === "rejected"
          ? String(industryDirector.reason)
          : "Unknown error",
    },
    career_mentor: careerMentorResult || {
      agent_id: "career_mentor",
      output: {} as CareerMentorOutput,
      usage: {},
      duration_ms: 0,
      success: false,
      error:
        careerMentor.status === "rejected"
          ? String(careerMentor.reason)
          : "Unknown error",
    },
    ai_expert: aiExpertResult || {
      agent_id: "ai_expert",
      output: {} as AiExpertOutput,
      usage: {},
      duration_ms: 0,
      success: false,
      error:
        aiExpert.status === "rejected"
          ? String(aiExpert.reason)
          : "Unknown error",
    },
    industry_specific,
    total_usage,
    total_duration_ms: Date.now() - startTime,
  };
}
