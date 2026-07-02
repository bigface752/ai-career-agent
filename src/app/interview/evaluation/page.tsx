"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { InterviewReportStep } from "@/components/interview/InterviewReportStep";
import type { EvaluateOutput, InterviewQuestion } from "@/lib/interview/schema";

function InterviewEvaluationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const interviewId = searchParams.get("interview_id");

  const [evaluation, setEvaluation] = useState<EvaluateOutput | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // 触发评估
  // ============================================================

  useEffect(() => {
    if (!interviewId) {
      setError("缺少 interview_id 参数");
      setLoading(false);
      return;
    }

    async function loadEvaluation() {
      try {
        const res = await fetch("/api/interview/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interview_id: interviewId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "评估失败");
        }

        const data = await res.json();
        setEvaluation(data.evaluation);
        setQuestions(data.questions || []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "评估失败，请重试";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }

    loadEvaluation();
  }, [interviewId]);

  // ============================================================
  // 操作
  // ============================================================

  const handleRestart = useCallback(() => {
    router.push("/interview");
  }, [router]);

  const handleMatchOther = useCallback(() => {
    router.push("/match");
  }, [router]);

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950">
        <Navbar badge="模块三 · 面试评估" backHref="/interview" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              AI 正在评估你的面试表现...
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              这可能需要 30-60 秒
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="min-h-screen bg-white dark:bg-neutral-950">
        <Navbar badge="模块三 · 面试评估" backHref="/interview" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md px-4">
            <p className="text-red-600 dark:text-red-400 mb-4">
              {error || "评估数据加载失败"}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                重试
              </button>
              <button
                onClick={() => router.push("/interview")}
                className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                返回面试入口
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <Navbar badge="模块三 · 面试评估" backHref="/interview" backText="面试入口" />
      <InterviewReportStep
        evaluation={evaluation}
        questions={questions}
        onRestart={handleRestart}
        onMatchOther={handleMatchOther}
      />
    </div>
  );
}

export default function InterviewEvaluationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-neutral-950">
          <Navbar badge="模块三 · 面试评估" backHref="/interview" />
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="inline-block w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      }
    >
      <InterviewEvaluationContent />
    </Suspense>
  );
}
