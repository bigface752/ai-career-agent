/**
 * POST /api/auth/forgot-password
 * 请求密码重置验证码
 *
 * 安全规则：
 * - 统一返回信息，不泄露邮箱是否存在
 * - 验证码10分钟过期
 * - 未验证邮箱的用户不发验证码（但返回相同信息）
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  generateVerificationCode,
  sendPasswordResetEmail,
} from "@/lib/auth";

const CODE_EXPIRY_MINUTES = 10;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "请输入邮箱" }, { status: 400 });
    }

    // 统一返回信息，防枚举攻击
    const successResponse = {
      message: "如果该邮箱已注册，验证码将发送到邮箱",
    };

    // 查找用户
    const user = await db.user.findUnique({ where: { email } });

    // 用户不存在或邮箱未验证，返回相同信息
    if (!user || !user.emailVerified) {
      // 额外延迟防时序攻击
      await new Promise((r) => setTimeout(r, 100));
      return NextResponse.json(successResponse);
    }

    // 生成验证码
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    await db.emailVerification.create({
      data: {
        userId: user.id,
        code,
        type: "reset",
        expiresAt,
      },
    });

    // 发送验证码邮件
    const sent = await sendPasswordResetEmail(email, code);
    if (!sent) {
      console.log(`[DEV] 密码重置验证码 ${code} -> ${email}`);
    }

    return NextResponse.json(successResponse);
  } catch (error) {
    console.error("请求密码重置失败:", error);
    return NextResponse.json(
      { error: "请求失败，请稍后重试" },
      { status: 500 }
    );
  }
}
