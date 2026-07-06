"use client";

/**
 * /journey — 统一旅程页面
 *
 * V1.2 重写：旅程即对话，步骤是对话的章节。
 * 使用 useJourney 管理状态，StepContent 渲染步骤内容。
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { JourneyProgress } from "@/components/journey/JourneyProgress";
import { StepContent } from "@/components/journey/StepContent";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { useJourney } from "@/hooks/useJourney";
import { STEP_META, JOURNEY_STEP_ORDER, type JourneyStepName } from "@/lib/journey-steps";

// ============================================================
// Auto-advance 配置
// ============================================================

/** 自动推进的步骤映射：当前步骤完成后，自动推进到下一步 */
const AUTO_ADVANCE_STEPS: JourneyStepName[] = ["intake"];

/** 自动推进延迟（ms），给用户看通知的时间 */
const AUTO_ADVANCE_DELAY = 3000;

// ============================================================
// Page Component
// ============================================================

export default function JourneyPage() {
  const router = useRouter();
  const {
    session,
    stepProgress,
    loading,
    error: journeyError,
    loadStatus,
    startJourney,
    advanceStep,
    rollbackStep,
  } = useJourney();

  // ============================================================
  // Load on mount
  // ============================================================

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // ============================================================
  // Auth error handling
  // ============================================================

  useEffect(() => {
    if (journeyError === "未认证") {
      router.push("/login");
    }
  }, [journeyError, router]);

  // ============================================================
  // Step complete callback → auto-advance
  // ============================================================

  const [autoAdvanceNotice, setAutoAdvanceNotice] = useState<string | null>(null);

  const handleStepComplete = useCallback(
    async (step: JourneyStepName) => {
      // 先标记当前步骤完成
      const marked = await fetch("/api/journey/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepStatus: "completed",
          version: session?.version,
        }),
      }).then((r) => r.ok);

      if (!marked) {
        // 版本冲突或其他错误，刷新状态
        await loadStatus();
        return;
      }

      // 刷新状态
      await loadStatus();

      // 自动推进
      if (AUTO_ADVANCE_STEPS.includes(step)) {
        const nextStepName = STEP_META[getNextStepName(step) ?? "diagnosis"]?.label;
        setAutoAdvanceNotice(`${STEP_META[step].label}完成，正在进入${nextStepName}...`);

        setTimeout(async () => {
          setAutoAdvanceNotice(null);
          await advanceStep(true, `auto_advance_after_${step}`);
        }, AUTO_ADVANCE_DELAY);
      }
    },
    [session, loadStatus, advanceStep]
  );

  // ============================================================
  // Rollback callback
  // ============================================================

  const handleRollback = useCallback(async () => {
    await rollbackStep();
  }, [rollbackStep]);

  // ============================================================
  // Error callback
  // ============================================================

  const [panelError, setPanelError] = useState<string | null>(null);

  const handlePanelError = useCallback((error: string) => {
    setPanelError(error);
    // 3s 后自动清除
    setTimeout(() => setPanelError(null), 3000);
  }, []);

  // ============================================================
  // Render
  // ============================================================

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
        {/* 页面标题 */}
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">
          职业决策旅程
        </h1>

        {/* 错误提示 */}
        {(journeyError || panelError) && (
          <div className="mb-4 p-4 bg-error/10 border border-error/20 rounded-lg">
            <p className="text-sm text-error">{journeyError || panelError}</p>
          </div>
        )}

        {/* 自动推进通知 */}
        {autoAdvanceNotice && (
          <div className="mb-4 p-4 bg-primary-50 dark:bg-primary-950/50 border border-primary-200 dark:border-primary-800 rounded-lg">
            <p className="text-sm text-primary-700 dark:text-primary-300">
              {autoAdvanceNotice}
            </p>
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
                      <span><strong>信息采集</strong> - 通过对话了解你的职业背景和现状</span>
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
                <Button onClick={startJourney} className="w-full">
                  开始旅程
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
              onError={handlePanelError}
            />

            {/* 步骤内容 */}
            <StepContent
              currentStep={session.currentStep}
              stepStatus={session.stepStatus}
              onStepComplete={handleStepComplete}
              onError={handlePanelError}
            />
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function getNextStepName(current: JourneyStepName): JourneyStepName | null {
  const idx = JOURNEY_STEP_ORDER.indexOf(current);
  if (idx < 0 || idx >= JOURNEY_STEP_ORDER.length - 1) return null;
  return JOURNEY_STEP_ORDER[idx + 1];
}
