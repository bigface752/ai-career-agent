/**
 * GET /api/notifications — 获取当前用户未读通知
 * PATCH /api/notifications — 标记通知为已读
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { getUnreadNotifications, markNotificationRead } from "@/lib/notification";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  const notifications = await getUnreadNotifications(user.id);

  return Response.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      content: n.content,
      sessionId: n.sessionId,
      read: n.read,
      createdAt: n.createdAt,
    })),
    unreadCount: notifications.length,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  let body: { notificationId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (!body.notificationId) {
    return Response.json({ error: "缺少 notificationId" }, { status: 400 });
  }

  const success = await markNotificationRead(body.notificationId, user.id);

  if (!success) {
    return Response.json({ error: "通知不存在或无权操作" }, { status: 404 });
  }

  return Response.json({ success: true });
}
