/**
 * POST /api/interview/answer
 * 用户提交面试回答 → AI 追问/转下一题
 *
 * 对齐 specs/api-endpoints.md
 * 对齐 SPEC.md §3.15
 *
 * 输入：interview_id + question_id + answer
 * 输出：question_id + ai_response + follow_up_count + session_status
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { AnswerInputSchema } from "@/lib/interview/schema";
import { processAnswer } from "@/lib/interview/answer";
import { createRouteLogger } from "@/lib/logger";

const log = createRouteLogger("interview/answer");

export async function POST(req: NextRequest) {
  // 1. Auth
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "请先登录" },
      { status: 401 }
    );
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "INVALID_BODY", message: "请求格式错误" },
      { status: 400 }
    );
  }

  // 3. Zod 校验
  const parseResult = AnswerInputSchema.safeParse(body);
  if (!parseResult.success) {
    const firstError = parseResult.error.issues[0];
    return Response.json(
      {
        error: "VALIDATION_ERROR",
        message: firstError?.message || "参数校验失败",
      },
      { status: 400 }
    );
  }

  const input = parseResult.data;

  // 4. 处理回答
  try {
    const result = await processAnswer(input, user.id);
    return Response.json(result.response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // 业务错误映射
    const errorMap: Record<string, { status: number; error: string; message: string }> = {
      SESSION_NOT_FOUND: {
        status: 404,
        error: "SESSION_NOT_FOUND",
        message: "面试会话不存在或无权访问",
      },
      SESSION_NOT_STARTED: {
        status: 409,
        error: "SESSION_NOT_STARTED",
        message: "面试尚未开始",
      },
      SESSION_PAUSED: {
        status: 409,
        error: "SESSION_PAUSED",
        message: "面试已暂停，请先恢复",
      },
      SESSION_COMPLETED: {
        status: 409,
        error: "SESSION_COMPLETED",
        message: "面试已结束，无法继续回答",
      },
      SESSION_EXPIRED: {
        status: 410,
        error: "SESSION_EXPIRED",
        message: "面试会话已过期",
      },
      SESSION_ABANDONED: {
        status: 410,
        error: "SESSION_ABANDONED",
        message: "面试会话已放弃",
      },
      INVALID_QUESTIONS_DATA: {
        status: 500,
        error: "INVALID_DATA",
        message: "题目数据格式错误",
      },
      QUESTION_NOT_FOUND: {
        status: 404,
        error: "QUESTION_NOT_FOUND",
        message: "题目不存在",
      },
    };

    const mapped = errorMap[msg];
    if (mapped) {
      return Response.json(
        { error: mapped.error, message: mapped.message },
        { status: mapped.status }
      );
    }

    // 未知错误
    log.error("Process answer failed", { userId: user.id, err: err as Error });
    return Response.json(
      { error: "INTERNAL_ERROR", message: "处理回答失败，请重试" },
      { status: 500 }
    );
  }
}
