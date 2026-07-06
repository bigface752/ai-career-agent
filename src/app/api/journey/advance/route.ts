/**
 * POST /api/journey/advance
 * 推进到下一步
 *
 * Body: { version: number }
 *
 * 返回: 更新后的旅程会话
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { advanceJourney, formatSessionResponse } from "@/lib/journey";

export async function POST(req: NextRequest) {
  // 1. 认证
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  // 2. 解析请求体
  let body: { version?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "INVALID_BODY", message: "请求体格式错误" },
      { status: 400 }
    );
  }

  if (typeof body.version !== "number") {
    return Response.json(
      { error: "INVALID_VERSION", message: "需要 version 参数" },
      { status: 400 }
    );
  }

  // 3. 推进旅程
  const result = await advanceJourney(user.id, body.version);

  if (!result.success) {
    const statusMap: Record<string, number> = {
      JOURNEY_NOT_FOUND: 404,
      CONFLICT: 409,
      CANNOT_ADVANCE: 422,
      ALREADY_COMPLETE: 422,
      STEP_REQUIREMENTS_NOT_MET: 422,
    };
    const status = statusMap[result.error ?? ""] ?? 500;

    return Response.json(
      { error: result.error, message: getErrorMessage(result.error) },
      { status }
    );
  }

  return Response.json({
    session: formatSessionResponse(result.session!),
  });
}

function getErrorMessage(code?: string): string {
  const messages: Record<string, string> = {
    JOURNEY_NOT_FOUND: "旅程不存在",
    CONFLICT: "数据冲突，请刷新后重试",
    CANNOT_ADVANCE: "当前步骤无法推进",
    ALREADY_COMPLETE: "旅程已完成",
    STEP_REQUIREMENTS_NOT_MET: "当前步骤未完成，无法推进",
  };
  return messages[code ?? ""] ?? "未知错误";
}
