/**
 * POST /api/invite/validate
 * 验证邀请码是否有效（注册前调用）
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createRouteLogger } from "@/lib/logger";

const log = createRouteLogger("invite/validate");

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "请输入邀请码" },
        { status: 400 }
      );
    }

    const normalized = code.trim().toUpperCase();

    const invite = await db.inviteCode.findUnique({
      where: { code: normalized },
    });

    if (!invite) {
      return NextResponse.json(
        { valid: false, error: "邀请码不存在" },
        { status: 404 }
      );
    }

    // 检查是否过期
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return NextResponse.json(
        { valid: false, error: "邀请码已过期" },
        { status: 410 }
      );
    }

    // 检查使用次数
    if (invite.useCount >= invite.maxUses) {
      return NextResponse.json(
        { valid: false, error: "邀请码已用完" },
        { status: 410 }
      );
    }

    return NextResponse.json({
      valid: true,
      label: invite.label,
    });
  } catch (error) {
    log.error("邀请码验证失败", { err: error as Error });
    return NextResponse.json(
      { error: "验证失败，请稍后重试" },
      { status: 500 }
    );
  }
}
