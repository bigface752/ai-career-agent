/**
 * POST /api/journey/step
 * 更新当前步骤状态（开始/完成/更新数据）
 *
 * Body: { stepStatus: "in_progress" | "completed", stepData?: object, version: number }
 *
 * 返回: 更新后的旅程会话
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { getJourneySession, updateStepStatus, formatSessionResponse } from "@/lib/journey";
import { db } from "@/lib/db";
import type { StepStatus } from "@/generated/prisma/client";

const VALID_STEP_STATUSES: StepStatus[] = ["in_progress", "completed"];

export async function POST(req: NextRequest) {
  // 1. 认证
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  // 2. 解析请求体
  let body: { stepStatus?: string; stepData?: Record<string, unknown>; version?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "INVALID_BODY", message: "请求体格式错误" },
      { status: 400 }
    );
  }

  if (!body.stepStatus || !VALID_STEP_STATUSES.includes(body.stepStatus as StepStatus)) {
    return Response.json(
      { error: "INVALID_STEP_STATUS", message: "stepStatus 必须是 in_progress 或 completed" },
      { status: 400 }
    );
  }

  if (typeof body.version !== "number") {
    return Response.json(
      { error: "INVALID_VERSION", message: "需要 version 参数" },
      { status: 400 }
    );
  }

  // 3. 获取当前会话
  const session = await getJourneySession(user.id);
  if (!session) {
    return Response.json(
      { error: "JOURNEY_NOT_FOUND", message: "旅程不存在" },
      { status: 404 }
    );
  }

  // 4. 验证版本号（乐观锁）
  if (session.version !== body.version) {
    return Response.json(
      { error: "CONFLICT", message: "数据冲突，请刷新后重试" },
      { status: 409 }
    );
  }

  // 5. 验证状态转换
  if (body.stepStatus === "in_progress" && session.stepStatus !== "pending") {
    return Response.json(
      { error: "INVALID_TRANSITION", message: "只有 pending 状态可以开始" },
      { status: 422 }
    );
  }

  if (body.stepStatus === "completed" && session.stepStatus !== "in_progress") {
    return Response.json(
      { error: "INVALID_TRANSITION", message: "只有 in_progress 状态可以完成" },
      { status: 422 }
    );
  }

  // 6. 更新步骤状态（使用乐观锁）
  try {
    const updated = await updateStepStatus(session.id, body.stepStatus as StepStatus, body.stepData);

    // 同时更新版本号
    const final = await db.journeySession.update({
      where: { id: session.id, version: body.version },
      data: { version: { increment: 1 } },
    });

    return Response.json({
      session: formatSessionResponse(final),
    });
  } catch (error: unknown) {
    // Prisma P2025 = Record not found (乐观锁冲突)
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return Response.json(
        { error: "CONFLICT", message: "数据冲突，请刷新后重试" },
        { status: 409 }
      );
    }
    throw error;
  }
}
