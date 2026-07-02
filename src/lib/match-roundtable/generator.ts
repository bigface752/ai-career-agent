/**
 * 岗位匹配圆桌讨论生成器
 *
 * 3 Agent 辩论式并发 + MiMo 综合层
 * 基于 SPEC.md §3.13
 *
 * 流程：
 * 1. Stage 1: 3 Agent 并发（Promise.allSettled），每个输出 2 轮立场
 * 2. Stage 2: MiMo 综合层读取全部立场，输出共识/分歧/投递建议
 * 3. 持久化到 match_roundtable_discussions 表
 *
 * 与模块一圆桌（roundtable/generator.ts）的区别：
 * - 模块一：4 Agent 并发生成 industry_specific 维度（无讨论轮次）
 * - 模块二：3 Agent 辩论式 2 轮 + 综合结论
 */

import { generateObject } from "ai";
import { models } from "@/lib/ai";
import { db } from "@/lib/db";
import {
  RoleDiscussionSchema,
  SynthesisOutputSchema,
  roleConfigs,
  type MatchRoundtableInput,
  type MatchRoundtableRole,
  type RoleDiscussion,
  type SynthesisOutput,
  type AgentDiscussionResult,
  type MatchRoundtableResponse,
} from "./schema";
import {
  getRoleSystemPrompt,
  buildSharedContext,
  SYNTHESIS_SYSTEM_PROMPT,
  synthesisConfig,
} from "./prompts";

// ============================================================
// Stage 1: 单个 Agent 调用
// ============================================================

/**
 * 调用单个角色 Agent
 *
 * 使用 generateObject 输出结构化 2 轮立场
 */
async function callRoleAgent(
  role: MatchRoundtableRole,
  input: MatchRoundtableInput
): Promise<AgentDiscussionResult> {
  const config = roleConfigs[role];
  const startTime = Date.now();

  try {
    const sharedContext = buildSharedContext(input);
    const industry = input.portrait.basic_info.industry || input.jd.company_type;
    const systemPrompt = getRoleSystemPrompt(role, industry);

    const userPrompt = `${sharedContext}

---

## 你的任务

请基于以上信息，以"${config.label}"的角色进行 2 轮讨论。

先输出 Round 1 你的立场，再输出 Round 2 交叉质疑后的最终立场，最后给出一句话核心观点。

注意：
- Round 1 聚焦你角色的核心问题（岗位真实要求 / 行业趋势 / 市场价值）
- Round 2 要引用或回应其他两个角色可能的观点
- 每轮 150-250 字，不要超过 800 字`;

    const result = await generateObject({
      model: models[config.model],
      schema: RoleDiscussionSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: config.temperature,
      abortSignal: AbortSignal.timeout(60_000),
    });

    return {
      agent_id: role,
      output: result.object as RoleDiscussion,
      usage: {
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
      },
      duration_ms: Date.now() - startTime,
      success: true,
    };
  } catch (error) {
    return {
      agent_id: role,
      output: null,
      usage: { inputTokens: 0, outputTokens: 0 },
      duration_ms: Date.now() - startTime,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================
// Stage 1: 3 Agent 并发
// ============================================================

/**
 * 并发运行 3 个角色的辩论讨论
 */
async function runAllDiscussions(
  input: MatchRoundtableInput
): Promise<{
  discussions: AgentDiscussionResult[];
  usage: { inputTokens: number; outputTokens: number };
}> {
  const [jobInsight, industryDirector, headhunter] = await Promise.allSettled([
    callRoleAgent("job_insight", input),
    callRoleAgent("industry_director", input),
    callRoleAgent("headhunter", input),
  ]);

  const discussions: AgentDiscussionResult[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  const orderedResults = [jobInsight, industryDirector, headhunter];
  const orderedIds = ["job_insight", "industry_director", "headhunter"] as const;

  for (let i = 0; i < orderedResults.length; i++) {
    const r = orderedResults[i];
    if (r.status === "fulfilled") {
      inputTokens += r.value.usage.inputTokens;
      outputTokens += r.value.usage.outputTokens;
      discussions.push(r.value);
    } else {
      discussions.push({
        agent_id: orderedIds[i],
        output: null,
        usage: { inputTokens: 0, outputTokens: 0 },
        duration_ms: 0,
        success: false,
        error: String(r.reason),
      });
    }
  }

  return {
    discussions,
    usage: { inputTokens, outputTokens },
  };
}

// ============================================================
// Stage 2: MiMo 综合层
// ============================================================

/**
 * 运行综合共识 Agent
 *
 * 读取 3 个角色的 2 轮立场，输出共识/分歧/投递建议
 */
async function runSynthesis(
  discussions: AgentDiscussionResult[],
  input: MatchRoundtableInput
): Promise<{
  output: SynthesisOutput;
  usage: { inputTokens: number; outputTokens: number };
  duration_ms: number;
}> {
  const startTime = Date.now();

  // 构建综合层的用户 prompt
  const lines: string[] = [];
  lines.push("## 圆桌讨论记录\n");

  const roleLabels: Record<string, string> = {
    job_insight: "岗位洞察",
    industry_director: "行业总监",
    headhunter: "猎头",
  };

  for (const d of discussions) {
    if (!d.success || !d.output) {
      lines.push(`### ${roleLabels[d.agent_id] || d.agent_id}（发言失败：${d.error}）\n`);
      continue;
    }

    const label = roleLabels[d.agent_id] || d.agent_id;
    lines.push(`### ${label}`);
    lines.push(`**Round 1 立场：**\n${d.output.round1_position}\n`);
    lines.push(`**Round 2 立场：**\n${d.output.round2_position}\n`);
    lines.push(`**核心观点：** ${d.output.key_point}\n`);
  }

  // 匹配分析摘要
  lines.push("\n## 匹配分析摘要");
  lines.push(`- 综合评级：${input.match_analysis.overall_rating}`);
  lines.push(`- 关键差距：${input.match_analysis.gaps.map((g) => `${g.gap}（${g.severity}）`).join("、")}`);
  lines.push(`- 关键优势：${input.match_analysis.strengths.map((s) => s.strength).join("、")}`);

  lines.push("\n---");
  lines.push("\n## 你的任务");
  lines.push("请综合以上 3 位专家的讨论，输出：");
  lines.push("1. 共识（1-5 条）");
  lines.push("2. 分歧（0-5 条）");
  lines.push("3. 投递建议（决策 + 理由 + 下一步）");
  lines.push("4. 风险等级");

  try {
    const result = await generateObject({
      model: models[synthesisConfig.model],
      schema: SynthesisOutputSchema,
      system: SYNTHESIS_SYSTEM_PROMPT,
      prompt: lines.join("\n"),
      temperature: synthesisConfig.temperature,
      abortSignal: AbortSignal.timeout(60_000),
    });

    return {
      output: result.object as SynthesisOutput,
      usage: {
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
      },
      duration_ms: Date.now() - startTime,
    };
  } catch (error) {
    throw new Error(
      `Synthesis failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ============================================================
// 持久化
// ============================================================

/**
 * 将圆桌讨论结果持久化到数据库
 */
async function persistDiscussion(
  matchId: string,
  discussions: AgentDiscussionResult[],
  synthesis: SynthesisOutput,
  totalTokenUsage: number
): Promise<string> {
  const record = await db.matchRoundtableDiscussion.create({
    data: {
      matchResultId: matchId,
      participants: JSON.stringify(
        discussions.map((d) => ({
          role: d.agent_id,
          success: d.success,
          output: d.output,
          error: d.error,
        }))
      ),
      rounds: JSON.stringify(
        discussions
          .filter((d) => d.success && d.output)
          .map((d) => ({
            role: d.agent_id,
            round1: d.output!.round1_position,
            round2: d.output!.round2_position,
          }))
      ),
      consensus: JSON.stringify(synthesis.consensus),
      disagreements: JSON.stringify(synthesis.disagreements),
      recommendation: JSON.stringify(synthesis.recommendation),
      riskLevel: synthesis.risk_level,
      tokenUsage: totalTokenUsage,
    },
  });

  return record.id;
}

// ============================================================
// 主函数：生成岗位匹配圆桌讨论
// ============================================================

/**
 * 生成岗位匹配圆桌讨论
 *
 * 完整流程：
 * 1. 3 Agent 并发辩论（2 轮）
 * 2. MiMo 综合层提取共识/分歧/投递建议
 * 3. 持久化到数据库
 * 4. 返回 API 响应
 *
 * @param input 圆桌讨论输入（JD + 画像 + 匹配分析）
 * @param matchId 匹配结果 ID（用于持久化关联）
 * @returns API 响应格式
 */
export async function generateMatchRoundtable(
  input: MatchRoundtableInput,
  matchId: string
): Promise<MatchRoundtableResponse> {
  // Stage 1: 3 Agent 并发辩论
  const discussionResult = await runAllDiscussions(input);

  // 检查是否全部失败
  const successCount = discussionResult.discussions.filter(
    (d) => d.success
  ).length;
  if (successCount === 0) {
    const err = new Error("所有角色发言失败");
    err.name = "ALL_AGENTS_FAILED";
    throw err;
  }

  // Stage 2: 综合共识
  const synthesisResult = await runSynthesis(
    discussionResult.discussions,
    input
  );

  // 计算总 token
  const totalTokenUsage =
    discussionResult.usage.inputTokens +
    discussionResult.usage.outputTokens +
    synthesisResult.usage.inputTokens +
    synthesisResult.usage.outputTokens;

  // 持久化
  const roundtableId = await persistDiscussion(
    matchId,
    discussionResult.discussions,
    synthesisResult.output,
    totalTokenUsage
  );

  // 构建 API 响应
  const roleLabels: Record<string, string> = {
    job_insight: "岗位洞察",
    industry_director: "行业总监",
    headhunter: "猎头",
  };

  const participants = discussionResult.discussions.map((d) => ({
    role: roleLabels[d.agent_id] || d.agent_id,
    analysis: d.success && d.output
      ? `【Round 1】${d.output.round1_position}\n\n【Round 2】${d.output.round2_position}`
      : `发言失败：${d.error}`,
    key_point: d.success && d.output ? d.output.key_point : "发言失败",
  }));

  return {
    roundtable_id: roundtableId,
    participants,
    consensus: synthesisResult.output.consensus,
    disagreements: synthesisResult.output.disagreements,
    recommendation: synthesisResult.output.recommendation,
    risk_level: synthesisResult.output.risk_level,
  };
}
