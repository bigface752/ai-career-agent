/**
 * 认证中间件工具
 * 从请求中提取JWT，验证token有效性，检查设备session
 */
import { NextRequest } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { db } from "@/lib/db";

export interface AuthUser {
  id: string;
  email: string;
}

/**
 * 从请求中获取已认证用户
 * 返回null表示未认证或token无效
 */
export async function getAuthUser(
  req: NextRequest
): Promise<AuthUser | null> {
  try {
    // 优先从 Authorization header 提取 token，回退到 cookie
    let token: string | undefined;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else {
      token = req.cookies.get("token")?.value;
    }

    if (!token) {
      return null;
    }

    // 验证JWT
    const payload = await verifyJWT(token);
    if (!payload) {
      return null;
    }

    // 查找用户
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!user || !user.emailVerified) {
      return null;
    }

    // 检查设备session是否存在（单设备登录：登录时删除旧session）
    // 如果session被删（被踢），token仍有效但业务层应拒绝
    const deviceSession = await db.deviceSession.findFirst({
      where: { userId: user.id },
    });

    if (!deviceSession) {
      // 没有活跃设备session，说明已被踢下线
      return null;
    }

    // 更新最后活跃时间
    await db.deviceSession.update({
      where: { id: deviceSession.id },
      data: { lastActiveAt: new Date() },
    });

    return { id: user.id, email: user.email };
  } catch {
    return null;
  }
}
