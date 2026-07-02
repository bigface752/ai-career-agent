/**
 * POST /api/match/parse-jd — 解析 JD
 * GET  /api/match/parse-jd — 列出当前用户的 JD 列表
 *
 * 对齐 specs/api-endpoints.md
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { parseJd } from "@/lib/jd/parser";

/**
 * GET /api/match/parse-jd
 * 列出当前用户的所有 JD（供面试入口选择）
 */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "请先登录" },
      { status: 401 }
    );
  }

  const jds = await db.jobDescription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      positionName: true,
      companyType: true,
      createdAt: true,
    },
  });

  return Response.json({
    jds: jds.map((jd) => ({
      id: jd.id,
      position: jd.positionName,
      company_type: jd.companyType || "未知",
    })),
  });
}

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
  let body: { jd_text?: string; input_method?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "INVALID_BODY", message: "请求格式错误" },
      { status: 400 }
    );
  }

  const { jd_text, input_method } = body;

  if (!jd_text || typeof jd_text !== "string" || jd_text.trim().length === 0) {
    return Response.json(
      { error: "MISSING_JD", message: "请输入JD内容" },
      { status: 400 }
    );
  }

  // 长度上限（防资源耗尽）
  const MAX_JD_LENGTH = 10000;
  if (jd_text.trim().length > MAX_JD_LENGTH) {
    return Response.json(
      { error: "TEXT_TOO_LONG", message: "JD内容过长，请控制在10000字以内" },
      { status: 400 }
    );
  }

  const method = input_method === "position_name" ? "position_name" : "text";

  // 3. 完整 JD 输入校验（过短视为无法识别）
  if (method === "text" && jd_text.trim().length < 20) {
    return Response.json(
      {
        error: "UNRECOGNIZABLE",
        message: "无法识别岗位信息，请尝试粘贴完整的JD",
      },
      { status: 400 }
    );
  }

  // 4. AI 解析
  let result;
  try {
    result = await parseJd(jd_text.trim(), method);
  } catch (err) {
    console.error("[parse-jd] AI parsing failed:", err);
    return Response.json(
      { error: "PARSING_FAILED", message: "JD解析失败，请重试" },
      { status: 500 }
    );
  }

  // 5. 持久化（不存原始 JD）
  let jd;
  try {
    jd = await db.jobDescription.create({
      data: {
        userId: user.id,
        positionName: result.parsed.position,
        companyType: result.parsed.company_type,
        confidence: result.confidence,
        parsedJson: JSON.stringify(result.parsed),
        inputMethod: method,
      },
    });
  } catch (dbErr) {
    console.error("[parse-jd] DB write failed:", dbErr);
    return Response.json(
      { error: "DB_ERROR", message: "保存解析结果失败，请重试" },
      { status: 500 }
    );
  }

  // 6. 返回（对齐 api-endpoints.md 响应格式）
  return Response.json({
    jd_id: jd.id,
    parsed_jd: result.parsed,
    confidence: result.confidence,
    note: result.note,
  });
}
