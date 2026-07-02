/**
 * POST /api/auth/register
 * 注册：创建用户 + 生成验证码 + 发邮件
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  generateVerificationCode,
  sendVerificationEmail,
  validatePasswordStrength,
} from "@/lib/auth";

// 验证码有效期（10分钟）
const CODE_EXPIRY_MINUTES = 10;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // 校验输入
    if (!email || !password) {
      return NextResponse.json(
        { error: "邮箱和密码不能为空" },
        { status: 400 }
      );
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    // 检查邮箱是否已注册
    const existingUser = await db.user.findUnique({ where: { email } });

    let user;
    if (existingUser) {
      // 已注册但未验证：允许重新注册（更新密码）
      if (existingUser.emailVerified) {
        return NextResponse.json(
          { error: "该邮箱已注册，请直接登录" },
          { status: 409 }
        );
      }
      // 更新密码
      const passwordHash = await hashPassword(password);
      user = await db.user.update({
        where: { id: existingUser.id },
        data: { passwordHash },
      });
    } else {
      // 新用户
      const passwordHash = await hashPassword(password);
      user = await db.user.create({
        data: { email, passwordHash },
      });
    }

    // 生成验证码
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    await db.emailVerification.create({
      data: {
        userId: user.id,
        code,
        type: "register",
        expiresAt,
      },
    });

    // 发送验证码邮件
    const sent = await sendVerificationEmail(email, code);
    if (!sent) {
      console.log(`[DEV] 验证码 ${code} -> ${email}`);
    }

    return NextResponse.json({
      message: "验证码已发送到邮箱",
      userId: user.id,
    });
  } catch (error) {
    console.error("注册失败:", error);
    return NextResponse.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 }
    );
  }
}
