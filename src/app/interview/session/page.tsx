"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { InterviewSessionStep } from "@/components/interview/InterviewSessionStep";
import type { InterviewQuestion, GenerateQuestionsResponse } from "@/lib/interview/schema";

function InterviewSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const interviewId = searchParams.get("interview_id");

  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // 加载面试数据
  // ============================================================

  useEffect(() => {
    if (!interviewId) {
      setError("缺少 interview_id 参数");
      setLoading(false);
      return;
    }

    // 优先从 sessionStorage 获取（从 setup 页面跳转过来）
    const cached = sessionStorage.getItem(`interview_${interviewId}`);
    if (cached) {
      try {
        const data = JSON.parse(cached) as GenerateQuestionsResponse;
        setQuestions(data.questions);
        setLoading(false);
        // 不清理缓存，评估页面可能还需要
        return;
      } catch {
        // 缓存损坏，继续从 API 加载
      }
    }

    // 从 API 恢复（刷新页面或直接访问 URL）
    async function loadSession() {
      try {
        const res = await fetch("/api/interview/resume", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interview_id: interviewId }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.questions && data.questions.length > 0) {
            setQuestions(data.questions);
          } else {
            setError("面试会话数据不完整，请重新开始");
          }
        } else if (res.status === 404) {
          setError("面试会话不存在或已过期");
        } else if (res.status === 409) {
          const data = await res.json().catch(() => ({}));
          if (data.message?.includes("已完成")) {
            // 面试已完成，跳转到评估页面
            router.push(`/interview/evaluation?interview_id=${interviewId}`);
            return;
          }
          setError(data.message || "面试会话状态异常");
        } else {
          setError("加载面试会话失败");
        }
      } catch {
        setError("网络错误，请检查连接");
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [interviewId]);

  // ============================================================
  // 完成面试 → 跳转评估
  // ============================================================

  const handleComplete = useCallback(() => {
    if (interviewId) {
      router.push(`/interview/evaluation?interview_id=${interviewId}`);
    }
  }, [interviewId, router]);

  // ============================================================
  // 退出面试
  // ============================================================

  const handleExit = useCallback(() => {
    router.push("/interview");
  }, [router]);

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950">
        <Navbar badge="模块三 · 模拟面试" backHref="/interview" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              加载面试会话...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950">
        <Navbar badge="模块三 · 模拟面试" backHref="/interview" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md px-4">
            <p className="text-red-600 dark:text-red-400 mb-4">
              {error || "面试数据加载失败"}
            </p>
            <button
              onClick={() => router.push("/interview")}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              返回面试入口
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <Navbar
        badge="模块三 · 模拟面试"
        backHref="/interview"
        backText="退出面试"
      />
      <InterviewSessionStep
        interviewId={interviewId!}
        questions={questions}
        onComplete={handleComplete}
        onExit={handleExit}
      />
    </div>
  );
}

export default function InterviewSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-neutral-950">
          <Navbar badge="模块三 · 模拟面试" backHref="/interview" />
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="inline-block w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      }
    >
      <InterviewSessionContent />
    </Suspense>
  );
}
