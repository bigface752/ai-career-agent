/**
 * POST /api/match/roundtable
 * 岗位匹配圆桌讨论
 *
 * 对齐 specs/api-endpoints.md
 * 输入：match_id（从 match/analyze 获得）
 * 输出：3 角色讨论 + 共识/分歧/投递建议
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { loadPositionKnowledge } from "@/lib/knowledge/loader";
import { generateMatchRoundtable } from "@/lib/match-roundtable";
import type { MatchRoundtableInput } from "@/lib/match-roundtable/schema";
import type { ParsedJd } from "@/lib/jd/schema";
import type { MatchAnalysis } from "@/lib/match/schema";

export async function POST(req: NextRequest) {
  // 1. Auth
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "请先登录" },
      { status: 401 }
    );
  }

  // 2. Parse body
  let body: { match_id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "INVALID_BODY", message: "请求格式错误" },
      { status: 400 }
    );
  }

  const { match_id } = body;

  if (!match_id || typeof match_id !== "string") {
    return Response.json(
      { error: "MISSING_MATCH_ID", message: "缺少 match_id 参数" },
      { status: 400 }
    );
  }

  // 3. 加载匹配结果
  const matchResult = await db.matchResult.findFirst({
    where: { id: match_id, userId: user.id },
  });

  if (!matchResult) {
    return Response.json(
      { error: "MATCH_NOT_FOUND", message: "匹配结果不存在或无权访问" },
      { status: 404 }
    );
  }

  // 3.5 幂等检查：已有圆桌结果直接返回
  const existing = await db.matchRoundtableDiscussion.findUnique({
    where: { matchResultId: match_id },
  });

  if (existing) {
    const roleLabels: Record<string, string> = {
      job_insight: "岗位洞察",
      industry_director: "行业总监",
      headhunter: "猎头",
    };

    const existingParticipants = JSON.parse(
      existing.participants as string
    ) as Array<{
      role: string;
      success: boolean;
      output: { round1_position: string; round2_position: string; key_point: string } | null;
      error?: string;
    }>;

    return Response.json({
      roundtable_id: existing.id,
      participants: existingParticipants.map((p) => ({
        role: roleLabels[p.role] || p.role,
        analysis:
          p.success && p.output
            ? `【Round 1】${p.output.round1_position}\n\n【Round 2】${p.output.round2_position}`
            : `发言失败：${p.error}`,
        key_point: p.success && p.output ? p.output.key_point : "发言失败",
      })),
      consensus: JSON.parse(existing.consensus as string),
      disagreements: JSON.parse(existing.disagreements as string),
      recommendation: JSON.parse(existing.recommendation as string),
      risk_level: existing.riskLevel,
    });
  }

  // 4. 加载 JD
  const jd = await db.jobDescription.findFirst({
    where: { id: matchResult.jdId, userId: user.id },
  });

  if (!jd) {
    return Response.json(
      { error: "JD_NOT_FOUND", message: "关联 JD 不存在" },
      { status: 404 }
    );
  }

  // 5. 加载用户画像
  const portrait = await db.portrait.findUnique({
    where: { userId: user.id },
  });

  if (!portrait) {
    return Response.json(
      { error: "PORTRAIT_NOT_FOUND", message: "请先完成职业画像" },
      { status: 400 }
    );
  }

  // 6. 解析 JSON 数据
  let parsedJd: ParsedJd;
  let portraitData: Record<string, unknown>;
  let dimensions: MatchAnalysis["dimensions"];
  let gaps: MatchAnalysis["gaps"];
  let strengths: MatchAnalysis["strengths"];

  try {
    parsedJd = JSON.parse(jd.parsedJson) as ParsedJd;
  } catch {
    return Response.json(
      { error: "INVALID_JD_DATA", message: "JD 数据格式错误" },
      { status: 500 }
    );
  }

  try {
    portraitData = JSON.parse(portrait.portraitJson) as Record<string, unknown>;
  } catch {
    return Response.json(
      { error: "INVALID_PORTRAIT_DATA", message: "画像数据格式错误" },
      { status: 500 }
    );
  }

  try {
    dimensions = JSON.parse(matchResult.dimensionsJson) as MatchAnalysis["dimensions"];
    gaps = JSON.parse(matchResult.gapsJson) as MatchAnalysis["gaps"];
    strengths = JSON.parse(matchResult.strengthsJson) as MatchAnalysis["strengths"];
  } catch {
    return Response.json(
      { error: "INVALID_MATCH_DATA", message: "匹配数据格式错误" },
      { status: 500 }
    );
  }

  // 7. 组装输入
  const basicInfo = (portraitData.basic_info || {}) as Record<string, unknown>;
  const careerSummary = (portraitData.career_summary || {}) as Record<string, unknown>;

  let knowledgeCard: MatchRoundtableInput["knowledge_card"];
  try {
    const positionId = inferPositionId(parsedJd.position, basicInfo.current_role as string);
    if (positionId) {
      const card = loadPositionKnowledge(positionId);
      if (card) {
        knowledgeCard = {
          core_competencies: card.core_competencies,
          salary: card.salary,
        };
      }
    }
  } catch (e) {
    console.warn("[match-roundtable] Failed to load knowledge card:", e);
  }

  const input: MatchRoundtableInput = {
    jd: {
      position: parsedJd.position,
      company_type: parsedJd.company_type,
      requirements: parsedJd.requirements,
      nice_to_have: parsedJd.nice_to_have,
      key_challenges: parsedJd.key_challenges,
    },
    portrait: {
      basic_info: {
        current_role: (basicInfo.current_role as string) || "",
        industry: (basicInfo.industry as string) || "",
        years_of_experience: (basicInfo.years_of_experience as number) || 0,
        city: (basicInfo.city as string) || "",
        company: basicInfo.company as string | undefined,
      },
      career_summary: {
        motivation: (careerSummary.motivation as string) || "",
        value_ranking: (careerSummary.value_ranking as string[]) || [],
        risk_tolerance: (careerSummary.risk_tolerance as "低" | "中" | "高") || "中",
        life_constraints: (careerSummary.life_constraints as string) || "",
        development_goal: (careerSummary.development_goal as string) || "",
      },
      strengths: (portraitData.strengths as string[]) || [],
      gaps: (portraitData.gaps as string[]) || [],
      career_segments: portraitData.career_segments as MatchRoundtableInput["portrait"]["career_segments"],
    },
    match_analysis: {
      overall_rating: matchResult.overallRating as "强" | "中" | "弱",
      dimensions,
      gaps,
      strengths,
    },
    knowledge_card: knowledgeCard,
  };

  // 8. 运行圆桌讨论
  try {
    const result = await generateMatchRoundtable(input, match_id);
    return Response.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[match-roundtable] Failed:", msg);

    if (err instanceof Error && err.name === "ALL_AGENTS_FAILED") {
      return Response.json(
        { error: "ROUNDTABLE_FAILED", message: "圆桌讨论失败，请重试" },
        { status: 500 }
      );
    }

    return Response.json(
      { error: "INTERNAL_ERROR", message: "生成讨论结果失败" },
      { status: 500 }
    );
  }
}

// ============================================================
// 辅助函数（复用 analyzer.ts 的逻辑）
// ============================================================

const KEYWORD_MAP: Array<[string, string]> = [
  ["产品营销", "pmm"],
  ["客户成功", "b2b-sales"],
  ["数据分析", "data-analyst"],
  ["数据运营", "data-analyst"],
  ["PMM", "pmm"],
  ["售前", "b2b-sales"],
  ["销售", "b2b-sales"],
  ["BD", "b2b-sales"],
  ["BI", "data-analyst"],
];

function inferPositionId(jdPosition: string, currentRole?: string): string | null {
  const texts = [jdPosition, currentRole].filter(Boolean);
  for (const text of texts) {
    for (const [keyword, positionId] of KEYWORD_MAP) {
      if (text!.includes(keyword)) {
        return positionId;
      }
    }
  }
  return null;
}
