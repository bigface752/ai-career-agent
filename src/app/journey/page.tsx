"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { JourneyProgress } from "@/components/journey/JourneyProgress";
import { JourneyStep } from "@/components/journey/JourneyStep";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import type { JourneyStepName } from "@/lib/journey-steps";

interface JourneySession {
  id: string;
  currentStep: JourneyStepName;
  stepStatus: "pending" | "in_progress" | "completed";
  completedSteps: JourneyStepName[];
  version: number;
}

interface StepProgress {
  allowed: boolean;
  missing: string[];
  progress: number;
}

export default function JourneyPage() {
  const router = useRouter();
  const [session, setSession] = useState<JourneySession | null>(null);
  const [stepProgress, setStepProgress] = useState<StepProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorTimerRef = useRef<NodeJS.Timeout | null>(null);

  /** 统一错误处理 */
  const handleError = useCallback((error: string) => {
    // 清除之前的定时器
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }
    setError(error);
    errorTimerRef.current = setTimeout(() => setError(null), 3000);
  }, []);

  /** 统一 401 处理 */
  const handleAuthError = useCallback((status: number) => {
    if (status === 401) {
      router.push("/login");
      return true;
    }
    return false;
  }, [router]);

  /** 加载旅程状态 */
  const loadJourneyStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/journey/status");
      if (handleAuthError(res.status)) return;
      if (!res.ok) {
        throw new Error("加载失败");
      }
      const data = await res.json();
      setSession(data.session);
      setStepProgress(data.stepProgress);
    } catch (err) {
      handleError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, handleError]);

  /** 创建新旅程 */
  const handleStartJourney = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const res = await fetch("/api/journey/start", {
        method: "POST",
      });
      if (handleAuthError(res.status)) return;
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "创建失败");
      }
      const data = await res.json();
      setSession(data.session);
      // 重新加载步骤进度
      await loadJourneyStatus();
    } catch (err) {
      handleError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setStarting(false);
    }
  };

  /** 回退成功回调 */
  const handleRollback = async () => {
    await loadJourneyStatus();
  };

  /** 步骤操作成功回调 */
  const handleStepAction = async () => {
    await loadJourneyStatus();
  };

  useEffect(() => {
    loadJourneyStatus();
    // 清理定时器
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, [loadJourneyStatus]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">
          职业决策旅程
        </h1>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-4 bg-error/10 border border-error/20 rounded-lg">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* 无旅程状态 */}
        {!session && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                开始你的职业决策旅程
              </h2>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                通过四个步骤，帮助你做出明智的职业决策
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                  <h3 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2">
                    旅程包含四个步骤：
                  </h3>
                  <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
                    <li className="flex items-start">
                      <span className="mr-2">1.</span>
                      <span><strong>信息采集</strong> - 了解你的职业背景和现状</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">2.</span>
                      <span><strong>职业诊断</strong> - 分析你的职业画像和竞争力</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">3.</span>
                      <span><strong>行动建议</strong> - 制定具体的职业发展方案</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">4.</span>
                      <span><strong>完成</strong> - 查看你的职业决策报告</span>
                    </li>
                  </ul>
                </div>
                <Button onClick={handleStartJourney} disabled={starting} className="w-full">
                  {starting ? "创建中..." : "开始旅程"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 有旅程状态 */}
        {session && (
          <div className="space-y-6">
            {/* 进度条 */}
            <JourneyProgress
              currentStep={session.currentStep}
              stepStatus={session.stepStatus}
              completedSteps={session.completedSteps}
              version={session.version}
              stepProgress={stepProgress ?? undefined}
              onRollback={handleRollback}
              onError={handleError}
            />

            {/* 当前步骤 */}
            <JourneyStep
              currentStep={session.currentStep}
              stepStatus={session.stepStatus}
              stepProgress={stepProgress ?? undefined}
              version={session.version}
              onStart={handleStepAction}
              onComplete={handleStepAction}
              onError={handleError}
            />
          </div>
        )}
      </main>
    </div>
  );
}
