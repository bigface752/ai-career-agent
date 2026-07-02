/**
 * POST /api/auth/login
 * 登录：邮箱+密码 → JWT
 *
 * 安全规则：
 * - 密码错误5次锁定30分钟
 * - 单设备登录，踢掉旧设备
 * - 统一错误提示（不泄露邮箱是否存在）
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, signJWT, getTokenCookieHeader } from "@/lib/auth";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

export async function POST(req: NextRequest) {
  try {
    const { email, password, deviceInfo } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "邮箱和密码不能为空" },
        { status: 400 }
      );
    }

    // 查找用户（不泄露邮箱是否存在）
    const user = await db.user.findUnique({ where: { email } });

    // 统一错误信息，防止枚举攻击
    const invalidError = { error: "邮箱或密码错误" };

    if (!user) {
      // 用户不存在，但返回相同错误信息
      // 额外延迟防时序攻击
      await new Promise((r) => setTimeout(r, 100));
      return NextResponse.json(invalidError, { status: 401 });
    }

    // 检查是否被锁定
    if (user.lockedUntil) {
      if (user.lockedUntil > new Date()) {
        const remainingMinutes = Math.ceil(
          (user.lockedUntil.getTime() - Date.now()) / 60000
        );
        return NextResponse.json(
          { error: `账号已锁定，请${remainingMinutes}分钟后重试` },
          { status: 423 }
        );
      }
      // 锁定已过期，清除计数（给用户重新开始的机会）
      await db.user.update({
        where: { id: user.id },
        data: { loginAttempts: 0, lockedUntil: null },
      });
      user.loginAttempts = 0;
    }

    // 验证密码
    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      // 原子递增，避免并发竞态
      const updated = await db.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: { increment: 1 },
          // 达到上限时锁定（用条件更新避免额外查询）
          ...(user.loginAttempts + 1 >= MAX_ATTEMPTS && {
            lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
          }),
        },
      });

      // 安全兜底：并发场景下如果已超过阈值但未锁定，补锁
      if (updated.loginAttempts >= MAX_ATTEMPTS && !updated.lockedUntil) {
        await db.user.update({
          where: { id: user.id },
          data: {
            lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
          },
        });
      }

      return NextResponse.json(invalidError, { status: 401 });
    }

    // 密码正确，检查邮箱是否已验证
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "请先验证邮箱", userId: user.id, needVerify: true },
        { status: 403 }
      );
    }

    // ============================================================
    // 登录成功：重置计数 + 踢旧设备 + 创建新session + 签发JWT
    // ============================================================

    // 1. 删除该用户所有旧设备session（单设备登录）
    await db.deviceSession.deleteMany({ where: { userId: user.id } });

    // 2. 创建新设备session
    await db.deviceSession.create({
      data: {
        userId: user.id,
        deviceInfo: deviceInfo || req.headers.get("user-agent") || "unknown",
      },
    });

    // 3. 重置登录尝试次数 + 更新最后活跃时间
    await db.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastActiveAt: new Date(),
      },
    });

    // 4. 签发JWT
    const token = await signJWT(user.id);

    const res = NextResponse.json({
      message: "登录成功",
      token,
      user: { id: user.id, email: user.email },
    });

    // 设置 httpOnly cookie（middleware 读取用）
    res.headers.set("Set-Cookie", getTokenCookieHeader(token));

    return res;
  } catch (error) {
    console.error("登录失败:", error);
    return NextResponse.json(
      { error: "登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}
