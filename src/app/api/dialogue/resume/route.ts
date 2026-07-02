/**
 * POST /api/dialogue/resume
 * 恢复暂停的对话会话
 *
 * Body: { sessionId: string }
 * 返回: 完整会话状态（slotState + recentWindow + initialFindings + roundNumber + progress）
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import {
  resumeDialogueSession,
  getSessionWithProgress,
  getMessages,
} from "@/lib/dialogue/session-manager";

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

  // 3. 恢复会话
  const session = await resumeDialogueSession(body.sessionId, user.id);
  if (!session) {
    return Response.json(
      { error: "会话不存在或当前不是 paused 状态" },
      { status: 404 }
    );
  }

  // 4. 返回完整状态
  const withProgress = await getSessionWithProgress(session.id, user.id);

  // 5. 获取完整历史消息
  const messages = await getMessages(session.id);

  return Response.json({
    sessionId: session.id,
    status: session.status,
    module: session.module,
    slotState: session.slotState,
    recentWindow: session.recentWindow,
    initialFindings: session.initialFindings,
    roundNumber: session.roundNumber,
    progress: withProgress?.progress ?? 0,
    filledCount: withProgress?.filledCount ?? 0,
    requiredCount: withProgress?.requiredCount ?? 0,
    pendingSlots: withProgress?.pendingSlots ?? [],
    expiresAt: session.expiresAt,
    messages, // 完整历史消息
  });
}
