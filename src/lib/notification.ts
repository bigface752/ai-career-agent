/**
 * 通知系统
 *
 * 站内通知（Notification 表）+ 邮件通知（Resend）
 * 用于会话过期提醒、清理通知等场景
 */

import { db } from "@/lib/db";
import { Resend } from "resend";

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@ai-career-agent.com";

let resend: Resend | null;
function getResend(): Resend {
  if (!resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      throw new Error("RESEND_API_KEY 未配置，邮件通知不可用");
    }
    resend = new Resend(key);
  }
  return resend;
}

// ============================================================
// 站内通知
// ============================================================

export type NotificationType =
  | "session_expiring"
  | "session_expired"
  | "session_cleaned"
  | "portrait_updated"
  | "portrait_conflict";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  sessionId?: string;
}

/**
 * 创建站内通知
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<string> {
  const notification = await db.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      content: params.content,
      sessionId: params.sessionId || null,
    },
  });

  return notification.id;
}

/**
 * 获取用户未读通知
 */
export async function getUnreadNotifications(userId: string) {
  return db.notification.findMany({
    where: { userId, read: false },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

/**
 * 标记通知为已读
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const result = await db.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });

  return result.count > 0;
}

// ============================================================
// 邮件通知
// ============================================================

/**
 * 发送会话即将过期邮件
 */
export async function sendSessionExpiringEmail(
  email: string,
  moduleName: string,
  hoursLeft: number
): Promise<boolean> {
  const moduleLabel = getModuleLabel(moduleName);

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `AI Career Agent - ${moduleLabel}对话即将过期`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>对话即将过期</h2>
          <p>你的<strong>${moduleLabel}</strong>对话将在 <strong>${hoursLeft} 小时</strong>后过期。</p>
          <p>过期后对话数据将被清除，已完成的进度不会丢失。</p>
          <div style="margin: 24px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dialogue"
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              继续对话
            </a>
          </div>
          <p style="color: #999; font-size: 12px;">如不操作，过期后数据将自动清理。</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("发送过期提醒邮件失败:", error);
    return false;
  }
}

/**
 * 发送会话已过期邮件
 */
export async function sendSessionExpiredEmail(
  email: string,
  moduleName: string
): Promise<boolean> {
  const moduleLabel = getModuleLabel(moduleName);

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `AI Career Agent - ${moduleLabel}对话已过期`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>对话已过期</h2>
          <p>你的<strong>${moduleLabel}</strong>对话已过期，系统将在 48 小时后自动清理相关数据。</p>
          <p>如需继续，请重新开始对话。</p>
          <div style="margin: 24px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dialogue"
               style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              开始新对话
            </a>
          </div>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("发送过期邮件失败:", error);
    return false;
  }
}

// ============================================================
// 组合通知（站内 + 邮件）
// ============================================================

/**
 * 发送会话即将过期通知（站内 + 邮件）
 */
export async function notifySessionExpiring(
  userId: string,
  email: string,
  sessionId: string,
  moduleName: string,
  hoursLeft: number
): Promise<void> {
  // 站内通知
  await createNotification({
    userId,
    type: "session_expiring",
    title: `${getModuleLabel(moduleName)}对话即将过期`,
    content: `你的对话将在 ${hoursLeft} 小时后过期，请尽快继续完成。`,
    sessionId,
  });

  // 邮件通知
  await sendSessionExpiringEmail(email, moduleName, hoursLeft);
}

/**
 * 发送会话已过期通知（站内 + 邮件）
 */
export async function notifySessionExpired(
  userId: string,
  email: string,
  sessionId: string,
  moduleName: string
): Promise<void> {
  // 站内通知
  await createNotification({
    userId,
    type: "session_expired",
    title: `${getModuleLabel(moduleName)}对话已过期`,
    content: "对话已过期，系统将在 48 小时后自动清理数据。",
    sessionId,
  });

  // 邮件通知
  await sendSessionExpiredEmail(email, moduleName);
}

/**
 * 发送会话已清理通知（仅站内）
 */
export async function notifySessionCleaned(
  userId: string,
  sessionId: string,
  moduleName: string
): Promise<void> {
  await createNotification({
    userId,
    type: "session_cleaned",
    title: `${getModuleLabel(moduleName)}对话数据已清理`,
    content: "过期对话数据已自动清理，如需分析请重新开始对话。",
    sessionId,
  });
}

// ============================================================
// 画像提炼通知
// ============================================================

/**
 * 画像已自动更新通知（new/updated 变更已应用）
 */
export async function notifyPortraitUpdated(
  userId: string,
  sessionId: string,
  appliedCount: number
): Promise<void> {
  await createNotification({
    userId,
    type: "portrait_updated",
    title: "画像已更新",
    content: `对话中发现 ${appliedCount} 个新信息，已自动更新到你的画像。`,
    sessionId,
  });
}

/**
 * 画像存在矛盾通知（contradicted 变更待审查）
 */
export async function notifyPortraitConflict(
  userId: string,
  sessionId: string,
  conflictCount: number
): Promise<void> {
  await createNotification({
    userId,
    type: "portrait_conflict",
    title: "画像信息待审查",
    content: `发现 ${conflictCount} 处信息矛盾，请前往审查确认。`,
    sessionId,
  });
}

// ============================================================
// 工具
// ============================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getModuleLabel(module: string): string {
  const labels: Record<string, string> = {
    career: "职业认知",
    match: "岗位匹配",
    interview: "面试辅导",
  };
  // 已知模块用中文，未知模块 HTML 转义后返回
  return labels[module] || escapeHtml(module);
}
