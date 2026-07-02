/**
 * POST /api/auth/verify
 * 验证邮箱：校验验证码 + 标记邮箱已验证
 *
 * 安全规则：
 * - 验证码错误超过5次自动标记已用（防暴力破解）
 * - 统一错误信息
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signJWT, getTokenCookieHeader } from "@/lib/auth";

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  try {
    const { userId, code } = await req.json();

    if (!userId || !code) {
      return NextResponse.json(
        { error: "缺少必要参数" },
        { status: 400 }
      );
    }

    // 查找未使用且未过期的验证码
    const verification = await db.emailVerification.findFirst({
      where: {
        userId,
        type: "register",
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { id: "desc" },
    });

    if (!verification) {
      return NextResponse.json(
        { error: "验证码已过期，请重新获取" },
        { status: 400 }
      );
    }

    // 检查尝试次数
    if (verification.attempts >= MAX_ATTEMPTS) {
      await db.emailVerification.update({
        where: { id: verification.id },
        data: { used: true },
      });
      return NextResponse.json(
        { error: "验证码已失效，请重新获取" },
        { status: 400 }
      );
    }

    if (verification.code !== code) {
      // 递增尝试次数
      await db.emailVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      return NextResponse.json(
        { error: "验证码错误" },
        { status: 400 }
      );
    }

    // 标记验证码已使用 + 用户邮箱已验证
    await db.$transaction([
      db.emailVerification.update({
        where: { id: verification.id },
        data: { used: true },
      }),
      db.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      }),
    ]);

    // 签发JWT
    const token = await signJWT(userId);

    const res = NextResponse.json({
      message: "邮箱验证成功",
      token,
    });

    // 设置 httpOnly cookie（middleware 读取用）
    res.headers.set("Set-Cookie", getTokenCookieHeader(token));

    return res;
  } catch (error) {
    console.error("验证失败:", error);
    return NextResponse.json(
      { error: "验证失败，请稍后重试" },
      { status: 500 }
    );
  }
}
