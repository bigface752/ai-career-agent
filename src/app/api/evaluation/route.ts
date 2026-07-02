/**
 * POST /api/evaluation/run
 * 触发竞争力评估
 *
 * 流程：
 * 1. 获取对话会话数据
 * 2. 提取画像信息
 * 3. 运行 5 Agent 评估（各 3 次取共识）
 * 4. 返回评估结果
 *
 * Body: { sessionId: string }
 * 返回: EvaluationResult
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import {
  getDialogueSession,
  getMessages,
} from "@/lib/dialogue/session-manager";
import { runEvaluation } from "@/lib/evaluation/generator";
import type { EvaluationInput, EvaluationResult } from "@/lib/evaluation/schema";
import type { BasicInfo, CareerSegment } from "@/lib/portrait/schema";
import type { SlotState } from "@/lib/dialogue/types";
import { compareSalary } from "@/lib/salary";
import type { SalaryComparison } from "@/lib/salary";
import { MARKET_DATA, POSITION_DISPLAY_NAMES, inferPositionId } from "@/lib/salary/market-data";
import { db } from "@/lib/db";

// ============================================================
// 从 SlotState 提取基础信息
// ============================================================

function extractBasicInfo(slotState: SlotState): BasicInfo {
  const filled = slotState.filled;

  return {
    current_role: (filled.current_role?.value as string) || "未知",
    industry: (filled.industry?.value as string) || "未知",
    years_of_experience:
      typeof filled.years_of_experience?.value === "number"
        ? filled.years_of_experience.value
        : 0,
    city: (filled.city?.value as string) || "未知",
  };
}

// ============================================================
// 从 SlotState 提取职业经历
// ============================================================

function extractCareerSegments(slotState: SlotState): CareerSegment[] {
  const filled = slotState.filled;

  if (filled.current_role?.value) {
    return [
      {
        position_id: String(filled.current_role.value),
        industry: String(filled.industry?.value || "未知"),
        company: "当前公司",
        duration_years:
          typeof filled.years_of_experience?.value === "number"
            ? filled.years_of_experience.value
            : 0,
        key_skills: [],
        key_achievements: filled.key_achievement?.value
          ? [String(filled.key_achievement.value)]
          : [],
      },
    ];
  }

  return [];
}

// ============================================================
// 从 SlotState 提取职业摘要
// ============================================================

function extractCareerSummary(slotState: SlotState): EvaluationInput["careerSummary"] {
  const filled = slotState.filled;

  const riskValue = filled.risk_tolerance?.value;
  const validRiskLevels: Array<"低" | "中" | "高"> = ["低", "中", "高"];
  const risk_tolerance = validRiskLevels.includes(riskValue as "低" | "中" | "高")
    ? (riskValue as "低" | "中" | "高")
    : "中";

  return {
    motivation: typeof filled.motivation?.value === "string" ? filled.motivation.value : "",
    value_ranking: Array.isArray(filled.value_ranking?.value)
      ? (filled.value_ranking.value as string[])
      : [],
    risk_tolerance,
    life_constraints: typeof filled.life_constraints?.value === "string" ? filled.life_constraints.value : "",
    development_goal: typeof filled.development_goal?.value === "string" ? filled.development_goal.value : "",
  };
}

// ============================================================
// 从 SlotState 提取优势和短板
// ============================================================

function extractStrengthsAndGaps(slotState: SlotState): {
  strengths: string[];
  gaps: string[];
} {
  const filled = slotState.filled;

  const strengths = Array.isArray(filled.strengths?.value)
    ? (filled.strengths.value as string[])
    : [];

  const gaps = Array.isArray(filled.gaps?.value)
    ? (filled.gaps.value as string[])
    : [];

  return { strengths, gaps };
}

// ============================================================
// 构建对话摘要
// ============================================================

function buildDialogueSummary(
  messages: Array<{ role: string; content: string; createdAt: Date }>,
  slotState: SlotState
): string {
  const lines: string[] = [];

  // 已收集的 Slot 信息
  const slotEntries = Object.entries(slotState.filled)
    .filter(([, entry]) => entry.confirmed)
    .map(([key, entry]) => `- ${key}: ${entry.value}`)
    .join("\n");

  if (slotEntries) {
    lines.push("### 已确认信息");
    lines.push(slotEntries);
  }

  // 最近 5 轮对话摘要
  const recentMessages = messages.slice(-10);
  if (recentMessages.length > 0) {
    lines.push("\n### 最近对话");
    recentMessages.forEach((msg) => {
      const role = msg.role === "user" ? "用户" : "AI";
      const content =
        msg.content.length > 200
          ? msg.content.slice(0, 200) + "..."
          : msg.content;
      lines.push(`${role}: ${content}`);
    });
  }

  return lines.join("\n");
}

// ============================================================
// POST Handler
// ============================================================

export async function POST(req: NextRequest) {
  // 1. 认证
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  // 2. 解析请求
  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (!body.sessionId) {
    return Response.json({ error: "缺少 sessionId" }, { status: 400 });
  }

  // 3. 获取对话会话
  const session = await getDialogueSession(body.sessionId, user.id);
  if (!session) {
    return Response.json({ error: "会话不存在" }, { status: 404 });
  }

  if (session.status !== "active" && session.status !== "paused") {
    return Response.json(
      { error: "会话状态不可评估（需要 active 或 paused）" },
      { status: 409 }
    );
  }

  try {
    // 4. 获取消息历史
    const messages = await getMessages(session.id);

    // 4.5 校验：至少有 3 轮对话才值得评估
    if (messages.length < 6) {
      return Response.json(
        { error: "对话轮次不足，至少需要 3 轮对话才能进行评估" },
        { status: 409 }
      );
    }

    // 4.6 校验：至少有基础信息才值得评估
    const filledSlots = Object.keys(session.slotState.filled);
    if (filledSlots.length < 3) {
      return Response.json(
        { error: "收集的信息不足，至少需要 3 个维度的信息才能进行评估" },
        { status: 409 }
      );
    }

    // 5. 提取信息
    const basicInfo = extractBasicInfo(session.slotState);
    const careerSegments = extractCareerSegments(session.slotState);
    const careerSummary = extractCareerSummary(session.slotState);
    const { strengths, gaps } = extractStrengthsAndGaps(session.slotState);
    const dialogueSummary = buildDialogueSummary(messages, session.slotState);

    // 6. 尝试读取已有的画像（获取 industrySpecific）
    let industrySpecific: EvaluationInput["industrySpecific"];
    try {
      const portrait = await db.portrait.findUnique({
        where: { userId: user.id },
      });
      if (portrait?.portraitJson) {
        const parsed = JSON.parse(portrait.portraitJson);
        // 运行时验证 industrySpecific 结构
        if (
          parsed &&
          typeof parsed === "object" &&
          "industry_specific" in parsed &&
          parsed.industry_specific &&
          typeof parsed.industry_specific === "object" &&
          Object.keys(parsed.industry_specific).length > 0
        ) {
          const raw = parsed.industry_specific as Record<string, unknown>;
          const valid: EvaluationInput["industrySpecific"] = {};
          let isValid = true;
          for (const [key, val] of Object.entries(raw)) {
            if (
              val &&
              typeof val === "object" &&
              "value" in val &&
              "assessment" in val &&
              "confidence" in val
            ) {
              valid[key] = val as {
                value: string;
                assessment: "强" | "中" | "弱";
                evidence?: string;
                confidence: "high" | "medium" | "low";
              };
            } else {
              isValid = false;
              break;
            }
          }
          if (isValid && Object.keys(valid).length > 0) {
            industrySpecific = valid;
          }
        }
      }
    } catch (error) {
      console.warn(
        "Failed to read industrySpecific from portrait:",
        error instanceof Error ? error.message : String(error)
      );
    }

    // 6.5 读取用户薪资数据（F1 新增）
    // 按当前评估岗位过滤，避免跨岗位误用薪资数据（审查 #2 修复）
    let userSalary: EvaluationInput["userSalary"];
    try {
      const currentPositionId = inferPositionId(basicInfo.current_role);
      if (currentPositionId) {
        const latestSubmission = await db.salarySubmission.findFirst({
          where: { userId: user.id, position: currentPositionId },
          orderBy: { createdAt: "desc" },
        });
        if (latestSubmission) {
          const marketData = MARKET_DATA[latestSubmission.position];
          if (marketData) {
            const comparison = compareSalary(
              {
                annualSalary: latestSubmission.annualSalary,
                position: latestSubmission.position as "data-analyst" | "b2b-sales" | "pmm",
                city: latestSubmission.city,
              },
              marketData,
              "user_input"
            );
            userSalary = {
              annualSalary: latestSubmission.annualSalary,
              city: latestSubmission.city,
              position: latestSubmission.position,
              marketPercentile: comparison.marketPercentile,
              label: comparison.label,
              confidence: comparison.confidence,
            };
          }
        }
      }
    } catch (error) {
      console.warn(
        "Failed to read user salary data:",
        error instanceof Error ? error.message : String(error)
      );
    }

    // 7. 构建评估输入
    const evaluationInput: EvaluationInput = {
      positionId: inferPositionId(basicInfo.current_role) ?? undefined,
      basicInfo: {
        current_role: basicInfo.current_role,
        industry: basicInfo.industry,
        years_of_experience: basicInfo.years_of_experience,
        city: basicInfo.city,
      },
      careerSummary,
      strengths,
      gaps,
      careerSegments: careerSegments.map((seg) => ({
        position_id: seg.position_id,
        industry: seg.industry,
        company: seg.company,
        duration_years: seg.duration_years,
        key_skills: seg.key_skills,
        key_achievements: seg.key_achievements,
      })),
      dialogueSummary,
      industrySpecific,
      userSalary,
    };

    // 7.5 幂等检查：如果该会话已有评估结果，直接返回
    // 但如果用户补充了薪资数据（评估后提交），则跳过缓存重新评估（审查 #5 修复）
    const existing = await db.evaluation.findFirst({
      where: { userId: user.id, sessionId: body.sessionId },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      const existingResult = JSON.parse(existing.resultJson) as EvaluationResult;
      // 检查：如果现有评估不含薪资数据，但本次有薪资数据，跳过缓存
      const existingHasSalary = !!existingResult.agents?.market_benchmark?.output?.salary_positioning;
      if (!existingHasSalary && userSalary) {
        // 用户补充了薪资数据，重新评估
      } else {
        // 计算薪资对比（与 GET handler 逻辑一致）
        let salaryComparison: (SalaryComparison & { positionName: string }) | undefined;
        try {
          const sp = existingResult.agents?.market_benchmark?.output?.salary_positioning;
          if (sp?.data_source === "user_input") {
            const sub = await db.salarySubmission.findFirst({
              where: { userId: user.id },
              orderBy: { createdAt: "desc" },
            });
            if (sub) {
              const md = MARKET_DATA[sub.position];
              if (md) {
                const comp = compareSalary(
                  { annualSalary: sub.annualSalary, position: sub.position as "data-analyst" | "b2b-sales" | "pmm", city: sub.city },
                  md, "user_input"
                );
                salaryComparison = { ...comp, positionName: POSITION_DISPLAY_NAMES[sub.position] ?? sub.position };
              }
            }
          }
        } catch { /* 附加功能，静默 */ }

        return Response.json({
          evaluationId: existing.id,
          evaluation: existingResult,
          salaryComparison,
        });
      }
    }

    // 8. 运行评估
    const result = await runEvaluation(evaluationInput);

    // 9. 持久化评估结果
    const evaluation = await db.evaluation.create({
      data: {
        userId: user.id,
        sessionId: body.sessionId,
        resultJson: JSON.stringify(result),
        overallRating: result.overall_rating,
        overallScore: result.overall_score,
      },
    });

    // 10. 返回结果
    // 计算薪资对比
    let salaryComparison: (SalaryComparison & { positionName: string }) | undefined;
    try {
      if (userSalary) {
        const sub = await db.salarySubmission.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
        });
        if (sub) {
          const md = MARKET_DATA[sub.position];
          if (md) {
            const comp = compareSalary(
              { annualSalary: sub.annualSalary, position: sub.position as "data-analyst" | "b2b-sales" | "pmm", city: sub.city },
              md, "user_input"
            );
            salaryComparison = { ...comp, positionName: POSITION_DISPLAY_NAMES[sub.position] ?? sub.position };
          }
        }
      }
    } catch { /* 附加功能，静默 */ }

    return Response.json({
      evaluationId: evaluation.id,
      evaluation: result,
      salaryComparison,
    });
  } catch (error) {
    console.error("竞争力评估失败:", error);
    return Response.json(
      { error: "评估失败，请稍后重试" },
      { status: 500 }
    );
  }
}

// ============================================================
// GET Handler — 查询已存储的评估结果
// ============================================================

/**
 * GET /api/evaluation?sessionId=xxx
 * 获取指定会话的最新评估结果
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return Response.json({ error: "缺少 sessionId" }, { status: 400 });
  }

  try {
    const evaluation = await db.evaluation.findFirst({
      where: {
        userId: user.id,
        sessionId,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!evaluation) {
      return Response.json({ error: "未找到评估结果" }, { status: 404 });
    }

    const result = JSON.parse(evaluation.resultJson) as EvaluationResult;

    // F2：计算薪资对比数据（独立于 LLM 输出，基于原始 SalarySubmission）
    let salaryComparison: (SalaryComparison & { positionName: string }) | undefined;
    try {
      const salaryPositioning = result.agents?.market_benchmark?.output?.salary_positioning;
      if (salaryPositioning?.data_source === "user_input") {
        // V1：每个用户每岗位一条最新 SalarySubmission
        const submission = await db.salarySubmission.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
        });
        if (submission) {
          const marketData = MARKET_DATA[submission.position];
          if (marketData) {
            const comparison = compareSalary(
              {
                annualSalary: submission.annualSalary,
                position: submission.position as "data-analyst" | "b2b-sales" | "pmm",
                city: submission.city,
              },
              marketData,
              "user_input"
            );
            salaryComparison = {
              ...comparison,
              positionName: POSITION_DISPLAY_NAMES[submission.position] ?? submission.position,
            };
          }
        }
      }
    } catch (error) {
      // 薪资对比是附加功能，失败不影响评估结果返回
      console.warn("Failed to compute salary comparison:", error);
    }

    return Response.json({
      evaluationId: evaluation.id,
      evaluation: result,
      salaryComparison,
      createdAt: evaluation.createdAt,
    });
  } catch (error) {
    console.error("查询评估结果失败:", error);
    return Response.json(
      { error: "查询失败，请稍后重试" },
      { status: 500 }
    );
  }
}
