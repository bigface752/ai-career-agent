"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/Card";
import { STEP_META, type JourneyStepName } from "@/lib/journey-steps";

interface JourneyStepProps {
  /** 当前步骤 */
  currentStep: JourneyStepName;
  /** 当前步骤状态 */
  stepStatus: "pending" | "in_progress" | "completed";
  /** 步骤进度数据 */
  stepProgress?: {
    allowed: boolean;
    missing: string[];
    progress: number; // 0-1
  };
  /** 版本号 */
  version: number;
  /** 开始步骤回调 */
  onStart?: (newSession: { version: number }) => void;
  /** 完成步骤回调 */
  onComplete?: (newSession: { version: number }) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
}

export function JourneyStep({
  currentStep,
  stepStatus,
  stepProgress,
  version,
  onStart,
  onComplete,
  onError,
}: JourneyStepProps) {
  const [loading, setLoading] = useState(false);
  const meta = STEP_META[currentStep];

  /** 开始步骤 */
  const handleStart = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/journey/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepStatus: "in_progress", version }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "开始失败");
      }
      const data = await res.json();
      onStart?.(data.session);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "开始失败");
    } finally {
      setLoading(false);
    }
  };

  /** 完成步骤 */
  const handleComplete = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/journey/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepStatus: "completed", version }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "完成失败");
      }
      const data = await res.json();
      onComplete?.(data.session);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "完成失败");
    } finally {
      setLoading(false);
    }
  };

  /** 获取步骤内容 */
  const getStepContent = () => {
    switch (currentStep) {
      case "intake":
        return {
          action: "开始对话",
          actionDescription: "通过对话了解你的职业背景和现状",
          href: "/dialogue",
        };
      case "diagnosis":
        return {
          action: "查看画像",
          actionDescription: "分析你的职业画像和竞争力",
          href: "/portrait",
        };
      case "coaching":
        return {
          action: "获取建议",
          actionDescription: "制定具体的职业发展方案",
          href: "/evaluation",
        };
      case "complete":
        return {
          action: "查看报告",
          actionDescription: "查看你的职业决策报告",
          href: "/dashboard",
        };
    }
  };

  const content = getStepContent();

  /** 获取状态指示器 */
  const getStatusIndicator = () => {
    switch (stepStatus) {
      case "pending":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
            待开始
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
            进行中
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
            已完成
          </span>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {meta.label}
            </h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {meta.description}
            </p>
          </div>
          {getStatusIndicator()}
        </div>
      </CardHeader>

      <CardContent>
        {/* 步骤进度 */}
        {stepProgress && stepStatus !== "completed" && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-neutral-600 dark:text-neutral-400">完成进度</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {Math.round(stepProgress.progress * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full">
              <div
                className="h-full bg-primary-600 rounded-full transition-all"
                style={{ width: `${stepProgress.progress * 100}%` }}
              />
            </div>
            {stepProgress.missing.length > 0 && (
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                {stepProgress.allowed ? "已完成所有必要项" : "请先完成必要项"}
              </p>
            )}
          </div>
        )}

        {/* 步骤说明 */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {content.actionDescription}
          </p>
        </div>
      </CardContent>

      <CardFooter>
        <div className="flex gap-3 w-full">
          {stepStatus === "pending" && (
            <Button onClick={handleStart} disabled={loading} className="flex-1">
              {loading ? "处理中..." : "开始"}
            </Button>
          )}
          {stepStatus === "in_progress" && (
            <>
              <Button
                variant="secondary"
                onClick={() => window.open(content.href, "_blank")}
                className="flex-1"
              >
                {content.action}
              </Button>
              <Button
                onClick={handleComplete}
                disabled={loading || (stepProgress !== undefined && !stepProgress.allowed)}
                className="flex-1"
              >
                {loading ? "处理中..." : "标记完成"}
              </Button>
            </>
          )}
          {stepStatus === "completed" && (
            <Button
              variant="secondary"
              onClick={() => window.open(content.href, "_blank")}
              className="flex-1"
            >
              {content.action}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
