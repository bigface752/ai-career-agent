/**
 * POST /api/interview/generate-questions
 * 生成面试题
 *
 * 对齐 specs/api-endpoints.md
 * 对齐 SPEC.md §3.14
 *
 * 输入：jd_id + round（面试轮次）+ 用户身份（JWT）
 * 输出：interview_id + questions[] + total_questions + estimated_time
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { buildInterviewInput, generateQuestions } from "@/lib/interview";
import { InterviewRound } from "@/lib/interview/schema";
import type { GenerateQuestionsResponse } from "@/lib/interview/schema";

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
  let body: { jd_id?: string; round?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "INVALID_BODY", message: "请求格式错误" },
      { status: 400 }
    );
  }

  const { jd_id, round } = body;

  if (!jd_id || typeof jd_id !== "string") {
    return Response.json(
      { error: "MISSING_JD_ID", message: "缺少 jd_id 参数" },
      { status: 400 }
    );
  }

  if (!round) {
    return Response.json(
      { error: "MISSING_ROUND", message: "缺少 round 参数" },
      { status: 400 }
    );
  }

  // 校验轮次
  const roundResult = InterviewRound.safeParse(round);
  if (!roundResult.success) {
    return Response.json(
      {
        error: "INVALID_ROUND",
        message: "无效的面试轮次，可选值：一面/二面/终面/HR面",
      },
      { status: 400 }
    );
  }

  const validRound = roundResult.data;

  // 3. 幂等检查：同一 jd_id + round 已有未过期的未完成 session → 返回已有题目
  const existingSession = await db.interviewSession.findFirst({
    where: {
      userId: user.id,
      jdId: jd_id,
      round: validRound,
      status: { in: ["not_started", "in_progress"] },
      expiresAt: { gt: new Date() },
    },
  });

  if (existingSession) {
    try {
      const questions = JSON.parse(existingSession.questions) as GenerateQuestionsResponse["questions"];
      const response: GenerateQuestionsResponse = {
        interview_id: existingSession.id,
        questions,
        total_questions: questions.length,
        estimated_time: estimateTime(questions.length),
      };
      return Response.json(response);
    } catch {
      // questions JSON 损坏，跳过旧 session 重新生成
      console.warn("[interview] Corrupted questions in session:", existingSession.id);
    }
  }

  // 4. 构建输入
  let input;
  try {
    input = await buildInterviewInput(jd_id, user.id, validRound);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "JD_NOT_FOUND") {
      return Response.json(
        { error: "JD_NOT_FOUND", message: "JD 不存在或无权访问" },
        { status: 404 }
      );
    }
    if (msg === "PORTRAIT_NOT_FOUND") {
      return Response.json(
        { error: "PORTRAIT_NOT_FOUND", message: "请先完成职业画像" },
        { status: 400 }
      );
    }
    if (msg === "INVALID_JD_DATA" || msg === "INVALID_PORTRAIT_DATA") {
      return Response.json(
        { error: "INVALID_DATA", message: "数据格式错误，请重试" },
        { status: 500 }
      );
    }
    console.error("[interview] Build input failed:", msg);
    return Response.json(
      { error: "INTERNAL_ERROR", message: "构建输入失败" },
      { status: 500 }
    );
  }

  // 5. AI 生成面试题
  let result;
  try {
    result = await generateQuestions(input);
  } catch (err) {
    console.error("[interview] Generate questions failed:", err);
    return Response.json(
      { error: "GENERATION_FAILED", message: "生成面试题失败，请重试" },
      { status: 500 }
    );
  }

  // 6. 持久化 InterviewSession（乐观检查：并发请求可能已创建）
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 5);

  let session;
  try {
    // 二次检查：防并发竞态（findFirst + create 非原子）
    const concurrent = await db.interviewSession.findFirst({
      where: {
        userId: user.id,
        jdId: jd_id,
        round: validRound,
        status: { in: ["not_started", "in_progress"] },
        expiresAt: { gt: new Date() },
      },
    });

    if (concurrent) {
      try {
        const questions = JSON.parse(concurrent.questions) as GenerateQuestionsResponse["questions"];
        return Response.json({
          interview_id: concurrent.id,
          questions,
          total_questions: questions.length,
          estimated_time: estimateTime(questions.length),
        });
      } catch {
        // 并发 session 的 questions 也损坏，继续创建新的
      }
    }

    session = await db.interviewSession.create({
      data: {
        userId: user.id,
        jdId: jd_id,
        round: validRound,
        status: "not_started",
        questions: JSON.stringify(result.output.questions),
        currentQuestionIndex: 0,
        expiresAt,
      },
    });
  } catch (dbErr) {
    console.error("[interview] DB write failed:", dbErr);
    return Response.json(
      { error: "DB_ERROR", message: "保存面试会话失败，请重试" },
      { status: 500 }
    );
  }

  // 7. 返回
  const response: GenerateQuestionsResponse = {
    interview_id: session.id,
    questions: result.output.questions,
    total_questions: result.output.questions.length,
    estimated_time: estimateTime(result.output.questions.length),
  };

  return Response.json(response);
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 根据题目数量估算面试时长
 * 每题约 2-3 分钟（含追问）
 */
function estimateTime(questionCount: number): string {
  const minMinutes = questionCount * 2;
  const maxMinutes = questionCount * 3;
  return `${minMinutes}-${maxMinutes}分钟`;
}
