/**
 * 旅程状态管理
 *
 * 状态机：
 *   intake → diagnosis → coaching → complete
 *
 * 每个步骤有三个状态：pending → in_progress → completed
 *
 * 步骤数据校验规则：
 *   - intake: 对话会话的 slot 填充率 >= 1.0
 *   - diagnosis: 职业画像 completion >= 1.0
 *   - coaching: 存在竞争力评估记录
 *   - complete: 无需校验
 */
import { db } from "@/lib/db";
import type { JourneyStep, StepStatus, JourneySession } from "@/generated/prisma/client";

// ============================================================
// 状态机定义
// ============================================================

/** 步骤顺序 */
const STEP_ORDER: JourneyStep[] = ["intake", "diagnosis", "coaching", "complete"];

/** 获取下一步 */
export function getNextStep(current: JourneyStep): JourneyStep | null {
  const idx = STEP_ORDER.indexOf(current);
  if (idx < 0 || idx >= STEP_ORDER.length - 1) return null;
  return STEP_ORDER[idx + 1];
}

/** 获取上一步 */
export function getPrevStep(current: JourneyStep): JourneyStep | null {
  const idx = STEP_ORDER.indexOf(current);
  if (idx <= 0) return null;
  return STEP_ORDER[idx - 1];
}

/** 验证步骤转换是否合法 */
export function isValidTransition(
  currentStep: JourneyStep,
  currentStatus: StepStatus,
  action: "advance" | "rollback"
): boolean {
  if (action === "advance") {
    // 只有 completed 状态才能推进到下一步
    return currentStatus === "completed";
  }
  if (action === "rollback") {
    // 只有 completed 状态可以回退（pending/in_progress 不可回退）
    if (currentStatus !== "completed") return false;
    // 第一步不能回退
    return currentStep !== "intake";
  }
  return false;
}

// ============================================================
// 数据库操作
// ============================================================

/** 获取用户的旅程会话 */
export async function getJourneySession(userId: string): Promise<JourneySession | null> {
  return db.journeySession.findUnique({
    where: { userId },
  });
}

/** 创建新的旅程会话 */
export async function createJourneySession(userId: string): Promise<JourneySession> {
  return db.journeySession.create({
    data: {
      userId,
      currentStep: "intake",
      stepStatus: "pending",
    },
  });
}

/** 获取或创建旅程会话 */
export async function getOrCreateJourneySession(userId: string): Promise<JourneySession> {
  const existing = await getJourneySession(userId);
  if (existing) return existing;
  return createJourneySession(userId);
}

/** 更新步骤状态 */
export async function updateStepStatus(
  sessionId: string,
  stepStatus: StepStatus,
  stepData?: Record<string, unknown>
): Promise<JourneySession> {
  return db.journeySession.update({
    where: { id: sessionId },
    data: {
      stepStatus,
      stepData: stepData ? JSON.stringify(stepData) : undefined,
    },
  });
}

/** 推进到下一步 */
export async function advanceJourney(
  userId: string,
  currentVersion: number
): Promise<{ success: boolean; session?: JourneySession; error?: string }> {
  const session = await getJourneySession(userId);
  if (!session) {
    return { success: false, error: "JOURNEY_NOT_FOUND" };
  }

  // 验证版本号（乐观锁）
  if (session.version !== currentVersion) {
    return { success: false, error: "CONFLICT" };
  }

  // 验证状态转换
  if (!isValidTransition(session.currentStep, session.stepStatus, "advance")) {
    return { success: false, error: "CANNOT_ADVANCE" };
  }

  // 验证步骤数据是否满足推进条件
  const gate = await validateStepData(userId, session.currentStep);
  if (!gate.allowed) {
    return { success: false, error: "STEP_REQUIREMENTS_NOT_MET" };
  }

  const nextStep = getNextStep(session.currentStep);
  if (!nextStep) {
    return { success: false, error: "ALREADY_COMPLETE" };
  }

  // 更新：当前步骤加入已完成列表，推进到下一步
  const completedSteps = parseCompletedSteps(session.completedSteps);
  completedSteps.push(session.currentStep);

  try {
    const updated = await db.journeySession.update({
      where: {
        id: session.id,
        version: currentVersion, // 乐观锁
      },
      data: {
        currentStep: nextStep,
        stepStatus: nextStep === "complete" ? "completed" : "pending",
        completedSteps: JSON.stringify(completedSteps),
        stepData: null, // 清空步骤数据
        version: { increment: 1 },
      },
    });

    return { success: true, session: updated };
  } catch (error: unknown) {
    // Prisma P2025 = Record not found (乐观锁冲突)
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return { success: false, error: "CONFLICT" };
    }
    throw error;
  }
}

/** 回退到上一步 */
export async function rollbackJourney(
  userId: string,
  currentVersion: number
): Promise<{ success: boolean; session?: JourneySession; error?: string }> {
  const session = await getJourneySession(userId);
  if (!session) {
    return { success: false, error: "JOURNEY_NOT_FOUND" };
  }

  // 验证版本号（乐观锁）
  if (session.version !== currentVersion) {
    return { success: false, error: "CONFLICT" };
  }

  // 验证状态转换
  if (!isValidTransition(session.currentStep, session.stepStatus, "rollback")) {
    return { success: false, error: "CANNOT_ROLLBACK" };
  }

  const prevStep = getPrevStep(session.currentStep);
  if (!prevStep) {
    return { success: false, error: "CANNOT_ROLLBACK" };
  }

  // 更新：从已完成列表移除上一步，回退到上一步
  const completedSteps = parseCompletedSteps(session.completedSteps);
  const idx = completedSteps.lastIndexOf(prevStep);
  if (idx >= 0) completedSteps.splice(idx, 1);

  try {
    const updated = await db.journeySession.update({
      where: {
        id: session.id,
        version: currentVersion, // 乐观锁
      },
      data: {
        currentStep: prevStep,
        stepStatus: "completed", // 回退的步骤默认已完成（可以重新进入）
        completedSteps: JSON.stringify(completedSteps),
        stepData: null,
        version: { increment: 1 },
      },
    });

    return { success: true, session: updated };
  } catch (error: unknown) {
    // Prisma P2025 = Record not found (乐观锁冲突)
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return { success: false, error: "CONFLICT" };
    }
    throw error;
  }
}

// ============================================================
// 步骤数据校验
// ============================================================

/** 步骤校验结果 */
export interface StepGateResult {
  allowed: boolean;
  missing: string[];
  progress: number; // 0-1
}

/** 校验步骤数据是否满足推进条件 */
export async function validateStepData(
  userId: string,
  step: JourneyStep
): Promise<StepGateResult> {
  switch (step) {
    case "intake": {
      // 检查对话会话的 slot 填充率
      const session = await db.dialogueSession.findFirst({
        where: { userId, module: "career", status: { not: "expired" } },
        orderBy: { updatedAt: "desc" },
      });
      if (!session) {
        return { allowed: false, missing: ["dialogue_session"], progress: 0 };
      }
      // 简化检查：如果有 session 且 roundNumber > 0，认为 intake 已开始
      const progress = session.roundNumber > 0 ? Math.min(session.roundNumber / 5, 1) : 0;
      return {
        allowed: progress >= 1.0,
        missing: progress < 1.0 ? ["dialogue_incomplete"] : [],
        progress,
      };
    }
    case "diagnosis": {
      // 检查职业画像完成度
      const portrait = await db.portrait.findUnique({
        where: { userId },
      });
      if (!portrait) {
        return { allowed: false, missing: ["portrait"], progress: 0 };
      }
      return {
        allowed: portrait.completion >= 1.0,
        missing: portrait.completion < 1.0 ? ["portrait_incomplete"] : [],
        progress: portrait.completion,
      };
    }
    case "coaching": {
      // 检查是否存在竞争力评估
      const evaluation = await db.evaluation.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      if (!evaluation) {
        return { allowed: false, missing: ["evaluation"], progress: 0 };
      }
      return { allowed: true, missing: [], progress: 1 };
    }
    case "complete":
      return { allowed: true, missing: [], progress: 1 };
  }
}

// ============================================================
// 辅助函数
// ============================================================

/** 解析已完成步骤 */
function parseCompletedSteps(json: string | null): JourneyStep[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as JourneyStep[];
  } catch {
    return [];
  }
}

/** 格式化会话响应 */
export function formatSessionResponse(session: JourneySession) {
  return {
    id: session.id,
    currentStep: session.currentStep,
    stepStatus: session.stepStatus,
    stepData: session.stepData ? JSON.parse(session.stepData) : null,
    completedSteps: parseCompletedSteps(session.completedSteps),
    version: session.version,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

/** 获取步骤进度（包含校验结果） */
export async function getStepProgress(userId: string): Promise<{
  currentStep: JourneyStep;
  stepStatus: StepStatus;
  gate: StepGateResult;
} | null> {
  const session = await getJourneySession(userId);
  if (!session) return null;

  const gate = await validateStepData(userId, session.currentStep);

  return {
    currentStep: session.currentStep,
    stepStatus: session.stepStatus,
    gate,
  };
}
