/**
 * POST /api/dialogue/cleanup
 *
 * 定时清理过期对话会话
 * 由 Vercel Cron 或外部定时任务触发
 *
 * 流程：
 * 1. 将 expiresAt < NOW() 的 active/paused 会话 → expired（发通知）
 * 2. 将 expiresAt 在 24h 内到期的会话 → 发送提醒通知
 * 3. 将 expired 超过 48h 的会话 → 事务内删除所有关联 + 会话 → 发通知
 *
 * 认证：通过 CRON_SECRET 环境变量验证调用来源
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  notifySessionExpiring,
  notifySessionExpired,
  notifySessionCleaned,
  notifyPortraitUpdated,
  notifyPortraitConflict,
} from "@/lib/notification";
import {
  extractPortraitChanges,
  applyPortraitChanges,
  savePendingUpdates,
  savePortraitUpdateLog,
} from "@/lib/portrait/extractor";
import { savePortrait } from "@/lib/portrait/merger";
import { getMessages } from "@/lib/dialogue/session-manager";
import type { PortraitTemplate } from "@/lib/portrait/schema";

// 清理 expired 超过 48 小时的会话
const CLEANUP_AFTER_HOURS = 48;
// 单次清理上限，防止 Serverless 超时
const CLEANUP_BATCH_SIZE = 50;

export async function POST(req: NextRequest) {
  // 1. 认证：验证 cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET 未配置");
    return Response.json({ error: "服务配置错误" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "未授权" }, { status: 401 });
  }

  const now = new Date();
  const results = {
    expired: 0,
    warned: 0,
    cleaned: 0,
    preCleanExtracted: 0,
    errors: [] as string[],
  };

  try {
    // ================================================================
    // Step 1: 标记过期会话（expiresAt < NOW() 且状态为 active/paused）
    // ================================================================
    const expiredSessions = await db.dialogueSession.findMany({
      where: {
        status: { in: ["active", "paused"] },
        expiresAt: { lt: now },
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    for (const session of expiredSessions) {
      try {
        if (!session.user) {
          results.errors.push(`用户不存在 session=${session.id}`);
          continue;
        }

        await db.dialogueSession.update({
          where: { id: session.id },
          data: { status: "expired", updatedAt: now },
        });

        await notifySessionExpired(
          session.userId,
          session.user.email,
          session.id,
          session.module
        );

        results.expired++;
      } catch (error) {
        const msg = `标记过期失败 session=${session.id}`;
        console.error(msg, error);
        results.errors.push(msg);
      }
    }

    // ================================================================
    // Step 2: 提醒即将过期的会话（24h 内到期，仍为 active/paused）
    // ================================================================
    const warningThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const expiringSessions = await db.dialogueSession.findMany({
      where: {
        status: { in: ["active", "paused"] },
        expiresAt: {
          gte: now,
          lte: warningThreshold,
        },
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    for (const session of expiringSessions) {
      try {
        if (!session.user || !session.expiresAt) {
          results.errors.push(`数据不完整 session=${session.id}`);
          continue;
        }

        const hoursLeft = Math.max(
          1,
          Math.round(
            (session.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)
          )
        );

        // 去重：24h 内已发过同类型通知则跳过
        const existingNotification = await db.notification.findFirst({
          where: {
            userId: session.userId,
            sessionId: session.id,
            type: "session_expiring",
            createdAt: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            },
          },
        });

        if (!existingNotification) {
          await notifySessionExpiring(
            session.userId,
            session.user.email,
            session.id,
            session.module,
            hoursLeft
          );
          results.warned++;
        }
      } catch (error) {
        const msg = `发送提醒失败 session=${session.id}`;
        console.error(msg, error);
        results.errors.push(msg);
      }
    }

    // ================================================================
    // Step 3: 清理过期超过 48h 的会话（批量上限 + 通知先于删除）
    // ================================================================
    const cleanupThreshold = new Date(
      now.getTime() - CLEANUP_AFTER_HOURS * 60 * 60 * 1000
    );

    const sessionsToClean = await db.dialogueSession.findMany({
      where: {
        status: "expired",
        updatedAt: { lt: cleanupThreshold },
      },
      take: CLEANUP_BATCH_SIZE,
    });

    for (const session of sessionsToClean) {
      try {
        // 先发通知（会话还存在时）
        await notifySessionCleaned(
          session.userId,
          session.id,
          session.module
        );

        // 删除前尝试提炼画像（session_end 触发，失败不阻塞清理）
        try {
          const existingLog = await db.portraitUpdateLog.findFirst({
            where: { sessionId: session.id, trigger: "session_end" },
          });

          if (!existingLog) {
            const portraitRecord = await db.portrait.findUnique({
              where: { userId: session.userId },
            });

            if (portraitRecord) {
              const messages = await getMessages(session.id);
              if (messages.length > 0) {
                const currentPortrait: PortraitTemplate = JSON.parse(
                  portraitRecord.portraitJson
                );
                const extractResult = await extractPortraitChanges({
                  currentPortrait,
                  messages,
                });

                if (extractResult.changes.length > 0) {
                  const newUpdated = extractResult.changes.filter(
                    (c) => c.changeType === "new" || c.changeType === "updated"
                  );
                  const contradicted = extractResult.changes.filter(
                    (c) => c.changeType === "contradicted"
                  );

                  if (newUpdated.length > 0) {
                    const updated = applyPortraitChanges(
                      currentPortrait,
                      newUpdated
                    );
                    await savePortrait(session.userId, updated, db);
                    await notifyPortraitUpdated(
                      session.userId,
                      session.id,
                      newUpdated.length
                    );
                  }

                  if (contradicted.length > 0) {
                    await savePendingUpdates({
                      userId: session.userId,
                      sessionId: session.id,
                      changes: extractResult.changes,
                    });
                    await notifyPortraitConflict(
                      session.userId,
                      session.id,
                      contradicted.length
                    );
                  }

                  await savePortraitUpdateLog({
                    userId: session.userId,
                    sessionId: session.id,
                    changes: extractResult.changes,
                    trigger: "session_end",
                  });

                  results.preCleanExtracted++;
                }
              }
            }
          }
        } catch (extractError) {
          // 提取失败不阻塞清理
          console.error(
            `[cleanup] 清理前提取失败 session=${session.id}`,
            extractError
          );
        }

        // 按依赖顺序删除所有关联记录（无 CASCADE，必须手动删）
        // 注：Prisma libsql adapter 不支持 $transaction 交互式事务，
        //     使用顺序删除。如果中间某步失败，外层 catch 会跳过该 session，
        //     下次 cron 运行时重试。
        await db.dialogueMessage.deleteMany({
          where: { sessionId: session.id },
        });
        await db.roundtableDiscussion.deleteMany({
          where: { sessionId: session.id },
        });
        await db.report.deleteMany({ where: { sessionId: session.id } });
        await db.portraitUpdateLog.deleteMany({
          where: { sessionId: session.id },
        });
        await db.pendingUpdate.deleteMany({
          where: { sessionId: session.id },
        });

        // 最后删除会话本身
        await db.dialogueSession.delete({
          where: { id: session.id },
        });

        results.cleaned++;
      } catch (error) {
        const msg = `清理失败 session=${session.id}`;
        console.error(msg, error);
        results.errors.push(msg);
      }
    }

    // ================================================================
    // 返回结果
    // ================================================================
    const summary = `过期标记: ${results.expired}, 提醒发送: ${results.warned}, 清理完成: ${results.cleaned}, 提炼提取: ${results.preCleanExtracted}`;
    console.log(`[cleanup] ${summary}`);

    return Response.json({
      success: true,
      timestamp: now.toISOString(),
      results: {
        expired: results.expired,
        warned: results.warned,
        cleaned: results.cleaned,
        preCleanExtracted: results.preCleanExtracted,
      },
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error) {
    console.error("[cleanup] 执行失败:", error);
    return Response.json(
      { success: false, error: "内部错误" },
      { status: 500 }
    );
  }
}
