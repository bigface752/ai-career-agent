/**
 * POST /api/auth/reset-password
 * 重置密码：校验验证码 + 更新密码 + 踢掉所有设备session
 *
 * 安全规则：
 * - 统一错误信息，不泄露邮箱是否存在
 * - 验证码使用后标记已用
 * - 密码重置后踢掉所有旧设备session
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, code, newPassword } = await req.json();

    if (!email || !code || !newPassword) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      );
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    // 统一错误信息
    const invalidError = { error: "验证码错误或已过期" };

    // 查找用户
    const user = await db.user.findUnique({ where: { email } });

    if (!user || !user.emailVerified) {
      // 额外延迟防时序攻击
      await new Promise((r) => setTimeout(r, 100));
      return NextResponse.json(invalidError, { status: 400 });
    }

    // 查找未使用且未过期的验证码
    const verification = await db.emailVerification.findFirst({
      where: {
        userId: user.id,
        type: "reset",
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { id: "desc" },
    });

    if (!verification || verification.code !== code) {
      return NextResponse.json(invalidError, { status: 400 });
    }

    // 更新密码 + 标记验证码已用 + 删除所有session（事务）
    const passwordHash = await hashPassword(newPassword);

    await db.$transaction([
      db.emailVerification.update({
        where: { id: verification.id },
        data: { used: true },
      }),
      db.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          loginAttempts: 0,
          lockedUntil: null,
        },
      }),
      db.deviceSession.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    return NextResponse.json({
      message: "密码重置成功，请重新登录",
    });
  } catch (error) {
    console.error("密码重置失败:", error);
    return NextResponse.json(
      { error: "密码重置失败，请稍后重试" },
      { status: 500 }
    );
  }
}
