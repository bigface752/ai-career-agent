/**
 * Dialogue Session Manager
 *
 * 封装 dialogue_sessions 和 dialogue_messages 的数据库操作
 * 供各 API 路由调用
 */

import { db } from '@/lib/db';
import {
  createSlotState,
  parseSlotState,
  serializeSlotState,
  parseRecentWindow,
  getRequiredSlotsForModule,
  getCompletionRate,
} from './index';
import type { SlotState, DialogueTurn } from './types';
import { DEFAULT_EXPIRY_DAYS } from './types';

// ============================================================
// 类型
// ============================================================

export interface DialogueSessionData {
  id: string;
  userId: string;
  module: string;
  status: string;
  slotState: SlotState;
  recentWindow: DialogueTurn[];
  initialFindings: string[];
  roundNumber: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}

export interface SessionWithProgress extends DialogueSessionData {
  progress: number; // 0-1
  filledCount: number;
  requiredCount: number;
  pendingSlots: string[];
}

// ============================================================
// 创建
// ============================================================

/**
 * 创建新的对话会话
 *
 * @param userId 用户 ID
 * @param module 模块：career / match / interview
 * @returns 新创建的会话数据
 */
export async function createDialogueSession(
  userId: string,
  module: string
): Promise<DialogueSessionData> {
  const slotState = createSlotState();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + DEFAULT_EXPIRY_DAYS);

  const session = await db.dialogueSession.create({
    data: {
      userId,
      module,
      status: 'active',
      slotState: serializeSlotState(slotState),
      recentWindow: JSON.stringify([]),
      initialFindings: JSON.stringify([]),
      roundNumber: 0,
      expiresAt,
    },
  });

  return {
    id: session.id,
    userId: session.userId,
    module: session.module,
    status: session.status,
    slotState,
    recentWindow: [],
    initialFindings: [],
    roundNumber: session.roundNumber,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
  };
}

// ============================================================
// 查询
// ============================================================

/**
 * 获取指定会话（验证所有权）
 */
export async function getDialogueSession(
  sessionId: string,
  userId: string
): Promise<DialogueSessionData | null> {
  const session = await db.dialogueSession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) return null;

  return parseSessionRow(session);
}

/**
 * 获取用户某模块的活跃或暂停会话
 *
 * 优先返回 active，其次 paused
 */
export async function getActiveSession(
  userId: string,
  module: string
): Promise<DialogueSessionData | null> {
  const session = await db.dialogueSession.findFirst({
    where: {
      userId,
      module,
      status: { in: ['active', 'paused'] },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!session) return null;

  return parseSessionRow(session);
}

/**
 * 获取会话 + 进度信息
 */
export async function getSessionWithProgress(
  sessionId: string,
  userId: string
): Promise<SessionWithProgress | null> {
  const session = await getDialogueSession(sessionId, userId);
  if (!session) return null;

  const requiredSlots = getRequiredSlotsForModule(session.module);
  const progress = getCompletionRate(session.slotState, requiredSlots);
  const filledCount = requiredSlots.filter(
    (s) => session.slotState.filled[s.name]?.confirmed
  ).length;
  const pendingSlots = requiredSlots
    .filter((s) => s.required && !session.slotState.filled[s.name]?.confirmed)
    .map((s) => s.name);

  return {
    ...session,
    progress,
    filledCount,
    requiredCount: requiredSlots.length,
    pendingSlots,
  };
}

// ============================================================
// 状态变更
// ============================================================

/**
 * 暂停会话
 */
export async function pauseDialogueSession(
  sessionId: string,
  userId: string
): Promise<DialogueSessionData | null> {
  const session = await db.dialogueSession.findFirst({
    where: { id: sessionId, userId, status: 'active' },
  });

  if (!session) return null;

  const updated = await db.dialogueSession.update({
    where: { id: sessionId },
    data: { status: 'paused', updatedAt: new Date() },
  });

  return parseSessionRow(updated);
}

/**
 * 恢复会话
 *
 * 恢复时刷新过期时间
 */
export async function resumeDialogueSession(
  sessionId: string,
  userId: string
): Promise<DialogueSessionData | null> {
  // 幂等处理：对 paused 或 active 状态的会话都返回成功
  // 避免 resume 成功但后续查询失败时，会话卡在 active 状态无法再次 resume
  const session = await db.dialogueSession.findFirst({
    where: { id: sessionId, userId, status: { in: ['paused', 'active'] } },
  });

  if (!session) return null;

  // 如果已经是 active 状态，直接返回（幂等）
  if (session.status === 'active') {
    return parseSessionRow(session);
  }

  // paused 状态，执行恢复
  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + DEFAULT_EXPIRY_DAYS);

  const updated = await db.dialogueSession.update({
    where: { id: sessionId },
    data: {
      status: 'active',
      expiresAt: newExpiry,
      updatedAt: new Date(),
    },
  });

  return parseSessionRow(updated);
}

// ============================================================
// 消息操作
// ============================================================

/**
 * 保存对话消息
 */
export async function saveMessage(
  sessionId: string,
  role: 'user' | 'assistant' | 'agent',
  content: string,
  agentId?: string,
  extractedInfo?: Record<string, unknown>
): Promise<string> {
  const message = await db.dialogueMessage.create({
    data: {
      sessionId,
      role,
      content,
      agentId: agentId || null,
      extractedInfo: extractedInfo ? JSON.stringify(extractedInfo) : null,
    },
  });

  return message.id;
}

/**
 * 获取会话的历史消息
 *
 * 不限制数量，按时间正序返回所有消息
 * 会话消息量有限（设计上 4-6 轮约 12 条），不需要分页
 */
export async function getMessages(
  sessionId: string
): Promise<Array<{ role: string; content: string; createdAt: Date }>> {
  const messages = await db.dialogueMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    select: { role: true, content: true, createdAt: true },
  });

  return messages;
}

// ============================================================
// 状态更新
// ============================================================

/**
 * 更新会话的 Slot 状态、滑动窗口、轮次
 */
export async function updateSessionState(
  sessionId: string,
  updates: {
    slotState?: SlotState;
    recentWindow?: DialogueTurn[];
    initialFindings?: string[];
    roundNumber?: number;
  }
): Promise<void> {
  const data: Record<string, unknown> = { updatedAt: new Date() };

  if (updates.slotState) {
    data.slotState = serializeSlotState(updates.slotState);
  }
  if (updates.recentWindow) {
    data.recentWindow = JSON.stringify(updates.recentWindow);
  }
  if (updates.initialFindings) {
    data.initialFindings = JSON.stringify(updates.initialFindings);
  }
  if (updates.roundNumber !== undefined) {
    data.roundNumber = updates.roundNumber;
  }

  await db.dialogueSession.update({
    where: { id: sessionId },
    data,
  });
}

// ============================================================
// 内部工具
// ============================================================

/**
 * 将数据库行解析为 DialogueSessionData
 */
function parseSessionRow(session: {
  id: string;
  userId: string;
  module: string;
  status: string;
  slotState: string | null;
  recentWindow: string | null;
  initialFindings: string | null;
  roundNumber: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
}): DialogueSessionData {
  return {
    id: session.id,
    userId: session.userId,
    module: session.module,
    status: session.status,
    slotState: parseSlotState(session.slotState),
    recentWindow: parseRecentWindow(session.recentWindow),
    initialFindings: session.initialFindings
      ? JSON.parse(session.initialFindings)
      : [],
    roundNumber: session.roundNumber,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
  };
}
