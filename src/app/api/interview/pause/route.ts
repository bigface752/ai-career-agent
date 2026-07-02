/**
 * POST /api/interview/pause
 * 暂停面试会话
 *
 * 对齐 specs/api-endpoints.md POST /api/dialogue/pause
 *
 * Body: { interview_id: string }
 * 返回: { interview_id, status, message }
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  // 1. 认证
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "请先登录" },
      { status: 401 }
    );
  }

  // 2. 解析请求
  let body: { interview_id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "INVALID_BODY", message: "请求格式错误" },
      { status: 400 }
    );
  }

  if (!body.interview_id) {
    return Response.json(
      { error: "MISSING_INTERVIEW_ID", message: "缺少 interview_id" },
      { status: 400 }
    );
  }

  // 3. 查找 session
  const session = await db.interviewSession.findFirst({
    where: {
      id: body.interview_id,
      userId: user.id,
    },
  });

  if (!session) {
    return Response.json(
      { error: "SESSION_NOT_FOUND", message: "面试会话不存在或无权访问" },
      { status: 404 }
    );
  }

  // 4. 只有 in_progress 状态才能暂停
  if (session.status !== "in_progress") {
    return Response.json(
      {
        error: "INVALID_STATUS",
        message: "当前状态无法暂停",
      },
      { status: 409 }
    );
  }

  // 5. 暂停：更新状态为 paused
  // 保留 session 数据和对话历史，用户可以恢复
  await db.interviewSession.update({
    where: { id: session.id },
    data: {
      status: "paused",
      lastActivityAt: new Date(),
    },
  });

  return Response.json({
    interview_id: session.id,
    status: "paused",
    message: "面试已暂停，你可以随时恢复继续",
  });
}
