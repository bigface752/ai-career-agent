/**
 * POST /api/interview/evaluate
 * 面试评估 + 答案优化
 *
 * 对齐 specs/api-endpoints.md POST /api/interview/evaluate
 * 对齐 specs/report-templates.md 模块三：面试报告
 *
 * 输入：interview_id
 * 输出：evaluation（整体评级 + 4维度 + 逐题评估 + Top 3 改进建议）
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { EvaluateInputSchema } from "@/lib/interview/schema";
import { evaluateInterview, buildEvaluationInput } from "@/lib/interview/evaluator";

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
  const parseResult = EvaluateInputSchema.safeParse(body);
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

  const { interview_id } = parseResult.data;

  // 4. 处理评估
  try {
    // 4a. 构建评估输入（含权限校验 + 状态校验）
    const { input, session } = await buildEvaluationInput(
      interview_id,
      user.id
    );

    // 4b. 幂等检查：已有 evaluation 直接返回（不重复消耗 token）
    if (session.evaluation) {
      try {
        const existing = JSON.parse(session.evaluation);
        return Response.json({ evaluation: existing });
      } catch {
        // evaluation 字段损坏，重新评估
      }
    }

    // 4c. 调用 AI 评估
    const result = await evaluateInterview(input);

    // 4d. 持久化评估结果（带 userId 条件防越权）
    await db.interviewSession.update({
      where: { id: session.id, userId: user.id },
      data: {
        evaluation: JSON.stringify(result.output),
      },
    });

    // 4e. 返回响应（含题目列表，供前端逐题评估展示）
    return Response.json({
      evaluation: result.output,
      questions: input.questions.map((q) => ({
        id: q.id,
        type: q.type,
        question: q.question,
        focus: q.focus,
        difficulty: q.difficulty,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // 业务错误映射
    const errorMap: Record<
      string,
      { status: number; error: string; message: string }
    > = {
      SESSION_NOT_FOUND: {
        status: 404,
        error: "SESSION_NOT_FOUND",
        message: "面试会话不存在或无权访问",
      },
      SESSION_NOT_COMPLETED: {
        status: 409,
        error: "SESSION_NOT_COMPLETED",
        message: "面试尚未完成，无法评估",
      },
      INVALID_QUESTIONS_DATA: {
        status: 500,
        error: "INVALID_DATA",
        message: "题目数据格式错误",
      },
      INVALID_CONVERSATION_DATA: {
        status: 500,
        error: "INVALID_DATA",
        message: "对话历史数据格式错误",
      },
      NO_ANSWERS: {
        status: 400,
        error: "NO_ANSWERS",
        message: "没有回答记录，无法评估",
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
    console.error("[interview/evaluate] Evaluation failed:", msg);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "评估失败，请重试" },
      { status: 500 }
    );
  }
}
