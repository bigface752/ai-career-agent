/**
 * POST /api/portrait/extract
 * 触发 neat-freak 画像提炼
 *
 * 流程：
 * 1. 获取对话记录
 * 2. 获取现有画像
 * 3. AI 对比提炼变更
 * 4. 自动应用 new/updated 变更
 * 5. 存 contradicted 变更到 pending_updates
 * 6. 记录变更日志
 *
 * Body: { sessionId: string }
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import {
  getDialogueSession,
  getMessages,
} from "@/lib/dialogue/session-manager";
import {
  extractPortraitChanges,
  applyPortraitChanges,
  savePendingUpdates,
  savePortraitUpdateLog,
  type ExtractTrigger,
} from "@/lib/portrait/extractor";
import { savePortrait } from "@/lib/portrait/merger";
import { db } from "@/lib/db";
import type { PortraitTemplate } from "@/lib/portrait/schema";
import {
  notifyPortraitUpdated,
  notifyPortraitConflict,
} from "@/lib/notification";

export async function POST(req: NextRequest) {
  // 1. 认证
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  // 2. 解析请求
  let body: { sessionId?: string; trigger?: ExtractTrigger };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (!body.sessionId) {
    return Response.json({ error: "缺少 sessionId" }, { status: 400 });
  }

  const ALLOWED_TRIGGERS: ExtractTrigger[] = ["manual", "dialogue_round", "session_end"];
  const trigger: ExtractTrigger = ALLOWED_TRIGGERS.includes(body.trigger as ExtractTrigger)
    ? (body.trigger as ExtractTrigger)
    : "manual";

  // 3. 获取对话会话
  const session = await getDialogueSession(body.sessionId, user.id);
  if (!session) {
    return Response.json({ error: "会话不存在" }, { status: 404 });
  }

  if (session.status !== "active" && session.status !== "paused") {
    return Response.json(
      { error: "会话状态不可提炼（需要 active 或 paused）" },
      { status: 409 }
    );
  }

  // 4. 获取现有画像
  const portraitRecord = await db.portrait.findUnique({
    where: { userId: user.id },
  });

  if (!portraitRecord) {
    return Response.json(
      { error: "请先完成画像构建（POST /api/portrait/build）" },
      { status: 400 }
    );
  }

  let currentPortrait: PortraitTemplate;
  try {
    currentPortrait = JSON.parse(portraitRecord.portraitJson);
  } catch {
    console.error("画像JSON解析失败:", user.id);
    return Response.json({ error: "画像数据损坏" }, { status: 500 });
  }

  // 5. 获取对话消息
  const messages = await getMessages(session.id);

  if (messages.length === 0) {
    return Response.json(
      { error: "对话记录为空，无法提炼" },
      { status: 400 }
    );
  }

  // 幂等保护：按 trigger 类型区分策略
  // - manual/session_end: 同 session 只允许一次
  // - dialogue_round: 冷却期 5 分钟内不重复
  if (trigger === "dialogue_round") {
    const cooldown = new Date(Date.now() - 5 * 60 * 1000);
    const recentLog = await db.portraitUpdateLog.findFirst({
      where: { sessionId: session.id, trigger, createdAt: { gte: cooldown } },
    });
    if (recentLog) {
      return Response.json({
        changes: [],
        summary: "最近已提炼过，跳过",
      });
    }
  } else {
    const existingLog = await db.portraitUpdateLog.findFirst({
      where: { sessionId: session.id, trigger },
    });
    if (existingLog) {
      return Response.json(
        { error: "该会话已提炼过，请勿重复操作" },
        { status: 409 }
      );
    }
  }

  try {
    // 6. AI 提炼变更
    const result = await extractPortraitChanges({
      currentPortrait,
      messages,
    });

    if (result.changes.length === 0) {
      return Response.json({
        changes: [],
        summary: "未发现需要更新的信息",
        usage: result.usage,
      });
    }

    // 7. 分类处理
    const newUpdated = result.changes.filter(
      (c) => c.changeType === "new" || c.changeType === "updated"
    );
    const contradicted = result.changes.filter(
      (c) => c.changeType === "contradicted"
    );

    // 8. 应用 new/updated 变更到画像
    let updatedPortrait: PortraitTemplate | null = null;
    if (newUpdated.length > 0) {
      updatedPortrait = applyPortraitChanges(currentPortrait, newUpdated);
      await savePortrait(user.id, updatedPortrait, db);
    }

    // 9. 存 contradicted 变更到 pending_updates
    let pendingCount = 0;
    if (contradicted.length > 0) {
      pendingCount = await savePendingUpdates({
        userId: user.id,
        sessionId: session.id,
        changes: result.changes,
      });
    }

    // 10. 记录变更日志
    await savePortraitUpdateLog({
      userId: user.id,
      sessionId: session.id,
      changes: result.changes,
      trigger,
    });

    // 10.5 发送通知
    if (newUpdated.length > 0) {
      await notifyPortraitUpdated(user.id, session.id, newUpdated.length);
    }
    if (contradicted.length > 0) {
      await notifyPortraitConflict(user.id, session.id, contradicted.length);
    }

    // 11. 返回结果
    return Response.json({
      changes: result.changes.map((c) => ({
        field: c.field,
        changeType: c.changeType,
        newValue: c.newValue,
        currentValue: c.currentValue,
        evidence: c.evidence,
        confidence: c.confidence,
      })),
      summary: result.summary,
      applied: newUpdated.length,
      pendingCount,
      usage: result.usage,
    });
  } catch (error) {
    console.error("画像提炼失败:", error);
    return Response.json(
      { error: "画像提炼失败，请稍后重试" },
      { status: 500 }
    );
  }
}
