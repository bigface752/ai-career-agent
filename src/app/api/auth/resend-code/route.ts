/**
 * POST /api/auth/resend-code
 * 重发验证码
 *
 * 安全规则：
 * - 后端60秒速率限制（查最近一条记录的createdAt）
 * - 统一错误信息
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  generateVerificationCode,
  sendVerificationEmail,
} from "@/lib/auth";

const CODE_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: "邮箱已验证" }, { status: 400 });
    }

    // 后端60秒速率限制：查最近一条验证码记录
    const recentCode = await db.emailVerification.findFirst({
      where: { userId, type: "register" },
      orderBy: { id: "desc" },
    });

    if (recentCode) {
      const elapsed = (Date.now() - new Date(recentCode.createdAt).getTime()) / 1000;
      if (elapsed < RESEND_COOLDOWN_SECONDS) {
        const remaining = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
        return NextResponse.json(
          { error: `${remaining}秒后才能重发` },
          { status: 429 }
        );
      }
    }

    // 生成新验证码
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    await db.emailVerification.create({
      data: { userId, code, type: "register", expiresAt },
    });

    // 发送邮件
    const sent = await sendVerificationEmail(user.email, code);
    if (!sent) {
      console.error(`[ERROR] 验证码邮件发送失败: ${user.email}`);
    }

    return NextResponse.json({ message: "验证码已重新发送" });
  } catch (error) {
    console.error("重发验证码失败:", error);
    return NextResponse.json(
      { error: "重发失败，请稍后重试" },
      { status: 500 }
    );
  }
}
