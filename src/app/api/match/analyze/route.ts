/**
 * POST /api/match/analyze
 * 生成匹配分析
 *
 * 对齐 specs/api-endpoints.md
 * 输入：jd_id + 用户身份（从 JWT 获取）
 * 输出：4 维度匹配分析 + 差距/优势/简历优化建议
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { buildMatchInput, analyzeMatch } from "@/lib/match/analyzer";
import type { MatchAnalyzeResponse } from "@/lib/match/schema";

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
  let body: { jd_id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "INVALID_BODY", message: "请求格式错误" },
      { status: 400 }
    );
  }

  const { jd_id } = body;

  if (!jd_id || typeof jd_id !== "string") {
    return Response.json(
      { error: "MISSING_JD_ID", message: "缺少 jd_id 参数" },
      { status: 400 }
    );
  }

  // 3. 构建输入（加载 JD + 用户画像）
  let input;
  try {
    input = await buildMatchInput(jd_id, user.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "JD_NOT_FOUND") {
      return Response.json(
        { error: "JD_NOT_FOUND", message: "JD 不存在或无权访问" },
        { status: 404 }
      );
    }
    if (msg === "PORTRAIT_NOT_FOUND") {
      return Response.json(
        { error: "PORTRAIT_NOT_FOUND", message: "请先完成职业画像" },
        { status: 400 }
      );
    }
    if (msg === "INVALID_JD_DATA" || msg === "INVALID_PORTRAIT_DATA") {
      return Response.json(
        { error: "INVALID_DATA", message: "数据格式错误，请重试" },
        { status: 500 }
      );
    }
    console.error("[match-analyze] Build input failed:", msg);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "构建分析输入失败" },
      { status: 500 }
    );
  }

  // 4. AI 匹配分析
  let result;
  try {
    result = await analyzeMatch(input);
  } catch (err) {
    console.error("[match-analyze] AI analysis failed:", err);
    return Response.json(
      { error: "ANALYSIS_FAILED", message: "匹配分析失败，请重试" },
      { status: 500 }
    );
  }

  const { analysis, tokenUsage } = result;

  // 5. 持久化
  let matchResult;
  try {
    matchResult = await db.matchResult.create({
      data: {
        userId: user.id,
        jdId: jd_id,
        overallRating: analysis.overall_rating,
        dimensionsJson: JSON.stringify(analysis.dimensions),
        gapsJson: JSON.stringify(analysis.gaps),
        strengthsJson: JSON.stringify(analysis.strengths),
        resumeJson: JSON.stringify(analysis.resume_optimization),
        tokenUsage,
      },
    });
  } catch (dbErr) {
    console.error("[match-analyze] DB write failed:", dbErr);
    return Response.json(
      { error: "DB_ERROR", message: "保存匹配结果失败，请重试" },
      { status: 500 }
    );
  }

  // 6. 返回（对齐 api-endpoints.md 响应格式）
  const response: MatchAnalyzeResponse = {
    match_id: matchResult.id,
    overall_rating: analysis.overall_rating,
    dimensions: {
      技能匹配: {
        rating: analysis.dimensions.skill.rating,
        score: analysis.dimensions.skill.score,
        detail: analysis.dimensions.skill.detail,
      },
      经验匹配: {
        rating: analysis.dimensions.experience.rating,
        score: analysis.dimensions.experience.score,
        detail: analysis.dimensions.experience.detail,
      },
      薪资匹配: {
        rating: analysis.dimensions.salary.rating,
        score: analysis.dimensions.salary.score,
        detail: analysis.dimensions.salary.detail,
      },
      发展匹配: {
        rating: analysis.dimensions.development.rating,
        score: analysis.dimensions.development.score,
        detail: analysis.dimensions.development.detail,
      },
    },
    gaps: analysis.gaps,
    strengths: analysis.strengths,
    resume_optimization: analysis.resume_optimization,
  };

  return Response.json(response);
}
