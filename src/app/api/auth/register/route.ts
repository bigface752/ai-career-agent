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
import { createRouteLogger } from "@/lib/logger";

const log = createRouteLogger("auth/register");

// 验证码有效期（10分钟）
const CODE_EXPIRY_MINUTES = 10;

// 邀请码业务错误（事务内抛出，外层捕获返回友好提示）
class InviteCodeError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "InviteCodeError";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, inviteCode } = await req.json();

    // 校验输入
    if (!email || !password) {
      return NextResponse.json(
        { error: "邮箱和密码不能为空" },
        { status: 400 }
      );
    }

    // 邀请码验证（灰度阶段必填）
    if (!inviteCode || typeof inviteCode !== "string") {
      return NextResponse.json(
        { error: "请输入邀请码" },
        { status: 400 }
      );
    }

    const normalizedCode = inviteCode.trim().toUpperCase();

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    // 检查邮箱是否已注册（事务外，只读）
    const existingUser = await db.user.findUnique({ where: { email } });

    if (existingUser?.emailVerified) {
      return NextResponse.json(
        { error: "该邮箱已注册，请直接登录" },
        { status: 409 }
      );
    }

    // 事务：邀请码条件消耗 + 用户创建/更新 + 验证码生成
    // 用条件更新消除 TOCTOU 竞态（P0-2）
    const result = await db.$transaction(async (tx) => {
      // 1. 条件消耗邀请码（原子操作，WHERE use_count < max_uses）
      const consumeResult = await tx.$executeRaw`
        UPDATE invite_codes
        SET use_count = use_count + 1
        WHERE code = ${normalizedCode}
          AND use_count < max_uses
          AND (expires_at IS NULL OR expires_at > datetime('now'))
      `;

      if (consumeResult === 0) {
        throw new InviteCodeError("INVALID", "邀请码无效或已用完");
      }

      // 2. 获取邀请码记录
      const invite = await tx.inviteCode.findUnique({
        where: { code: normalizedCode },
      });
      if (!invite) {
        throw new InviteCodeError("INVALID", "邀请码不存在");
      }

      // 3. 创建或更新用户
      let user;
      if (existingUser) {
        const passwordHash = await hashPassword(password);
        user = await tx.user.update({
          where: { id: existingUser.id },
          data: { passwordHash },
        });
        // 已有邀请码使用记录则跳过（P1-1）
        const existingUsage = await tx.inviteCodeUsage.findUnique({
          where: { codeId_userId: { codeId: invite.id, userId: user.id } },
        });
        if (!existingUsage) {
          await tx.inviteCodeUsage.create({
            data: { codeId: invite.id, userId: user.id },
          });
        }
      } else {
        const passwordHash = await hashPassword(password);
        user = await tx.user.create({
          data: { email, passwordHash },
        });
        await tx.inviteCodeUsage.create({
          data: { codeId: invite.id, userId: user.id },
        });
      }

      // 4. 生成验证码
      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);
      await tx.emailVerification.create({
        data: { userId: user.id, code, type: "register", expiresAt },
      });

      return { user, code };
    });

    // 发送验证码邮件
    const sent = await sendVerificationEmail(email, result.code);
    if (!sent) {
      console.log(`[DEV] 验证码 ${result.code} -> ${email}`);
    }

    log.info("注册成功", { userId: result.user.id });

    return NextResponse.json({
      message: "验证码已发送到邮箱",
      userId: result.user.id,
    });
  } catch (error) {
    if (error instanceof InviteCodeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    log.error("注册失败", { err: error as Error });
    return NextResponse.json(
      { error: "注册失败，请稍后重试" },
      { status: 500 }
    );
  }
}
