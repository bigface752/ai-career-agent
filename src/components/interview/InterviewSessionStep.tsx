"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type {
  InterviewQuestion,
  AnswerResponse,
} from "@/lib/interview/schema";

// ============================================================
// Types
// ============================================================

interface ConversationEntry {
  role: "interviewer" | "candidate";
  content: string;
  type?: "question" | "follow_up" | "re_question" | "feedback" | "answer";
  timestamp: number;
}

interface InterviewSessionStepProps {
  interviewId: string;
  questions: InterviewQuestion[];
  onComplete: () => void;
  onExit: () => void;
}

// ============================================================
// 难度样式
// ============================================================

function difficultyStyle(difficulty: string): string {
  switch (difficulty) {
    case "简单":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    case "中等":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "困难":
      return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
    default:
      return "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200";
  }
}

function typeIcon(type: string): string {
  switch (type) {
    case "专业题":
      return "💼";
    case "行为题":
      return "🧠";
    case "非标准题":
      return "💡";
    default:
      return "❓";
  }
}

// ============================================================
// Component
// ============================================================

export function InterviewSessionStep({
  interviewId,
  questions,
  onComplete,
  onExit,
}: InterviewSessionStepProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<"in_progress" | "completed">("in_progress");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRefs = useRef<NodeJS.Timeout[]>([]);

  // 清理定时器，防止组件卸载后执行
  useEffect(() => {
    return () => {
      timerRefs.current.forEach(clearTimeout);
    };
  }, []);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex) / questions.length) * 100;

  // 初始化：添加第一题到对话
  useEffect(() => {
    if (questions.length > 0 && conversation.length === 0) {
      setConversation([
        {
          role: "interviewer",
          content: questions[0].question,
          type: "question",
          timestamp: Date.now(),
        },
      ]);
    }
  }, [questions, conversation.length]);

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // ============================================================
  // 提交回答
  // ============================================================

  const handleSubmit = useCallback(async () => {
    const trimmed = answer.trim();
    if (!trimmed || loading || !currentQuestion) return;

    setLoading(true);
    setError(null);

    // 乐观更新：添加用户回答到对话
    const userEntry: ConversationEntry = {
      role: "candidate",
      content: trimmed,
      type: "answer",
      timestamp: Date.now(),
    };
    setConversation((prev) => [...prev, userEntry]);
    setAnswer("");

    try {
      const res = await fetch("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interview_id: interviewId,
          question_id: currentQuestion.id,
          answer: trimmed,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "提交回答失败");
      }

      const data: AnswerResponse = await res.json();

      // 添加 AI 回复到对话
      const aiEntry: ConversationEntry = {
        role: "interviewer",
        content: data.ai_response.content,
        type:
          data.ai_response.type === "追问"
            ? "follow_up"
            : data.ai_response.type === "重新提问"
              ? "re_question"
              : "feedback",
        timestamp: Date.now(),
      };
      setConversation((prev) => [...prev, aiEntry]);

      // 更新状态
      setFollowUpCount(data.follow_up_count);
      setSessionStatus(data.session_status);

      if (data.ai_response.type === "转下一题") {
        // 移到下一题
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setFollowUpCount(0);

        // 添加下一题到对话
        if (nextIndex < questions.length) {
          const tid = setTimeout(() => {
            setConversation((prev) => [
              ...prev,
              {
                role: "interviewer" as const,
                content: questions[nextIndex].question,
                type: "question" as const,
                timestamp: Date.now(),
              },
            ]);
          }, 500);
          timerRefs.current.push(tid);
        }
      } else if (data.ai_response.type === "追问") {
        // 追问：更新追问计数，AI 回复已是追问内容
        // 不需要额外操作
      } else if (data.ai_response.type === "重新提问") {
        // 重新提问：AI 已给出提示，等待用户重新回答
        // 不需要额外操作
      } else if (data.ai_response.type === "完成") {
        // 面试完成
        const tid = setTimeout(() => onComplete(), 1000);
        timerRefs.current.push(tid);
      }

      // 聚焦输入框
      const focusTid = setTimeout(() => textareaRef.current?.focus(), 100);
      timerRefs.current.push(focusTid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "提交回答失败，请重试";
      setError(msg);
      // 回滚乐观更新
      setConversation((prev) => prev.filter((e) => e !== userEntry));
      setAnswer(trimmed);
    } finally {
      setLoading(false);
    }
  }, [answer, loading, currentQuestion, interviewId, currentIndex, questions, onComplete]);

  // ============================================================
  // 暂停/恢复
  // ============================================================

  const handlePause = useCallback(async () => {
    try {
      const endpoint = paused ? "/api/interview/resume" : "/api/interview/pause";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interview_id: interviewId }),
      });

      if (res.ok) {
        setPaused(!paused);
      } else {
        setError(paused ? "恢复失败，请重试" : "暂停失败，请重试");
      }
    } catch {
      setError("网络错误，请检查连接");
    }
  }, [paused, interviewId]);

  // ============================================================
  // Keyboard shortcut
  // ============================================================

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // ============================================================
  // Render
  // ============================================================

  if (sessionStatus === "completed") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-lg font-medium text-neutral-800 dark:text-neutral-200 mb-2">
              面试已完成！
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              正在生成评估报告...
            </p>
            <div className="inline-block w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col h-[calc(100vh-60px)]">
      {/* 顶部进度区 */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {currentQuestion ? (
                <>
                  {typeIcon(currentQuestion.type)} 第 {currentIndex + 1}/{questions.length} 题
                </>
              ) : (
                "加载中..."
              )}
            </span>
            {currentQuestion && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${difficultyStyle(currentQuestion.difficulty)}`}>
                {currentQuestion.difficulty}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {followUpCount > 0 && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                追问 {followUpCount}/3
              </span>
            )}
            <button
              onClick={handlePause}
              className="px-2 py-1 text-xs rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {paused ? "恢复" : "暂停"}
            </button>
            <button
              onClick={onExit}
              className="px-2 py-1 text-xs rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              退出
            </button>
          </div>
        </div>
        <ProgressBar value={progress} size="sm" />
      </div>

      {/* 题目信息卡片 */}
      {currentQuestion && (
        <div className="flex-shrink-0 mb-3 p-3 rounded-lg bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
              {currentQuestion.type} · 考察重点
            </span>
          </div>
          <p className="text-sm text-primary-800 dark:text-primary-200">
            {currentQuestion.focus}
          </p>
        </div>
      )}

      {/* 对话区 */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0">
        {conversation.map((entry, i) => (
          <div
            key={i}
            className={`flex ${entry.role === "candidate" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                entry.role === "candidate"
                  ? "bg-primary-600 text-white"
                  : entry.type === "follow_up"
                    ? "bg-amber-50 dark:bg-amber-950/30 text-neutral-800 dark:text-neutral-200 border border-amber-200 dark:border-amber-800"
                    : entry.type === "re_question"
                      ? "bg-red-50 dark:bg-red-950/30 text-neutral-800 dark:text-neutral-200 border border-red-200 dark:border-red-800"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
              }`}
            >
              {entry.role === "interviewer" && entry.type !== "question" && (
                <p className="text-xs font-medium mb-1 opacity-70">
                  {entry.type === "follow_up"
                    ? "追问"
                    : entry.type === "re_question"
                      ? "请重新回答"
                      : "反馈"}
                </p>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {entry.content}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex-shrink-0 mb-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* 暂停遮罩 */}
      {paused && (
        <div className="flex-1 flex items-center justify-center bg-white/80 dark:bg-neutral-950/80 rounded-lg mb-4">
          <div className="text-center">
            <p className="text-lg mb-2">⏸️</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
              面试已暂停
            </p>
            <button
              onClick={handlePause}
              className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              继续面试
            </button>
          </div>
        </div>
      )}

      {/* 输入区 */}
      {!paused && (
        <div className="flex-shrink-0">
          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的回答... (Enter 发送，Shift+Enter 换行)"
              rows={3}
              disabled={loading}
              className="flex-1 px-4 py-3 text-sm border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || loading}
              className="self-end px-4 py-3 text-sm font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "发送"
              )}
            </button>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1.5">
            当前题目：{currentQuestion?.type} · {currentQuestion?.difficulty}
            {followUpCount > 0 && ` · 已追问 ${followUpCount}/3 次`}
          </p>
        </div>
      )}
    </div>
  );
}
