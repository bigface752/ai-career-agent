/**
 * POST /api/invite/generate
 * 生成邀请码（管理员用）
 * 需要认证 + 管理员权限
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";
import { createRouteLogger } from "@/lib/logger";
import crypto from "crypto";

const log = createRouteLogger("invite/generate");

// 管理员邮箱白名单（从环境变量读取）
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function generateInviteCode(): string {
  // 生成 8 位大写字母+数字，如 "A3K9-B2X7"
  const bytes = crypto.randomBytes(5);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉容易混淆的 I/O/0/1
  let code = "";
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += "-";
    code += chars[bytes[i % 5] % chars.length];
  }
  return code;
}

export async function POST(req: NextRequest) {
  try {
    // 验证认证
    const token =
      req.headers.get("authorization")?.replace("Bearer ", "") ||
      req.cookies.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: "登录已过期" }, { status: 401 });
    }

    // 验证管理员权限
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { email: true },
    });

    if (!user || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    // 解析参数（P1-2：输入验证）
    const { count = 1, maxUses = 1, expiresInDays, label } = await req.json();

    if (!Number.isInteger(count) || count < 1 || count > 100) {
      return NextResponse.json({ error: "生成数量 1-100" }, { status: 400 });
    }
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000) {
      return NextResponse.json({ error: "maxUses 1-10000" }, { status: 400 });
    }
    if (
      expiresInDays !== undefined &&
      (!Number.isInteger(expiresInDays) || expiresInDays < 1)
    ) {
      return NextResponse.json({ error: "expiresInDays 至少 1" }, { status: 400 });
    }

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // 批量生成（P1-3：收集后一次事务插入）
    const codes: string[] = [];
    const batch: { code: string; label: string | null; maxUses: number; expiresAt: Date | null }[] = [];

    for (let i = 0; i < count; i++) {
      let code = generateInviteCode();
      let attempts = 0;
      while (
        (await db.inviteCode.findUnique({ where: { code } })) &&
        attempts < 10
      ) {
        code = generateInviteCode();
        attempts++;
      }
      if (attempts >= 10) {
        log.error("邀请码生成冲突", { attempts });
        continue;
      }
      codes.push(code);
      batch.push({ code, label: label || null, maxUses, expiresAt });
    }

    // 批量插入
    await db.$transaction(
      batch.map((item) =>
        db.inviteCode.create({ data: item })
      )
    );

    log.info("邀请码已生成", { count: codes.length });

    return NextResponse.json({
      codes,
      maxUses,
      expiresAt: expiresAt?.toISOString() || null,
    });
  } catch (error) {
    log.error("邀请码生成失败", { err: error as Error });
    return NextResponse.json(
      { error: "生成失败，请稍后重试" },
      { status: 500 }
    );
  }
}
