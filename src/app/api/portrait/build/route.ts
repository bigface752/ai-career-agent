/**
 * POST /api/portrait/build
 * 触发画像构建（通用模板 + 定制化维度 → 最终模板）
 *
 * 流程：
 * 1. 获取对话会话数据
 * 2. 生成通用基础画像（职业导师 Agent）
 * 3. 并发生成定制化维度（4 Agent 圆桌讨论）
 * 4. 合并为最终模板
 * 5. 持久化到 Portrait 表
 *
 * Body: { sessionId: string }
 * 返回: PortraitTemplate
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import {
  getDialogueSession,
  getMessages,
} from "@/lib/dialogue/session-manager";
import { generateBasePortrait } from "@/lib/portrait/generator";
import { mergePortrait, savePortrait } from "@/lib/portrait/merger";
import { generateRoundtable } from "@/lib/roundtable/generator";
import { db } from "@/lib/db";
import type { BasicInfo, CareerSegment } from "@/lib/portrait/schema";
import type { RoundtableInput } from "@/lib/roundtable/schema";
import type { SlotState } from "@/lib/dialogue/types";

// ============================================================
// 从 SlotState 提取基础信息
// ============================================================

function extractBasicInfo(slotState: SlotState): BasicInfo {
  const filled = slotState.filled;

  return {
    current_role: (filled.current_role?.value as string) || "未知",
    industry: (filled.industry?.value as string) || "未知",
    years_of_experience:
      typeof filled.years_of_experience?.value === "number"
        ? filled.years_of_experience.value
        : 0,
    city: (filled.city?.value as string) || "未知",
  };
}

// ============================================================
// 从 SlotState 提取职业经历
// ============================================================

function extractCareerSegments(slotState: SlotState): CareerSegment[] {
  // V1: 从 key_achievement 和对话中提取简化版经历
  // 后续可通过 neat-freak 或专门的简历解析增强
  const filled = slotState.filled;

  if (filled.current_role?.value) {
    return [
      {
        position_id: String(filled.current_role.value),
        industry: String(filled.industry?.value || "未知"),
        company: "当前公司",
        duration_years:
          typeof filled.years_of_experience?.value === "number"
            ? filled.years_of_experience.value
            : 0,
        key_skills: [],
        key_achievements: filled.key_achievement?.value
          ? [String(filled.key_achievement.value)]
          : [],
      },
    ];
  }

  return [];
}

// ============================================================
// 从 SlotState 和消息构建对话摘要
// ============================================================

function buildDialogueSummary(
  messages: Array<{ role: string; content: string; createdAt: Date }>,
  slotState: SlotState
): string {
  const lines: string[] = [];

  // 已收集的 Slot 信息
  const slotEntries = Object.entries(slotState.filled)
    .filter(([, entry]) => entry.confirmed)
    .map(([key, entry]) => `- ${key}: ${entry.value}`)
    .join("\n");

  if (slotEntries) {
    lines.push("### 已确认信息");
    lines.push(slotEntries);
  }

  // 最近 5 轮对话摘要
  const recentMessages = messages.slice(-10); // 最近 10 条消息（约 5 轮）
  if (recentMessages.length > 0) {
    lines.push("\n### 最近对话");
    recentMessages.forEach((msg) => {
      const role = msg.role === "user" ? "用户" : "AI";
      const content =
        msg.content.length > 200
          ? msg.content.slice(0, 200) + "..."
          : msg.content;
      lines.push(`${role}: ${content}`);
    });
  }

  return lines.join("\n");
}

// ============================================================
// POST Handler
// ============================================================

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

  // 3. 获取对话会话
  const session = await getDialogueSession(body.sessionId, user.id);
  if (!session) {
    return Response.json({ error: "会话不存在" }, { status: 404 });
  }

  if (session.status !== "active" && session.status !== "paused") {
    return Response.json(
      { error: "会话状态不可构建画像（需要 active 或 paused）" },
      { status: 409 }
    );
  }

  // 3.5 并发控制：原子更新状态为 building，防止重复构建
  const lockResult = await db.dialogueSession.updateMany({
    where: {
      id: session.id,
      status: { in: ["active", "paused"] },
    },
    data: { status: "building" },
  });

  if (lockResult.count === 0) {
    return Response.json(
      { error: "画像正在构建中或会话状态已变更" },
      { status: 409 }
    );
  }

  // 记录原始状态，失败时恢复
  const originalStatus = session.status;

  try {
    // 4. 获取消息历史
    const messages = await getMessages(session.id);

    // 5. 提取基础信息和经历
    const basicInfo = extractBasicInfo(session.slotState);
    const careerSegments = extractCareerSegments(session.slotState);

    // 6. 生成通用基础画像（职业导师 Agent）
    const basePortraitResult = await generateBasePortrait({
      basicInfo,
      slotState: session.slotState,
      recentWindow: session.recentWindow,
    });

    // 7. 准备圆桌讨论输入
    const dialogueSummary = buildDialogueSummary(messages, session.slotState);
    const roundtableInput: RoundtableInput = {
      basicInfo: {
        current_role: basicInfo.current_role,
        industry: basicInfo.industry,
        years_of_experience: basicInfo.years_of_experience,
        city: basicInfo.city,
      },
      careerSummary: basePortraitResult.portrait.career_summary,
      strengths: basePortraitResult.portrait.strengths,
      gaps: basePortraitResult.portrait.gaps,
      careerSegments: careerSegments.map((seg) => ({
        position_id: seg.position_id,
        industry: seg.industry,
        company: seg.company,
        duration_years: seg.duration_years,
        key_skills: seg.key_skills,
      })),
      dialogueSummary,
    };

    // 8. 并发生成定制化维度（4 Agent 圆桌讨论）
    const roundtableResult = await generateRoundtable(roundtableInput);

    // 9. 合并为最终模板
    const mergeResult = await mergePortrait({
      basicInfo,
      careerSegments,
      basePortrait: basePortraitResult.portrait,
      roundtableResult,
    });

    // 10. 持久化到数据库
    await savePortrait(user.id, mergeResult.portrait, db);

    // 11. 构建成功，恢复会话状态
    await db.dialogueSession.update({
      where: { id: session.id },
      data: { status: "active" },
    });

    // 12. 返回结果
    return Response.json({
      portrait: mergeResult.portrait,
      usage: {
        basePortrait: basePortraitResult.usage,
        roundtable: roundtableResult.total_usage,
        composite: mergeResult.usage,
      },
      timing: {
        roundtable_duration_ms: roundtableResult.total_duration_ms,
      },
    });
  } catch (error) {
    // 任何步骤失败，恢复会话状态
    console.error("画像构建失败:", error);
    await db.dialogueSession.update({
      where: { id: session.id },
      data: { status: originalStatus },
    });
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "画像构建失败，请稍后重试",
      },
      { status: 500 }
    );
  }
}
