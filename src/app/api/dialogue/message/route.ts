/**
 * POST /api/dialogue/message
 * 发送消息并获取 AI 回复（流式）
 *
 * 流程：
 * 1. 保存用户消息
 * 2. 增量提取 Slot 信息（独立 LLM 调用）
 * 3. 流式生成 AI 回复
 * 4. 回复完成后保存消息 + 更新状态
 *
 * Body: { sessionId: string, content: string }
 * 返回: 流式文本响应 + X-Session-State header（更新后的状态 JSON）
 */
import { NextRequest } from "next/server";
import { generateObject, streamText } from "ai";
import { z } from "zod";
import { getAuthUser } from "@/lib/middleware/auth";
import { models } from "@/lib/ai";
import {
  getDialogueSession,
  saveMessage,
  updateSessionState,
} from "@/lib/dialogue/session-manager";
import {
  fillSlots,
  addTurnToWindow,
  buildSlotPrompt,
  buildFindingsPrompt,
  recordQuestion,
  setPhase,
  getNextSlotToAsk,
  shouldShowFindings,
  shouldPromptPortraitUpdate,
  getCompletionRate,
} from "@/lib/dialogue";
import { getSlotsForModule, getRequiredSlotsForModule } from "@/lib/dialogue/slots";
import type { SlotState, DialogueTurn } from "@/lib/dialogue/types";
import { createRouteLogger } from "@/lib/logger";

const log = createRouteLogger("dialogue/message");

// ============================================================
// 增量提取 Schema
// ============================================================

const ExtractionSchema = z.object({
  slots: z
    .record(
      z.string(),
      z.object({
        value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
        confidence: z.enum(["high", "medium", "low"]),
      })
    )
    .describe("从用户消息中提取的 Slot 信息，key 为 slot 名"),
  findings: z
    .array(z.string())
    .optional()
    .describe("从对话中发现的新洞察"),
  answerQuality: z
    .enum(["valid", "vague", "off_topic", "unanswered"])
    .describe("用户回答的质量评估"),
});

// ============================================================
// 系统 Prompt 模板
// ============================================================

function buildSystemPrompt(
  slotState: SlotState,
  recentWindow: DialogueTurn[],
  initialFindings: string[],
  nextSlotName: string | null,
  module: string
): string {
  const slotDefinitions = getSlotsForModule(module);
  const slotPrompt = buildSlotPrompt(slotState, slotDefinitions);
  const findingsPrompt = buildFindingsPrompt(initialFindings);

  const windowContext =
    recentWindow.length > 0
      ? `\n最近对话:\n${recentWindow.map((t) => `${t.role === "user" ? "用户" : "助手"}: ${t.content}`).join("\n")}`
      : "";

  const nextFocus = nextSlotName
    ? `\n下一步：请收集「${nextSlotName}」相关信息`
    : "\n所有必填信息已收集完毕，可以总结或进入下一阶段";

  const rolePrompt = module === "coaching"
    ? `你是一位资深职业导师，正在帮用户梳理当前工作情况。你的目标是快速了解用户在当前岗位的处境，为后续的提升方案做准备。`
    : `你是一个专业的职业认知引导助手。你的任务是通过自然对话收集用户的职业信息。`;

  return `${rolePrompt}

${slotPrompt}

${findingsPrompt ? findingsPrompt + "\n" : ""}
${windowContext}
${nextFocus}

对话原则：
1. 一次只问一个维度，不要连续追问
2. 根据用户回答自然过渡，不要生硬跳转
3. 用户提到敏感信息（薪资、健康等）时保持专业
4. 如果用户改口，不要纠正，记录新信息即可
5. 每 4 轮后可以分享"初步发现"让用户确认
6. 回复简洁，像朋友聊天，不要像面试官`;
}

// ============================================================
// 增量提取 Prompt
// ============================================================

const EXTRACTION_SYSTEM_PROMPT = `你是一个信息提取助手。从用户消息中提取结构化的 Slot 信息。

规则：
1. 只提取用户**明确提到**或**强烈暗示**的信息
2. 不要猜测或推断不确定的信息
3. 置信度：high=用户明确说的，medium=有依据的推断，low=模糊提及
4. 如果用户只是闲聊或没有新信息，返回空 slots
5. findings 是你从对话中发现的洞察（可选）`;

function buildExtractionPrompt(
  userMessage: string,
  currentSlotState: SlotState,
  module: string
): string {
  const slotDefinitions = getSlotsForModule(module);
  const filledSlots = Object.entries(currentSlotState.filled)
    .filter(([, v]) => v.confirmed)
    .map(([k, v]) => `${k}: ${v.value}`)
    .join(", ");

  return `当前已收集的信息：${filledSlots || "暂无"}

可提取的 Slot 列表：
${slotDefinitions.map((s) => `- ${s.name} (${s.label}): ${s.type}`).join("\n")}

用户消息：${userMessage}

请从用户消息中提取信息。`;
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
  let body: { sessionId?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (!body.sessionId || !body.content?.trim()) {
    return Response.json(
      { error: "缺少 sessionId 或 content" },
      { status: 400 }
    );
  }

  const userContent = body.content.trim();
  if (userContent.length > 5000) {
    return Response.json(
      { error: "消息过长，请控制在5000字以内" },
      { status: 400 }
    );
  }

  // 3. 获取并验证会话
  const session = await getDialogueSession(body.sessionId, user.id);
  if (!session) {
    return Response.json({ error: "会话不存在" }, { status: 404 });
  }

  if (session.status !== "active") {
    return Response.json(
      { error: "会话不是 active 状态，请先恢复会话" },
      { status: 409 }
    );
  }
  const newRound = session.roundNumber + 1;
  const module = session.module;

  // 4. 保存用户消息
  await saveMessage(session.id, "user", userContent);

  // 5. 更新滑动窗口
  const userTurn: DialogueTurn = {
    role: "user",
    content: userContent,
    turn: newRound,
  };
  const updatedWindow = addTurnToWindow(session.recentWindow, userTurn);

  // 6. 增量提取 Slot 信息
  let updatedSlotState = session.slotState;
  let updatedFindings = session.initialFindings;

  try {
    const extraction = await generateObject({
      model: models.mimo,
      schema: ExtractionSchema,
      system: EXTRACTION_SYSTEM_PROMPT,
      prompt: buildExtractionPrompt(userContent, session.slotState, module),
      temperature: 0.1,
    });

    const extracted = extraction.object;

    // 更新 Slot 状态
    if (Object.keys(extracted.slots).length > 0) {
      updatedSlotState = fillSlots(
        updatedSlotState,
        extracted.slots,
        newRound,
        false // 提取的信息默认未确认，需要用户明确确认
      );
    }

    // 记录问题（如果有关联的 current_focus）
    if (updatedSlotState.current_focus) {
      updatedSlotState = recordQuestion(
        updatedSlotState,
        updatedSlotState.current_focus,
        userContent,
        newRound,
        extracted.answerQuality
      );
    }

    // 更新初步发现
    if (extracted.findings && extracted.findings.length > 0) {
      updatedFindings = [...updatedFindings, ...extracted.findings];
    }
  } catch (error) {
    // 提取失败不阻塞对话，继续生成回复
    log.warn("Slot 提取失败（非阻塞）", {
      userId: user.id,
      sessionId: session.id,
      err: error as Error,
    });
  }

  // 7. 更新对话阶段
  const slotDefinitions = getSlotsForModule(module);
  const requiredSlots = getRequiredSlotsForModule(module);
  const completionRate = getCompletionRate(updatedSlotState, requiredSlots);

  if (completionRate >= 1) {
    updatedSlotState = setPhase(updatedSlotState, "validation");
  } else if (newRound >= 4) {
    updatedSlotState = setPhase(updatedSlotState, "core");
  }

  // 8. 确定下一个要问的 Slot
  const nextSlot = getNextSlotToAsk(updatedSlotState, slotDefinitions);
  if (nextSlot) {
    updatedSlotState = {
      ...updatedSlotState,
      current_focus: nextSlot.name,
    };
  }

  // 9. 构建系统 Prompt
  const systemPrompt = buildSystemPrompt(
    updatedSlotState,
    updatedWindow,
    updatedFindings,
    nextSlot?.name ?? null,
    module
  );

  // 10. 构建消息历史（用于 AI 调用）
  const recentMessages = updatedWindow.map((t) => ({
    role: t.role as "user" | "assistant",
    content: t.content,
  }));

  // 11. 预保存关键状态（在流式响应返回前）
  // 这样即使 onFinish 失败，关键状态（slotState、roundNumber）也不会丢失
  try {
    await updateSessionState(session.id, {
      slotState: updatedSlotState,
      initialFindings: updatedFindings,
      roundNumber: newRound,
    });
  } catch (error) {
    log.warn("预保存状态失败（非阻塞）", {
      userId: user.id,
      sessionId: session.id,
      err: error as Error,
    });
    // 不阻塞流式响应，继续执行
  }

  // 12. 流式生成 AI 回复
  const result = streamText({
    model: models.mimo,
    system: systemPrompt,
    messages: recentMessages,
    temperature: 0.7,
    onFinish: async ({ text }) => {
      // 流式完成后保存 AI 回复和更新 recentWindow（带重试）
      const MAX_RETRIES = 2;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const assistantTurn: DialogueTurn = {
            role: "assistant",
            content: text,
            turn: newRound,
          };
          const finalWindow = addTurnToWindow(updatedWindow, assistantTurn);

          await saveMessage(session.id, "assistant", text);
          await updateSessionState(session.id, {
            recentWindow: finalWindow,
          });
          return; // 成功，退出
        } catch (error) {
          const isLastAttempt = attempt === MAX_RETRIES;
          if (isLastAttempt) {
            log.error("onFinish 最终保存失败，AI回复可能丢失", {
              userId: user.id,
              sessionId: session.id,
              round: newRound,
              err: error as Error,
            });
          } else {
            log.warn(`onFinish 保存失败，重试中 (${attempt}/${MAX_RETRIES})`, {
              userId: user.id,
              sessionId: session.id,
              round: newRound,
              err: error as Error,
            });
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      }
    },
  });

  // 12. 返回流式响应，在 header 中附带更新后的状态
  const response = result.toTextStreamResponse();

  // 用 header 传递状态更新（客户端可以在流结束后读取）
  const stateUpdate = {
    roundNumber: newRound,
    slotState: updatedSlotState,
    initialFindings: updatedFindings,
    progress: completionRate,
    nextSlot: nextSlot?.name ?? null,
    showFindings: shouldShowFindings(newRound),
    shouldExtract: shouldPromptPortraitUpdate(newRound),
  };
  response.headers.set("X-Dialogue-State", JSON.stringify(stateUpdate));

  return response;
}
