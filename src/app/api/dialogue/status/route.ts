/**
 * GET /api/dialogue/status
 * 查询对话会话状态
 *
 * Query params:
 *   - sessionId: 指定会话 ID
 *   - module: 按模块查找最新会话（career / match / interview）
 *
 * 两个参数二选一，优先 sessionId
 * 返回: 会话状态 + 进度，无会话时返回 { session: null }
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import {
  getActiveSession,
  getSessionWithProgress,
} from "@/lib/dialogue/session-manager";

export async function GET(req: NextRequest) {
  // 1. 认证
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  const moduleName = searchParams.get("module");

  // 2. 按 sessionId 查询
  if (sessionId) {
    const session = await getSessionWithProgress(sessionId, user.id);
    if (!session) {
      return Response.json({ session: null });
    }

    return Response.json({
      session: {
        sessionId: session.id,
        status: session.status,
        module: session.module,
        slotState: session.slotState,
        recentWindow: session.recentWindow,
        initialFindings: session.initialFindings,
        roundNumber: session.roundNumber,
        progress: session.progress,
        filledCount: session.filledCount,
        requiredCount: session.requiredCount,
        pendingSlots: session.pendingSlots,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt,
      },
    });
  }

  // 3. 按 module 查询
  if (moduleName) {
    const session = await getActiveSession(user.id, moduleName);
    if (!session) {
      return Response.json({ session: null });
    }

    const withProgress = await getSessionWithProgress(session.id, user.id);

    return Response.json({
      session: {
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
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt,
      },
    });
  }

  return Response.json(
    { error: "需要 sessionId 或 module 参数" },
    { status: 400 }
  );
}
