"use client";

/**
 * StepContent — 步骤内容路由
 *
 * 根据当前旅程步骤，渲染对应的 Panel 组件。
 * 步骤切换时带淡入动画。
 */

import { useState, useCallback } from "react";
import type { JourneyStepName } from "@/lib/journey-steps";
import { STEP_META } from "@/lib/journey-steps";
import { DialoguePanel } from "./DialoguePanel";
import { PortraitPanel } from "./PortraitPanel";
import { CoachingPanel } from "./CoachingPanel";
import { ReportPanel } from "./ReportPanel";

// ============================================================
// Types
// ============================================================

interface StepContentProps {
  /** 当前步骤 */
  currentStep: JourneyStepName;
  /** 步骤状态 */
  stepStatus: "pending" | "in_progress" | "completed";
  /** 步骤完成回调（自动推进用） */
  onStepComplete?: (step: JourneyStepName) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
}

// ============================================================
// Component
// ============================================================

export function StepContent({
  currentStep,
  stepStatus,
  onStepComplete,
  onError,
}: StepContentProps) {
  const [transitioning, setTransitioning] = useState(false);

  /** 通用步骤完成处理：触发淡出 → 回调 */
  const handleStepComplete = useCallback(
    (step: JourneyStepName) => {
      setTransitioning(true);
      // 短暂延迟让淡出动画播放
      setTimeout(() => {
        onStepComplete?.(step);
        setTransitioning(false);
      }, 300);
    },
    [onStepComplete]
  );

  const meta = STEP_META[currentStep];

  return (
    <div
      className={`transition-opacity duration-300 ${
        transitioning ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* 步骤内容 */}
      {renderPanel(currentStep, stepStatus, handleStepComplete, onError)}
    </div>
  );
}

// ============================================================
// Panel 路由
// ============================================================

function renderPanel(
  step: JourneyStepName,
  stepStatus: "pending" | "in_progress" | "completed",
  onComplete: (step: JourneyStepName) => void,
  onError?: (error: string) => void
) {
  switch (step) {
    case "intake":
      return (
        <DialoguePanel
          onComplete={() => onComplete("intake")}
          onError={onError}
        />
      );

    case "diagnosis":
      return (
        <PortraitPanel
          onComplete={() => onComplete("diagnosis")}
          onError={onError}
        />
      );

    case "coaching":
      return (
        <CoachingPanel
          onComplete={() => onComplete("coaching")}
          onError={onError}
        />
      );

    case "complete":
      return <ReportPanel />;

    default:
      return (
        <div className="text-center py-12">
          <p className="text-neutral-500 dark:text-neutral-400">
            未知步骤：{step}
          </p>
        </div>
      );
  }
}
