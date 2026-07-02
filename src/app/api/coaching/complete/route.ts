/**
 * POST /api/coaching/complete
 * 完成模块零对话，将 current_work 写入画像
 *
 * 使用确定性映射（非 AI 提取），因为 slot 值是用户明确说的
 *
 * Body: { sessionId: string }
 * 返回: { ok: true, currentWork: CurrentWork }
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { getDialogueSession } from "@/lib/dialogue/session-manager";
import { getSlotValue } from "@/lib/dialogue/slot-state";
import { MODULE_ZERO_SLOTS } from "@/lib/dialogue/slots/module-zero";
import type { CurrentWork } from "@/lib/portrait/schema";

export async function POST(req: NextRequest) {
  // 1. 认证
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  // 2. 解析请求
  let body: { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (!body.sessionId) {
    return Response.json({ error: "缺少 sessionId" }, { status: 400 });
  }

  try {
    // 3. 获取会话并校验
    const session = await getDialogueSession(body.sessionId, user.id);
    if (!session) {
      return Response.json({ error: "会话不存在" }, { status: 404 });
    }

    if (session.module !== "coaching") {
      return Response.json(
        { error: "此接口仅适用于模块零会话" },
        { status: 400 }
      );
    }

    if (session.status !== "active") {
      return Response.json(
        { error: "会话不是 active 状态，无法完成" },
        { status: 409 }
      );
    }

    // 4. 从 slotState 提取 current_work 数据
    const currentWork: CurrentWork = {
      leader_style: "",
      team_size: "",
      biggest_bottleneck: "",
      pain_point: "",
      unrealized_goal: "",
    };

    let allFilled = true;
    for (const slotDef of MODULE_ZERO_SLOTS) {
      const value = getSlotValue(session.slotState, slotDef.name);
      if (value && typeof value === "string") {
        currentWork[slotDef.name as keyof CurrentWork] = value;
      } else if (slotDef.required) {
        allFilled = false;
      }
    }

    if (!allFilled) {
      return Response.json(
        { error: "还有必填信息未收集完毕，请继续对话" },
        { status: 409 }
      );
    }

    // 5. 更新画像：将 current_work 写入 portrait_json
    const portrait = await db.portrait.findUnique({
      where: { userId: user.id },
      select: { portraitJson: true },
    });

    if (!portrait?.portraitJson) {
      return Response.json(
        { error: "画像不存在，请先完成职业认知" },
        { status: 409 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let portraitData: Record<string, any>;
    try {
      portraitData = JSON.parse(portrait.portraitJson);
    } catch {
      console.error("画像数据JSON解析失败:", user.id);
      return Response.json(
        { error: "画像数据异常，请重新进入职业认知" },
        { status: 500 }
      );
    }

    // 合并 current_work 到画像
    portraitData.current_work = currentWork;

    // 更新 meta（防御性检查：sources 可能被损坏为非数组）
    if (portraitData.meta && typeof portraitData.meta === "object") {
      portraitData.meta.updated_at = new Date().toISOString();
      if (!Array.isArray(portraitData.meta.sources)) {
        portraitData.meta.sources = [];
      }
      if (!portraitData.meta.sources.includes("coaching")) {
        portraitData.meta.sources.push("coaching");
      }
    }

    await db.portrait.update({
      where: { userId: user.id },
      data: {
        portraitJson: JSON.stringify(portraitData),
        updatedAt: new Date(),
      },
    });

    // 6. 将会话标记为已完成
    await db.dialogueSession.update({
      where: { id: session.id },
      data: { status: "archived" },
    });

    return Response.json({ ok: true, currentWork });
  } catch (error) {
    console.error("完成模块零对话失败:", error);
    return Response.json(
      { error: "操作失败，请稍后重试" },
      { status: 500 }
    );
  }
}
