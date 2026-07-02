"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/Card";
import type {
  EvaluationResult,
  AgentRunResult,
  MarketBenchmarkOutput,
  HeadhunterOutput,
  CareerMentorOutput,
  AiExpertOutput,
  PsychologistOutput,
  AgentCrossExamination,
} from "@/lib/evaluation/schema";
import type { SalaryComparison } from "@/lib/salary";

/** F2：API 返回的薪资对比数据（含岗位中文名） */
interface SalaryComparisonWithMeta extends SalaryComparison {
  positionName: string;
}

// ============================================================
// Agent 显示配置
// ============================================================

const AGENT_META: Record<
  string,
  { name: string; icon: string; color: string; bgColor: string }
> = {
  market_benchmark: {
    name: "市场对标",
    icon: "📊",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
  },
  headhunter: {
    name: "猎头",
    icon: "👔",
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
  },
  career_mentor: {
    name: "职业导师",
    icon: "🧭",
    color: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-50 dark:bg-purple-950/50",
  },
  ai_expert: {
    name: "AI效能专家",
    icon: "🤖",
    color: "text-orange-700 dark:text-orange-300",
    bgColor: "bg-orange-50 dark:bg-orange-950/50",
  },
  psychologist: {
    name: "心理学家",
    icon: "🧠",
    color: "text-pink-700 dark:text-pink-300",
    bgColor: "bg-pink-50 dark:bg-pink-950/50",
  },
};

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

function confidenceLabel(confidence: string): string {
  switch (confidence) {
    case "high":
      return "高置信";
    case "medium":
      return "中置信";
    case "low":
      return "低置信";
    default:
      return confidence;
  }
}

function confidenceStyle(confidence: string): string {
  switch (confidence) {
    case "high":
      return "text-emerald-600 dark:text-emerald-400";
    case "medium":
      return "text-amber-600 dark:text-amber-400";
    case "low":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-neutral-500";
  }
}

// ============================================================
// 主页面
// ============================================================

export default function EvaluationPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <Suspense
        fallback={
          <main className="min-h-screen flex items-center justify-center">
            <div className="inline-block w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </main>
        }
      >
        <EvaluationView />
      </Suspense>
    </div>
  );
}

// ============================================================
// 评估视图
// ============================================================

function EvaluationView() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [salaryComparison, setSalaryComparison] = useState<SalaryComparisonWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("缺少 sessionId 参数");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchEvaluation() {
      try {
        const res = await fetch(
          `/api/evaluation?sessionId=${encodeURIComponent(sessionId!)}`
        );
        if (cancelled) return;

        if (!res.ok) {
          if (res.status === 404) {
            setError("未找到评估结果，请先运行评估");
          } else {
            const data = await res.json().catch(() => ({}));
            setError(data.error || "加载评估结果失败");
          }
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        setResult(data.evaluation);
        setSalaryComparison(data.salaryComparison ?? null);
        setCreatedAt(data.createdAt);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("网络错误，请刷新重试");
          setLoading(false);
        }
      }
    }

    fetchEvaluation();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // ========== Loading ==========
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            加载评估结果...
          </p>
        </div>
      </main>
    );
  }

  // ========== Error ==========
  if (error || !result) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="text-red-600 dark:text-red-400 mb-4">
            {error || "评估结果为空"}
          </p>
          <Link
            href="/dialogue"
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            返回对话
          </Link>
        </div>
      </main>
    );
  }

  // ========== Main Content ==========
  return (
    <main className="min-h-screen pb-12">
      <Navbar
        badge="竞争力评估"
        rightContent={
          createdAt && (
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              {new Date(createdAt).toLocaleDateString("zh-CN")}
            </span>
          )
        }
      />

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* 1. 整体评级 */}
        <OverallRatingCard result={result} />

        {/* 2. 综合共识（E2） */}
        {result.synthesis && <SynthesisCard synthesis={result.synthesis} />}

        {/* 2.5 结论与下一步 */}
        <ConclusionCard rating={result.overall_rating} />

        {/* 3. 优势 / 短板 */}
        <StrengthsWeaknessesCard
          strengths={
            result.synthesis?.synthesis.revised_strengths ?? result.strengths
          }
          weaknesses={
            result.synthesis?.synthesis.revised_weaknesses ?? result.weaknesses
          }
        />

        {/* 3.5 薪资市场定位（F2） */}
        {salaryComparison && <SalaryComparisonCard comparison={salaryComparison} />}

        {/* 4. 5 Agent 评语 */}
        <AgentEvaluationsCard agents={result.agents} />

        {/* 5. 交叉质疑（可折叠） */}
        {result.synthesis?.cross_examinations && (
          <CrossExaminationsCard
            examinations={result.synthesis.cross_examinations}
          />
        )}

        {/* 6. 元数据 */}
        <MetadataCard result={result} />

        {/* 7. 操作 */}
        <div className="flex gap-3 justify-center pt-2">
          <Link
            href={`/dialogue`}
            className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            返回对话
          </Link>
          <Link
            href="/"
            className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// 整体评级卡片
// ============================================================

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

/** 半环形分数指示器（纯 CSS） */
function ScoreArc({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((score || 0) * 100)));
  const rotation = (pct / 100) * 180; // 半圆 180°
  const color =
    pct >= 70
      ? "stroke-emerald-500"
      : pct >= 45
        ? "stroke-amber-500"
        : "stroke-red-500";

  return (
    <div className="relative w-20 h-10 mx-auto">
      <svg viewBox="0 0 80 40" className="w-full h-full">
        {/* 背景弧 */}
        <path
          d="M 8 36 A 32 32 0 0 1 72 36"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className="stroke-neutral-200 dark:stroke-neutral-800"
        />
        {/* 分数弧 */}
        <path
          d="M 8 36 A 32 32 0 0 1 72 36"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={color}
          strokeDasharray={`${(rotation / 180) * 100.53} 100.53`}
        />
      </svg>
      <span className="absolute inset-x-0 bottom-0 text-center text-xs font-mono font-medium text-neutral-700 dark:text-neutral-300">
        {pct}
      </span>
    </div>
  );
}

function OverallRatingCard({ result }: { result: EvaluationResult }) {
  return (
    <Card>
      <CardContent className="text-center py-8">
        {/* 评级标签 + 含义 */}
        <div className="mb-2">
          <span
            className={`inline-block text-5xl font-bold px-6 py-2 rounded-2xl ${ratingStyle(
              result.overall_rating
            )}`}
          >
            {result.overall_rating}
          </span>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          {ratingDescription(result.overall_rating)}
        </p>

        {/* 半环形分数 */}
        <ScoreArc score={result.overall_score} />

        {/* 一句话定位 */}
        <p className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mt-4 mb-2">
          {result.one_sentence}
        </p>

        {/* 置信度 */}
        <div className="flex items-center justify-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
          <span className={confidenceStyle(result.overall_confidence)}>
            {confidenceLabel(result.overall_confidence)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 综合共识卡片（E2）
// ============================================================

function SynthesisCard({
  synthesis,
}: {
  synthesis: NonNullable<EvaluationResult["synthesis"]>;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = synthesis.synthesis;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>🎯</span> 圆桌综合共识
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 共识叙述 */}
        <div className="pl-3 border-l-2 border-primary-400 dark:border-primary-600">
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
            {s.consensus_narrative}
          </p>
        </div>

        {/* 裁决理由 */}
        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
            裁决理由
          </p>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            {s.resolution_rationale}
          </p>
        </div>

        {/* 关键分歧 */}
        {s.key_disagreements.length > 0 && (
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
              未解决的关键分歧
            </p>
            <ul className="space-y-1.5">
              {s.key_disagreements.map((d, i) => (
                <li
                  key={i}
                  className="text-sm text-neutral-600 dark:text-neutral-400 flex gap-2"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-xs flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 展开/折叠 */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
        >
          {expanded ? "收起详情" : "查看完整共识"}
        </button>
        {expanded && (
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900 text-sm text-neutral-600 dark:text-neutral-400">
            <p className="font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              最终评级详情
            </p>
            <p>
              评级：{s.overall_rating} · 评分{" "}
              {(s.overall_score * 100).toFixed(0)} ·{" "}
              {confidenceLabel(s.overall_confidence)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
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
      <CardContent className="space-y-4">
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

        <div className="flex gap-3 justify-center">
          {isStrong ? (
            <Link
              href="/match"
              className="px-6 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
            >
              进入岗位匹配 →
            </Link>
          ) : (
            <Link
              href="/coaching"
              className="px-6 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
            >
              进入工作辅导 →
            </Link>
          )}
          <Link
            href="/dialogue"
            className="px-6 py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            {isStrong ? "我还是要看看辅导" : "我还是要看机会"}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 优势 / 短板卡片
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
      {/* 优势 */}
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

      {/* 短板 */}
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

// ============================================================
// 薪资市场定位卡片（F2）
// ============================================================

function formatSalary(n: number): string {
  if (n >= 10000) {
    return `¥${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万`;
  }
  return `¥${n.toLocaleString("zh-CN")}`;
}

function SalaryComparisonCard({
  comparison,
}: {
  comparison: SalaryComparisonWithMeta;
}) {
  const { marketRange, marketPercentile, userAnnualSalary, positionName, city, label, description, confidence, dataSource } = comparison;

  // 计算用户在分布条上的位置百分比（P25→0%, P90→100%）
  const rangeTotal = marketRange.P90 - marketRange.P25;
  const userOffset = rangeTotal > 0
    ? Math.max(0, Math.min(100, ((userAnnualSalary - marketRange.P25) / rangeTotal) * 100))
    : 50;

  // 各分位在分布条上的位置
  const p50Pos = rangeTotal > 0 ? ((marketRange.P50 - marketRange.P25) / rangeTotal) * 100 : 50;
  const p75Pos = rangeTotal > 0 ? ((marketRange.P75 - marketRange.P25) / rangeTotal) * 100 : 75;

  const dataSourceLabel =
    dataSource === "user_input" ? "用户自填数据" : "公开数据推断";
  const confidenceLabelMap: Record<string, string> = {
    high: "高置信",
    medium: "中置信",
    low: "低置信",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>💰</span> 薪资市场定位
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 岗位 + 城市 */}
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {positionName} · {city}
        </p>

        {/* 用户薪资 */}
        <div className="text-center">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
            你的年薪
          </p>
          <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
            {formatSalary(userAnnualSalary)}
          </p>
        </div>

        {/* 分布可视化 */}
        <div className="space-y-3">
          {/* 分位数字标注 */}
          <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>P25</span>
            <span>P50</span>
            <span>P75</span>
            <span>P90</span>
          </div>
          {/* 分位薪资 */}
          <div className="flex justify-between text-xs font-mono text-neutral-600 dark:text-neutral-300">
            <span>{formatSalary(marketRange.P25)}</span>
            <span>{formatSalary(marketRange.P50)}</span>
            <span>{formatSalary(marketRange.P75)}</span>
            <span>{formatSalary(marketRange.P90)}</span>
          </div>

          {/* 分布条 */}
          <div className="relative h-6">
            {/* 背景条 */}
            <div className="absolute inset-x-0 top-2 h-2 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            {/* 填充条（P25 → 用户位置） */}
            <div
              className="absolute top-2 h-2 rounded-full bg-primary-500/60 dark:bg-primary-400/50"
              style={{ left: "0%", width: `${userOffset}%` }}
            />
            {/* P50 刻度线 */}
            <div
              className="absolute top-0 h-6 w-px bg-neutral-400 dark:bg-neutral-600"
              style={{ left: `${p50Pos}%` }}
            />
            {/* P75 刻度线 */}
            <div
              className="absolute top-0 h-6 w-px bg-neutral-400 dark:bg-neutral-600"
              style={{ left: `${p75Pos}%` }}
            />
            {/* 用户位置标记 */}
            <div
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${userOffset}%`, transform: "translateX(-50%)" }}
            >
              <div className="w-3 h-3 rounded-full bg-primary-600 dark:bg-primary-400 border-2 border-white dark:border-neutral-900 shadow-sm" />
              <div className="mt-0.5 text-[10px] font-medium text-primary-700 dark:text-primary-300 whitespace-nowrap">
                你
              </div>
            </div>
          </div>
        </div>

        {/* 百分位结论 */}
        <div
          className={`p-3 rounded-lg ${
            label === "强"
              ? "bg-emerald-50 dark:bg-emerald-950/30"
              : label === "中"
                ? "bg-amber-50 dark:bg-amber-950/30"
                : "bg-red-50 dark:bg-red-950/30"
          }`}
        >
          <p
            className={`text-sm font-medium ${
              label === "强"
                ? "text-emerald-800 dark:text-emerald-200"
                : label === "中"
                  ? "text-amber-800 dark:text-amber-200"
                  : "text-red-800 dark:text-red-200"
            }`}
          >
            你超过了 {marketPercentile}% 的同岗位求职者
          </p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
            {description}
          </p>
        </div>

        {/* 数据来源 */}
        <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center">
          {dataSourceLabel} · {confidenceLabelMap[confidence] ?? confidence}
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 5 Agent 评语面板
// ============================================================

function AgentEvaluationsCard({
  agents,
}: {
  agents: EvaluationResult["agents"];
}) {
  const [activeAgent, setActiveAgent] = useState<string>("market_benchmark");

  const agentEntries = Object.entries(agents) as [
    string,
    AgentRunResult<
      | MarketBenchmarkOutput
      | HeadhunterOutput
      | CareerMentorOutput
      | AiExpertOutput
      | PsychologistOutput
    >,
  ][];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>👥</span> 各 Agent 评语
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 5 Agent 评级概览条 */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {agentEntries.map(([key, agent]) => {
            const meta = AGENT_META[key] ?? { name: key, icon: "❓", color: "text-neutral-600 dark:text-neutral-400", bgColor: "bg-neutral-50 dark:bg-neutral-900" };
            const isActive = activeAgent === key;
            return (
              <button
                key={key}
                onClick={() => setActiveAgent(key)}
                className={`flex-1 min-w-[100px] p-2 rounded-lg text-center transition-colors ${
                  isActive
                    ? `${meta.bgColor} ring-2 ring-primary-300 dark:ring-primary-700`
                    : "bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <span className="block text-lg mb-0.5">{meta.icon}</span>
                <span
                  className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${ratingStyle(
                    agent.output.rating
                  )}`}
                >
                  {agent.output.rating}
                </span>
                <span className="block text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {meta.name}
                </span>
                {!agent.success && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 ml-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* 活跃 Agent 详情 */}
        {agentEntries.map(([key, agent]) => {
          if (key !== activeAgent) return null;
          return (
            <AgentDetail key={key} agentKey={key} agent={agent} />
          );
        })}
      </CardContent>
    </Card>
  );
}

function AgentDetail({
  agentKey,
  agent,
}: {
  agentKey: string;
  agent: AgentRunResult<
    | MarketBenchmarkOutput
    | HeadhunterOutput
    | CareerMentorOutput
    | AiExpertOutput
    | PsychologistOutput
  >;
}) {
  const meta = AGENT_META[agentKey];
  const output = agent.output;

  return (
    <div className="space-y-4">
      {/* 头部：评级 + summary */}
      <div className={`p-4 rounded-lg ${meta.bgColor}`}>
        <div className="flex items-center gap-3 mb-2">
          <span
            className={`text-xl font-bold px-3 py-1 rounded-lg ${ratingStyle(
              output.rating
            )}`}
          >
            {output.rating}
          </span>
          <div className="flex-1">
            <p className={`text-sm font-medium ${meta.color}`}>
              {meta.icon} {meta.name}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {confidenceLabel(output.confidence)} · 分{" "}
              {(output.composite_score * 100).toFixed(0)}
            </p>
          </div>
          {!agent.success && (
            <span className="text-xs text-red-500 dark:text-red-400">
              ⚠ 评估失败
            </span>
          )}
        </div>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {output.summary}
        </p>
      </div>

      {/* 优势 + 短板 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
            优势
          </p>
          <ul className="space-y-1.5">
            {output.strengths.map((s, i) => (
              <li
                key={i}
                className="text-xs text-neutral-600 dark:text-neutral-400 flex gap-1.5"
              >
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-[10px] flex items-center justify-center font-medium">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
            短板
          </p>
          <ul className="space-y-1.5">
            {output.weaknesses.map((w, i) => (
              <li
                key={i}
                className="text-xs text-neutral-600 dark:text-neutral-400 flex gap-1.5"
              >
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-[10px] flex items-center justify-center font-medium">
                  {i + 1}
                </span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 特化字段 */}
      <AgentSpecialFields agentKey={agentKey} output={output} />

      {/* 维度评分（默认展开） */}
      {output.dimensions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
            维度评分（{output.dimensions.length} 项）
          </p>
          <div className="space-y-2">
            {output.dimensions.map((dim, i) => (
              <DimensionRow key={i} dim={dim} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Agent 特化字段
// ============================================================

function AgentSpecialFields({
  agentKey,
  output,
}: {
  agentKey: string;
  output: Record<string, unknown>;
}) {
  switch (agentKey) {
    case "market_benchmark": {
      const sb = (output as MarketBenchmarkOutput).salary_positioning;
      if (!sb) return null;
      return (
        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
            💰 薪资定位
          </p>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            {sb.percentile} · {sb.range}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {sb.market_context}
          </p>
        </div>
      );
    }
    case "headhunter": {
      const hh = output as HeadhunterOutput;
      return (
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
              🏷️ 市场稀缺性
            </p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${ratingStyle(
                  hh.market_scarcity.level
                )}`}
              >
                {hh.market_scarcity.level}
              </span>
              {hh.market_scarcity.description}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
              ⭐ 核心卖点
            </p>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {hh.core_selling_point.primary}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {hh.core_selling_point.why}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
              ⏰ 跳槽时机
            </p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${ratingStyle(
                  hh.timing.assessment
                )}`}
              >
                {hh.timing.assessment}
              </span>
              {hh.timing.reason}
            </p>
          </div>
        </div>
      );
    }
    case "career_mentor": {
      const cm = output as CareerMentorOutput;
      return (
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
              📈 天花板分析
            </p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              {cm.ceiling_analysis.ceiling_type} · 预计{" "}
              {cm.ceiling_analysis.years_to_ceiling}到达
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              距天花板：{cm.ceiling_analysis.distance_to_ceiling}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
              🚧 关键卡点
            </p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              {cm.blocker_analysis.primary_blocker}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              类型：{cm.blocker_analysis.blocker_type}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
              🎯 突破方向
            </p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              {cm.breakthrough_strategy.most_important}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              时间线：{cm.breakthrough_strategy.timeline}
            </p>
          </div>
        </div>
      );
    }
    case "ai_expert": {
      const ai = output as AiExpertOutput;
      return (
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
              ⚠️ AI 替代风险
            </p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${ratingStyle(
                  ai.ai_replacement_risk.level
                )}`}
              >
                {ai.ai_replacement_risk.level}
              </span>
              {ai.ai_replacement_risk.detail}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
              🚀 AI 增效机会
            </p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              {ai.ai_enhancement.opportunity}
            </p>
            {ai.ai_enhancement.tools.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {ai.ai_enhancement.tools.map((tool, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            )}
          </div>
          {ai.skill_gap.length > 0 && (
            <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                📚 AI 技能缺口
              </p>
              <ul className="space-y-1">
                {ai.skill_gap.map((gap, i) => (
                  <li
                    key={i}
                    className="text-xs text-neutral-600 dark:text-neutral-400"
                  >
                    · {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }
    case "psychologist": {
      const ps = output as PsychologistOutput;
      return (
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
              💪 适应力
            </p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${ratingStyle(
                  ps.adaptability.level
                )}`}
              >
                {ps.adaptability.level}
              </span>
              {ps.adaptability.detail}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
              😰 焦虑来源
            </p>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              <span className="font-medium">{ps.anxiety_source.type}</span>
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {ps.anxiety_source.description}
            </p>
          </div>
          {ps.challenger_insight && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">
                ⚠️ 质疑者洞察
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {ps.challenger_insight}
              </p>
            </div>
          )}
        </div>
      );
    }
    default:
      return null;
  }
}

// ============================================================
// 维度评分行
// ============================================================

function DimensionRow({
  dim,
}: {
  dim: { name: string; score: number; weight: number; cot_reasoning: string; evidence: string };
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            {dim.name}
          </span>
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
            权重 {(dim.weight * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ScoreBar score={dim.score} />
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            {expanded ? "收起推理 ▲" : "查看推理 ▼"}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-2.5 pl-3 border-l-2 border-primary-200 dark:border-primary-800 space-y-2">
          <p className="text-xs text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
            {dim.cot_reasoning}
          </p>
          {dim.evidence && (
            <p className="text-xs text-neutral-500 dark:text-neutral-500 italic">
              「{dim.evidence}」
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 5) * 100;
  const color =
    score >= 4
      ? "bg-emerald-500"
      : score >= 3
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 w-4 text-right">
        {score}
      </span>
    </div>
  );
}

// ============================================================
// 交叉质疑面板
// ============================================================

function CrossExaminationsCard({
  examinations,
}: {
  examinations: AgentCrossExamination[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between"
        >
          <CardTitle className="flex items-center gap-2">
            <span>🔍</span> 交叉质疑详情
          </CardTitle>
          <span className="text-xs text-neutral-400">
            {expanded ? "收起" : `展开（${examinations.length} 份）`}
          </span>
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          {examinations.map((ce) => {
            const meta = AGENT_META[ce.agent_id];
            return (
              <div
                key={ce.agent_id}
                className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span>{meta?.icon ?? "❓"}</span>
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {meta?.name ?? ce.agent_id}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${ratingStyle(
                      ce.original_rating
                    )}`}
                  >
                    {ce.original_rating}
                  </span>
                  {ce.revised_rating !== ce.original_rating && (
                    <>
                      <span className="text-xs text-neutral-400">→</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${ratingStyle(
                          ce.revised_rating
                        )}`}
                      >
                        {ce.revised_rating}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
                  {ce.key_insight}
                </p>
                <div className="space-y-1.5">
                  {ce.examinations.map((exam, i) => (
                    <div
                      key={i}
                      className="text-xs text-neutral-500 dark:text-neutral-500 flex gap-2"
                    >
                      <span
                        className={
                          exam.agreement
                            ? "text-emerald-500"
                            : "text-amber-500"
                        }
                      >
                        {exam.agreement ? "✓" : "✗"}
                      </span>
                      <span className="font-medium">
                        {AGENT_META[exam.target_agent]?.name ??
                          exam.target_agent}
                      </span>
                      <span className="flex-1">{exam.challenge}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

// ============================================================
// 元数据卡片
// ============================================================

function MetadataCard({ result }: { result: EvaluationResult }) {
  const durationSec = (result.total_duration_ms / 1000).toFixed(1);
  const inputK = (result.total_usage.inputTokens / 1000).toFixed(1);
  const outputK = (result.total_usage.outputTokens / 1000).toFixed(1);

  return (
    <div className="flex items-center justify-center gap-4 text-xs text-neutral-400 dark:text-neutral-500">
      <span>
        耗时 <span className="font-mono">{durationSec}s</span>
      </span>
      <span>·</span>
      <span>
        输入 <span className="font-mono">{inputK}k</span> tokens
      </span>
      <span>·</span>
      <span>
        输出 <span className="font-mono">{outputK}k</span> tokens
      </span>
    </div>
  );
}
