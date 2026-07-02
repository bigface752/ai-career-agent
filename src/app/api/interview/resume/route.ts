/**
 * POST /api/interview/resume
 * 恢复暂停的面试会话
 *
 * 对齐 specs/api-endpoints.md POST /api/dialogue/resume
 *
 * Body: { interview_id: string }
 * 返回: { interview_id, status, current_question, conversation_history }
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import type { InterviewMessage, InterviewQuestion } from "@/lib/interview/schema";

// 恢复后过期时间延长天数（与 generate-questions 保持一致）
const RESUME_EXPIRY_DAYS = 5;

export async function POST(req: NextRequest) {
  // 1. 认证
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json(
      { error: "UNAUTHORIZED", message: "请先登录" },
      { status: 401 }
    );
  }

  // 2. 解析请求
  let body: { interview_id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "INVALID_BODY", message: "请求格式错误" },
      { status: 400 }
    );
  }

  if (!body.interview_id) {
    return Response.json(
      { error: "MISSING_INTERVIEW_ID", message: "缺少 interview_id" },
      { status: 400 }
    );
  }

  // 3. 查找 session
  const session = await db.interviewSession.findFirst({
    where: {
      id: body.interview_id,
      userId: user.id,
    },
  });

  if (!session) {
    return Response.json(
      { error: "SESSION_NOT_FOUND", message: "面试会话不存在或无权访问" },
      { status: 404 }
    );
  }

  // 4. 状态校验：paused/in_progress/not_started 都可以恢复（加载数据）
  // completed/expired/abandoned 不可恢复
  const resumableStatuses = ["paused", "in_progress", "not_started"];
  if (!resumableStatuses.includes(session.status)) {
    return Response.json(
      {
        error: "INVALID_STATUS",
        message: session.status === "completed"
          ? "面试已完成，请查看评估报告"
          : "当前状态无法恢复",
      },
      { status: 409 }
    );
  }

  // 5. 检查是否过期
  if (session.expiresAt && session.expiresAt < new Date()) {
    await db.interviewSession.update({
      where: { id: session.id },
      data: { status: "expired" },
    });
    return Response.json(
      { error: "SESSION_EXPIRED", message: "面试会话已过期" },
      { status: 410 }
    );
  }

  // 6. 恢复：更新状态为 in_progress，刷新活动时间
  // 延长过期时间
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + RESUME_EXPIRY_DAYS);

  await db.interviewSession.update({
    where: { id: session.id },
    data: {
      status: "in_progress",
      lastActivityAt: new Date(),
      expiresAt: newExpiresAt,
    },
  });

  // 7. 解析当前题目和对话历史
  let questions: InterviewQuestion[] = [];
  try {
    questions = JSON.parse(session.questions) as InterviewQuestion[];
  } catch {
    // 题目数据损坏
  }

  let conversationHistory: InterviewMessage[] = [];
  try {
    if (session.conversationHistory) {
      conversationHistory = JSON.parse(session.conversationHistory) as InterviewMessage[];
    }
  } catch {
    // 对话历史损坏
  }

  const currentQuestion = questions[session.currentQuestionIndex] || null;

  return Response.json({
    interview_id: session.id,
    status: "in_progress",
    current_question: currentQuestion
      ? {
          id: currentQuestion.id,
          type: currentQuestion.type,
          question: currentQuestion.question,
          focus: currentQuestion.focus,
          difficulty: currentQuestion.difficulty,
        }
      : null,
    questions: questions.map((q) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      focus: q.focus,
      difficulty: q.difficulty,
    })),
    question_index: session.currentQuestionIndex,
    total_questions: questions.length,
    follow_up_count: session.followUpCount,
    conversation_history: conversationHistory,
    message: "面试已恢复，继续回答当前题目",
  });
}
