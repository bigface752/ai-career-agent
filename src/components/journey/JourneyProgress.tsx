"use client";

import { useState } from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  JOURNEY_STEP_ORDER,
  STEP_META,
  getStepIndex,
  type JourneyStepName,
} from "@/lib/journey-steps";

interface JourneyProgressProps {
  /** 当前步骤 */
  currentStep: JourneyStepName;
  /** 当前步骤状态 */
  stepStatus: "pending" | "in_progress" | "completed";
  /** 已完成步骤列表 */
  completedSteps: JourneyStepName[];
  /** 版本号（用于 rollback） */
  version: number;
  /** 步骤进度数据 */
  stepProgress?: {
    allowed: boolean;
    missing: string[];
    progress: number; // 0-1
  };
  /** rollback 成功回调 */
  onRollback?: (newSession: { version: number }) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
}

export function JourneyProgress({
  currentStep,
  stepStatus,
  completedSteps,
  version,
  stepProgress,
  onRollback,
  onError,
}: JourneyProgressProps) {
  const [loading, setLoading] = useState(false);

  const currentIndex = getStepIndex(currentStep);

  /** 判断步骤是否已完成 */
  const isStepCompleted = (step: JourneyStepName) => completedSteps.includes(step);

  /** 判断步骤是否可点击回退（只有紧邻当前步骤的已完成步骤，且当前步骤为 in_progress 或 completed） */
  const isStepClickable = (step: JourneyStepName) => {
    // 只有 in_progress 或 completed 状态才允许回退
    if (stepStatus !== "in_progress" && stepStatus !== "completed") return false;
    const stepIndex = getStepIndex(step);
    // 只能点击紧邻当前步骤的已完成步骤
    return stepIndex === currentIndex - 1 && isStepCompleted(step);
  };

  /** 处理回退 */
  const handleRollback = async (targetStep: JourneyStepName) => {
    if (loading) return;

    // 确认弹窗
    if (!confirm(`回退到「${STEP_META[targetStep].label}」将丢失当前步骤的进度，确认继续？`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/journey/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "回退失败");
      }

      const data = await res.json();
      onRollback?.(data.session);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "回退失败");
    } finally {
      setLoading(false);
    }
  };

  /** 获取步骤状态样式 */
  const getStepStyles = (step: JourneyStepName, index: number) => {
    const isCurrent = step === currentStep;
    const completed = isStepCompleted(step);
    const clickable = isStepClickable(step);

    let dotClass = "bg-neutral-300 dark:bg-neutral-600";
    let textClass = "text-neutral-500 dark:text-neutral-400";
    let labelClass = "text-neutral-400 dark:text-neutral-500";

    if (isCurrent) {
      if (stepStatus === "completed") {
        dotClass = "bg-success";
        textClass = "text-success";
      } else if (stepStatus === "in_progress") {
        dotClass = "bg-primary-600 animate-pulse";
        textClass = "text-primary-600";
      } else {
        dotClass = "bg-primary-200 border-2 border-primary-600";
        textClass = "text-primary-600";
      }
      labelClass = "text-neutral-900 dark:text-neutral-100 font-medium";
    } else if (completed) {
      dotClass = "bg-success";
      textClass = "text-success";
      labelClass = "text-neutral-700 dark:text-neutral-300";
    }

    return { dotClass, textClass, labelClass, clickable };
  };

  return (
    <div className="w-full">
      {/* 步骤列表 */}
      <div className="flex items-center justify-between mb-4">
        {JOURNEY_STEP_ORDER.map((step, index) => {
          const meta = STEP_META[step];
          const { dotClass, textClass, labelClass, clickable } = getStepStyles(step, index);
          const isCurrent = step === currentStep;
          const isLast = index === JOURNEY_STEP_ORDER.length - 1;

          return (
            <div key={step} className="flex items-center flex-1">
              {/* 步骤节点 */}
              <div className="flex flex-col items-center">
                {clickable ? (
                  <button
                    onClick={() => handleRollback(step)}
                    disabled={loading}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${dotClass} ${textClass} hover:scale-110 disabled:opacity-50`}
                    aria-label={`回退到${meta.label}步骤`}
                  >
                    {isStepCompleted(step) ? "✓" : index + 1}
                  </button>
                ) : (
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${dotClass} ${textClass}`}
                  >
                    {isStepCompleted(step) ? "✓" : index + 1}
                  </div>
                )}
                <span className={`mt-2 text-xs ${labelClass}`}>{meta.label}</span>
                {isCurrent && stepProgress && (
                  <span className="mt-1 text-xs text-neutral-400">
                    {Math.round(stepProgress.progress * 100)}%
                  </span>
                )}
              </div>

              {/* 连接线 */}
              {!isLast && (
                <div className="flex-1 h-0.5 mx-2 bg-neutral-200 dark:bg-neutral-700">
                  {isStepCompleted(step) && (
                    <div className="h-full bg-success" style={{ width: "100%" }} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 当前步骤进度条 */}
      {stepProgress && stepStatus !== "completed" && (
        <div className="mt-4">
          <ProgressBar
            value={stepProgress.progress * 100}
            size="sm"
            color={stepProgress.allowed ? "success" : "primary"}
          />
          {stepProgress.missing.length > 0 && (
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              完成当前步骤后可继续
            </p>
          )}
        </div>
      )}
    </div>
  );
}
