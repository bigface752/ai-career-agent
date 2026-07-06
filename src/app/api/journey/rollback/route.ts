/**
 * POST /api/journey/rollback
 * 回退到上一步
 *
 * Body: { version: number }
 *
 * 返回: 更新后的旅程会话
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { rollbackJourney, formatSessionResponse } from "@/lib/journey";

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

  // 3. 回退旅程
  const result = await rollbackJourney(user.id, body.version);

  if (!result.success) {
    const statusMap: Record<string, number> = {
      JOURNEY_NOT_FOUND: 404,
      CONFLICT: 409,
      CANNOT_ROLLBACK: 422,
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
    CANNOT_ROLLBACK: "当前步骤无法回退",
  };
  return messages[code ?? ""] ?? "未知错误";
}
