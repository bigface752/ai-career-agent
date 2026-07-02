/**
 * POST /api/coaching/start
 * 启动模块零（当前工作辅导）对话
 *
 * 流程：
 * 1. 认证
 * 2. 读取用户画像（模块一生成）
 * 3. 创建新的对话会话（module="coaching"）
 * 4. 预填已有信息到 slotState
 * 5. 返回 sessionId
 *
 * Body: { moduleOneSessionId?: string }
 * 返回: { sessionId: string }
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { createDialogueSession, getActiveSession } from "@/lib/dialogue/session-manager";
import { fillSlots } from "@/lib/dialogue/slot-state";
import { MODULE_ZERO_SLOTS } from "@/lib/dialogue/slots/module-zero";
import type { SlotState } from "@/lib/dialogue/types";

export async function POST(req: NextRequest) {
  // 1. 认证
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  // 2. 解析请求（moduleOneSessionId 可选，用于关联）
  let body: { moduleOneSessionId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // 无 body 也可以
  }

  try {
    // 3. 读取用户画像
    const portrait = await db.portrait.findUnique({
      where: { userId: user.id },
      select: { portraitJson: true },
    });

    if (!portrait?.portraitJson) {
      return Response.json(
        { error: "请先完成职业认知对话（模块一）" },
        { status: 409 }
      );
    }

    let portraitData: Record<string, unknown>;
    try {
      portraitData = JSON.parse(portrait.portraitJson);
    } catch {
      return Response.json(
        { error: "画像数据异常，请重新进入职业认知" },
        { status: 500 }
      );
    }

    // 4. 检查是否已有 active coaching 会话（防重复创建）
    const existingSession = await getActiveSession(user.id, "coaching");
    if (existingSession) {
      return Response.json({ sessionId: existingSession.id });
    }

    // 5. 创建 coaching 会话
    const session = await createDialogueSession(user.id, "coaching");

    // 5. 从画像预填已有信息（如果有的话）
    const currentWork = portraitData.current_work as Record<string, string> | undefined;
    if (currentWork && typeof currentWork === "object") {
      const slotsToFill: Record<string, { value: string; confidence: "high" | "medium" | "low" }> = {};

      for (const slotDef of MODULE_ZERO_SLOTS) {
        const value = currentWork[slotDef.name];
        if (value && typeof value === "string" && value.trim()) {
          slotsToFill[slotDef.name] = { value, confidence: "high" };
        }
      }

      if (Object.keys(slotsToFill).length > 0) {
        const filledState = fillSlots(session.slotState, slotsToFill, 0, true);
        // 更新会话的 slotState
        await db.dialogueSession.update({
          where: { id: session.id },
          data: { slotState: JSON.stringify(filledState) },
        });
      }
    }

    return Response.json({ sessionId: session.id });
  } catch (error) {
    console.error("启动模块零对话失败:", error);
    return Response.json(
      { error: "操作失败，请稍后重试" },
      { status: 500 }
    );
  }
}
