/**
 * POST /api/coaching/roundtable
 * 模块零圆桌讨论
 *
 * 输入：sessionId（coaching 会话 ID）
 * 输出：4 角色讨论 + 主持综合 + 提升方案
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { getDialogueSession, getMessages } from "@/lib/dialogue/session-manager";
import { getSlotValue } from "@/lib/dialogue/slot-state";
import { MODULE_ZERO_SLOTS } from "@/lib/dialogue/slots/module-zero";
import { generateCoachingRoundtable } from "@/lib/coaching-roundtable";
import type { CoachingRoundtableInput } from "@/lib/coaching-roundtable";

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
      return Response.json({ error: "此接口仅适用于模块零会话" }, { status: 400 });
    }

    // 4. 幂等检查：已有圆桌结果直接返回
    const existing = await db.roundtableDiscussion.findFirst({
      where: { sessionId: session.id, module: "coaching" },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      try {
        return Response.json({
          roundtableId: existing.id,
          result: {
            participants: JSON.parse(existing.participants),
            rounds: JSON.parse(existing.rounds),
            consensus: existing.consensus ? JSON.parse(existing.consensus) : [],
            disagreements: existing.disagreements ? JSON.parse(existing.disagreements) : [],
            recommendation: existing.recommendation,
          },
        });
      } catch {
        console.error("圆桌讨论数据损坏:", existing.id);
        return Response.json(
          { error: "讨论数据异常，请重新开始" },
          { status: 500 }
        );
      }
    }

    // 5. 读取画像
    const portrait = await db.portrait.findUnique({
      where: { userId: user.id },
      select: { portraitJson: true },
    });

    if (!portrait?.portraitJson) {
      return Response.json({ error: "画像不存在" }, { status: 409 });
    }

    const portraitData = JSON.parse(portrait.portraitJson);

    // 6. 校验 slot 完整性
    const requiredSlotNames = MODULE_ZERO_SLOTS.filter((s) => s.required).map((s) => s.name);
    const missingSlots = requiredSlotNames.filter(
      (slot) => !getSlotValue(session.slotState, slot)
    );
    if (missingSlots.length > 0) {
      return Response.json(
        { error: "画像信息不完整，请先完成对话", missingSlots },
        { status: 409 }
      );
    }

    // 7. 从 slotState 提取 currentWork
    const currentWork: CoachingRoundtableInput["currentWork"] = {
      leader_style: getSlotValue(session.slotState, "leader_style") as string,
      team_size: getSlotValue(session.slotState, "team_size") as string,
      biggest_bottleneck: getSlotValue(session.slotState, "biggest_bottleneck") as string,
      pain_point: getSlotValue(session.slotState, "pain_point") as string,
      unrealized_goal: getSlotValue(session.slotState, "unrealized_goal") as string,
    };

    // 7. 构建输入
    const input: CoachingRoundtableInput = {
      basicInfo: portraitData.basic_info || {},
      careerSummary: {
        motivation: portraitData.career_summary?.motivation || "",
        value_ranking: portraitData.career_summary?.value_ranking || [],
        risk_tolerance: portraitData.career_summary?.risk_tolerance || "中",
        development_goal: portraitData.career_summary?.development_goal || "",
      },
      currentWork,
      strengths: portraitData.strengths || [],
      gaps: portraitData.gaps || [],
    };

    // 8. 生成圆桌讨论
    const result = await generateCoachingRoundtable(input);

    // 9. 校验 host 综合结果
    if (!result.host_synthesis.success) {
      return Response.json(
        { error: "综合分析失败，请稍后重试" },
        { status: 502 }
      );
    }

    const hostOutput = result.host_synthesis.output;
    if (!hostOutput.consensus || !hostOutput.top_3_directions || !hostOutput.action_plan) {
      return Response.json(
        { error: "综合分析结果不完整，请稍后重试" },
        { status: 502 }
      );
    }

    // 10. 持久化结果
    const participants = [
      { role: "职业导师", ...result.career_mentor.output },
      { role: "猎头", ...result.headhunter.output },
      { role: "头部企业专家", ...result.bigtech_expert.output },
      { role: "AI效能专家", ...result.ai_expert.output },
    ];

    const roundtable = await db.roundtableDiscussion.create({
      data: {
        sessionId: session.id,
        module: "coaching",
        participants: JSON.stringify(participants),
        rounds: JSON.stringify([participants]),
        consensus: JSON.stringify(hostOutput.consensus),
        disagreements: JSON.stringify(hostOutput.disagreements),
        recommendation: JSON.stringify({
          top_3_directions: hostOutput.top_3_directions,
          action_plan: hostOutput.action_plan,
        }),
      },
    });

    return Response.json({
      roundtableId: roundtable.id,
      result: {
        participants,
        rounds: [participants],
        consensus: hostOutput.consensus,
        disagreements: hostOutput.disagreements,
        recommendation: {
          top_3_directions: hostOutput.top_3_directions,
          action_plan: hostOutput.action_plan,
        },
      },
    });
  } catch (error) {
    console.error("模块零圆桌讨论失败:", error);
    return Response.json(
      { error: "操作失败，请稍后重试" },
      { status: 500 }
    );
  }
}
