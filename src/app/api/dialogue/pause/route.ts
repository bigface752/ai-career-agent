/**
 * POST /api/dialogue/pause
 * 暂停对话会话
 *
 * Body: { sessionId: string }
 * 返回: { sessionId, status }
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { pauseDialogueSession } from "@/lib/dialogue/session-manager";

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

  // 3. 暂停会话
  const session = await pauseDialogueSession(body.sessionId, user.id);
  if (!session) {
    return Response.json(
      { error: "会话不存在或当前不是 active 状态" },
      { status: 404 }
    );
  }

  return Response.json({
    sessionId: session.id,
    status: session.status,
  });
}
