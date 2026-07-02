/**
 * POST /api/dialogue/start
 * 启动新的对话会话
 *
 * Body: { module: "career" | "match" | "interview" }
 * 返回: { sessionId, status, slotState, roundNumber, progress }
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import {
  createDialogueSession,
  getActiveSession,
  getSessionWithProgress,
} from "@/lib/dialogue/session-manager";

const VALID_MODULES = ["career", "match", "interview"];

export async function POST(req: NextRequest) {
  // 1. 认证
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  // 2. 解析请求
  let body: { module?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  const moduleName = body.module;
  if (!moduleName || !VALID_MODULES.includes(moduleName)) {
    return Response.json(
      { error: `module 必须是 ${VALID_MODULES.join(", ")} 之一` },
      { status: 400 }
    );
  }

  // 3. 检查是否已有 active/paused 的同模块会话
  const existing = await getActiveSession(user.id, moduleName);
  if (existing) {
    const withProgress = await getSessionWithProgress(existing.id, user.id);
    return Response.json(
      {
        error: "已有同模块进行中的对话",
        code: "SESSION_EXISTS",
        session: withProgress,
      },
      { status: 409 }
    );
  }

  // 4. 创建新会话
  const session = await createDialogueSession(user.id, moduleName);
  const withProgress = await getSessionWithProgress(session.id, user.id);

  return Response.json({
    sessionId: session.id,
    status: session.status,
    slotState: session.slotState,
    roundNumber: session.roundNumber,
    progress: withProgress?.progress ?? 0,
    filledCount: withProgress?.filledCount ?? 0,
    requiredCount: withProgress?.requiredCount ?? 0,
    pendingSlots: withProgress?.pendingSlots ?? [],
  });
}
