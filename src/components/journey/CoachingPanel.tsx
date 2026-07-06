"use client";

/**
 * CoachingPanel — 行动建议面板
 *
 * 从 /evaluation/page.tsx 提取核心展示逻辑，作为 /journey 页面的 coaching 步骤内容。
 * 展示竞争力评估结果 + 行动建议。
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { EvaluationResult } from "@/lib/evaluation/schema";

// ============================================================
// Types
// ============================================================

interface CoachingPanelProps {
  /** 查看完成回调 */
  onComplete?: () => void;
  /** 错误回调 */
  onError?: (error: string) => void;
}

// ============================================================
// 评级样式
// ============================================================

function ratingStyle(rating: string): string {
  switch (rating) {
    case "强":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    case "中":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "弱":
      return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
    default:
      return "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200";
  }
}

function ratingDescription(rating: string): string {
  switch (rating) {
    case "强":
      return "具有明显竞争优势";
    case "中":
      return "有一定竞争力";
    case "弱":
      return "需要重点提升";
    default:
      return "";
  }
}

// ============================================================
// Component
// ============================================================

export function CoachingPanel({ onComplete, onError }: CoachingPanelProps) {
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  // ============================================================
  // Load evaluation result
  // ============================================================

  const loadEvaluation = useCallback(async () => {
    try {
      // 先获取最新的评估结果（通过 journey context 或直接查 API）
      const res = await fetch("/api/evaluation/latest");
      if (!res.ok) {
        if (res.status === 404) {
          // 没有评估结果，需要触发评估
          setResult(null);
          setLoading(false);
          return;
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "加载评估结果失败");
      }

      const data = await res.json();
      setResult(data.evaluation);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "加载失败";
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    loadEvaluation();
  }, [loadEvaluation]);

  // ============================================================
  // Trigger evaluation
  // ============================================================

  const handleTriggerEvaluation = useCallback(async () => {
    if (triggering) return;
    setTriggering(true);
    setError(null);

    try {
      // 获取当前对话 session ID
      const statusRes = await fetch("/api/dialogue/status?module=career");
      if (!statusRes.ok) throw new Error("获取会话状态失败");
      const statusData = await statusRes.json();

      if (!statusData.session?.sessionId) {
        throw new Error("没有活跃的对话会话");
      }

      const evalRes = await fetch("/api/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: statusData.session.sessionId }),
      });

      if (!evalRes.ok) {
        const data = await evalRes.json().catch(() => ({}));
        throw new Error(data.error || "评估失败");
      }

      const evalData = await evalRes.json();
      setResult(evalData.evaluation);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "评估失败，请重试";
      setError(msg);
      onError?.(msg);
    } finally {
      setTriggering(false);
    }
  }, [triggering, onError]);

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 没有评估结果 → 显示触发按钮
  if (!result) {
    return (
      <div className="max-w-md mx-auto text-center py-8">
        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 mb-3">
          步骤三 · 行动建议
        </span>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          竞争力评估
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          基于你的职业画像，AI 将从多个维度评估你的竞争力。
        </p>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        )}

        <button
          onClick={handleTriggerEvaluation}
          disabled={triggering}
          className="w-full px-4 py-3 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {triggering ? "评估中..." : "开始评估"}
        </button>
      </div>
    );
  }

  // 有评估结果 → 展示
  return (
    <div className="space-y-6">
      {/* 步骤标识 */}
      <div>
        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 mb-2">
          步骤三 · 行动建议
        </span>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          竞争力评估
        </h2>
      </div>

      {/* 整体评级 */}
      <Card>
        <CardContent className="text-center py-6">
          <div className="mb-2">
            <span
              className={`inline-block text-4xl font-bold px-5 py-2 rounded-2xl ${ratingStyle(
                result.overall_rating
              )}`}
            >
              {result.overall_rating}
            </span>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
            {ratingDescription(result.overall_rating)}
          </p>
          <p className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
            {result.one_sentence}
          </p>
        </CardContent>
      </Card>

      {/* 结论与下一步 */}
      <ConclusionCard rating={result.overall_rating} />

      {/* 优势 / 短板 */}
      <StrengthsWeaknessesCard
        strengths={result.synthesis?.synthesis.revised_strengths ?? result.strengths}
        weaknesses={result.synthesis?.synthesis.revised_weaknesses ?? result.weaknesses}
      />

      {/* 错误提示 */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* 继续按钮 */}
      <button
        onClick={onComplete}
        className="w-full px-4 py-3 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        继续下一步
      </button>
    </div>
  );
}

// ============================================================
// 结论与下一步
// ============================================================

function ConclusionCard({ rating }: { rating: string }) {
  const isStrong = rating === "强";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>📌</span> 结论与下一步
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900">
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
            {isStrong ? (
              <>
                <strong>建议跳槽。</strong>
                你的竞争力较强，市场时机良好。建议进入岗位匹配模块，找到适合的机会。
              </>
            ) : (
              <>
                <strong>建议先不急着跳。</strong>
                你的竞争力还有提升空间，盲目跳槽风险较高。建议先在当前岗位积累，提升核心竞争力。
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 优势 / 短板
// ============================================================

function StrengthsWeaknessesCard({
  strengths,
  weaknesses,
}: {
  strengths: string[];
  weaknesses: string[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="text-emerald-500">▲</span> 核心优势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {strengths.map((s, i) => (
              <li
                key={i}
                className="text-sm text-neutral-700 dark:text-neutral-300 flex gap-2"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-center font-medium">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="text-red-500">▼</span> 待提升短板
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {weaknesses.map((w, i) => (
              <li
                key={i}
                className="text-sm text-neutral-700 dark:text-neutral-300 flex gap-2"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-xs flex items-center justify-center font-medium">
                  {i + 1}
                </span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
