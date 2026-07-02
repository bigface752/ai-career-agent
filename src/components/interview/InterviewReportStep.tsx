"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/Card";
import { ShareButton } from "@/components/report/ShareButton";
import type { EvaluateOutput, InterviewQuestion } from "@/lib/interview/schema";

// ============================================================
// 评分样式
// ============================================================

function scoreColor(score: number): string {
  if (score >= 4) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 3) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 4) return "bg-emerald-100 dark:bg-emerald-900/60";
  if (score >= 3) return "bg-amber-100 dark:bg-amber-900/60";
  return "bg-red-100 dark:bg-red-900/60";
}

function scoreBarColor(score: number): string {
  if (score >= 4) return "bg-emerald-500";
  if (score >= 3) return "bg-amber-500";
  return "bg-red-500";
}

// ============================================================
// Component
// ============================================================

interface InterviewReportStepProps {
  evaluation: EvaluateOutput;
  questions: InterviewQuestion[];
  onRestart: () => void;
  onMatchOther: () => void;
  reportId?: string;
  shareToken?: string | null;
}

export function InterviewReportStep({
  evaluation,
  questions,
  onRestart,
  onMatchOther,
  reportId,
  shareToken,
}: InterviewReportStepProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* 标题 */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          面试评估报告
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          基于你的面试表现，AI 生成了详细的评估和改进建议
        </p>
      </div>

      {/* 1. 整体评分 */}
      <OverallRatingCard rating={evaluation.overall_rating} />

      {/* 2. 4 维度评分 */}
      <DimensionsCard dimensions={evaluation.dimensions} />

      {/* 3. 逐题评估 */}
      <PerQuestionCard
        perQuestion={evaluation.per_question}
        questions={questions}
      />

      {/* 4. Top 3 改进建议 */}
      <ImprovementsCard improvements={evaluation.top_3_improvements} />

      {/* 5. 需要重点准备的方向 */}
      {evaluation.preparation_directions &&
        evaluation.preparation_directions.length > 0 && (
          <PreparationDirectionsCard
            directions={evaluation.preparation_directions}
          />
        )}

      {/* 6. 分享 */}
      {reportId && (
        <div className="flex justify-center">
          <ShareButton reportId={reportId} initialShareToken={shareToken} />
        </div>
      )}

      {/* 6. 操作按钮 */}
      <div className="flex gap-3 justify-center pt-2">
        <button
          onClick={onRestart}
          className="px-6 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
        >
          再练一次面试
        </button>
        <button
          onClick={onMatchOther}
          className="px-6 py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          匹配其他岗位
        </button>
      </div>

      {/* 免责声明 */}
      <p className="text-center text-xs text-neutral-400 dark:text-neutral-500">
        本报告基于 AI 分析，仅供参考
      </p>
    </div>
  );
}

// ============================================================
// 整体评分卡片
// ============================================================

function OverallRatingCard({ rating }: { rating: string }) {
  // 解析格式如 '4/5：良好'、'总分 4.5/5.0'、'评分：4/5' 等
  const match = rating.match(/(\d+(?:\.\d+)?)\s*\/\s*5/);
  const score = match ? Math.min(5, parseFloat(match[1])) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>🎯</span> 整体评分
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <div className={`inline-block px-8 py-4 rounded-2xl ${scoreBg(score)}`}>
            <span className={`text-4xl font-bold ${scoreColor(score)}`}>
              {score}
            </span>
            <span className="text-xl text-neutral-400 dark:text-neutral-500">
              /5
            </span>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
            {rating}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 4 维度评分
// ============================================================

interface DimensionData {
  score: number;
  comment: string;
}

function DimensionsCard({
  dimensions,
}: {
  dimensions: EvaluateOutput["dimensions"];
}) {
  // 防御：AI 输出异常时 dimensions 可能为 null/undefined
  if (!dimensions || typeof dimensions !== "object") {
    return null;
  }

  const entries = Object.entries(dimensions) as [string, DimensionData][];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>📊</span> 分维度评分
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {entries.map(([name, data]) => (
            <div
              key={name}
              className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {name}
                </span>
                <span
                  className={`text-sm font-bold ${scoreColor(data.score)}`}
                >
                  {data.score}/5
                </span>
              </div>
              {/* 分数条 */}
              <div className="flex items-center gap-1.5 mb-2">
                <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${scoreBarColor(data.score)}`}
                    style={{ width: `${(data.score / 5) * 100}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {data.comment}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 逐题评估
// ============================================================

interface PerQuestionItem {
  question_id: string;
  rating: number;
  strength: string;
  weakness: string;
  optimized_answer: string;
  key_improvement: string;
}

function PerQuestionCard({
  perQuestion,
  questions,
}: {
  perQuestion: PerQuestionItem[];
  questions: InterviewQuestion[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>📝</span> 逐题评估
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {perQuestion.map((pq) => {
          const question = questions.find((q) => q.id === pq.question_id);
          const isExpanded = expandedId === pq.question_id;

          return (
            <div
              key={pq.question_id}
              className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden"
            >
              {/* 题目头部（可点击展开） */}
              <button
                onClick={() =>
                  setExpandedId(isExpanded ? null : pq.question_id)
                }
                className="w-full p-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                      {question?.question || pq.question_id}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {question?.type}
                      </span>
                      <span className="text-xs text-neutral-400">·</span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {question?.difficulty}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-sm font-bold ${scoreColor(pq.rating)}`}
                    >
                      {pq.rating}/5
                    </span>
                    <span
                      className={`text-xs transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      ▼
                    </span>
                  </div>
                </div>
              </button>

              {/* 展开详情 */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-neutral-100 dark:border-neutral-800 pt-3">
                  {/* 优势 / 不足 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
                        ✅ 优势
                      </p>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">
                        {pq.strength}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30">
                      <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
                        ⚠️ 不足
                      </p>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">
                        {pq.weakness}
                      </p>
                    </div>
                  </div>

                  {/* 关键改进点 */}
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
                      💡 关键改进点
                    </p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                      {pq.key_improvement}
                    </p>
                  </div>

                  {/* 优化答案 */}
                  <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800">
                    <p className="text-xs font-medium text-primary-600 dark:text-primary-400 mb-2">
                      📋 示范回答（STAR 法则优化）
                    </p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                      {pq.optimized_answer}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Top 3 改进建议
// ============================================================

interface ImprovementItem {
  priority: number;
  what: string;
  how: string;
}

function ImprovementsCard({ improvements }: { improvements: ImprovementItem[] }) {
  const priorityIcons = ["🥇", "🥈", "🥉"];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>🚀</span> Top 3 改进建议
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {improvements.map((item) => (
          <div
            key={item.priority}
            className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">
                {(item.priority >= 1 && item.priority <= 3)
                  ? priorityIcons[item.priority - 1]
                  : `${item.priority}.`}
              </span>
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {item.what}
              </span>
            </div>
            <div className="pl-8">
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                <span className="text-xs text-neutral-500 dark:text-neutral-500">
                  如何改进：
                </span>
                {item.how}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================
// 需要重点准备的方向
// ============================================================

interface PreparationDirection {
  direction: string;
  reason: string;
}

function PreparationDirectionsCard({
  directions,
}: {
  directions: PreparationDirection[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>🎯</span> 需要重点准备的方向
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {directions.map((d, i) => (
            <li
              key={i}
              className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900"
            >
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-1">
                {d.direction}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {d.reason}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
