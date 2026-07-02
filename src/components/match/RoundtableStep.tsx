"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/Card";
import type { MatchRoundtableResponse } from "@/lib/match-roundtable/schema";

// ============================================================
// 角色配置
// ============================================================

const ROLE_META: Record<
  string,
  { label: string; icon: string; color: string; bgColor: string }
> = {
  岗位洞察: {
    label: "岗位洞察",
    icon: "🔍",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
  },
  行业总监: {
    label: "行业总监",
    icon: "🏢",
    color: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-50 dark:bg-purple-950/50",
  },
  猎头: {
    label: "猎头",
    icon: "👔",
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
  },
};

// ============================================================
// 组件
// ============================================================

interface RoundtableStepProps {
  roundtable: MatchRoundtableResponse;
  onRestart: () => void;
}

export function RoundtableStep({
  roundtable,
  onRestart,
}: RoundtableStepProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* 1. 投递建议卡片 */}
      <RecommendationCard
        recommendation={roundtable.recommendation}
        riskLevel={roundtable.risk_level}
      />

      {/* 2. 3 角色发言 */}
      <ParticipantsCard participants={roundtable.participants} />

      {/* 3. 共识 / 分歧 */}
      <ConsensusCard
        consensus={roundtable.consensus}
        disagreements={roundtable.disagreements}
      />

      {/* 4. 操作 */}
      <div className="flex gap-3 justify-center pt-2">
        <button
          onClick={onRestart}
          className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
        >
          重新匹配
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 投递建议卡片
// ============================================================

function decisionStyle(decision: string): {
  bg: string;
  text: string;
  emoji: string;
} {
  switch (decision) {
    case "值得投":
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
        text: "text-emerald-800 dark:text-emerald-200",
        emoji: "✅",
      };
    case "谨慎考虑":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
        text: "text-amber-800 dark:text-amber-200",
        emoji: "⚠️",
      };
    case "不建议":
      return {
        bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
        text: "text-red-800 dark:text-red-200",
        emoji: "❌",
      };
    default:
      return {
        bg: "bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800",
        text: "text-neutral-800 dark:text-neutral-200",
        emoji: "💡",
      };
  }
}

function riskLevelStyle(level: string): string {
  switch (level) {
    case "低":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    case "中":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "高":
      return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
    default:
      return "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200";
  }
}

function RecommendationCard({
  recommendation,
  riskLevel,
}: {
  recommendation: MatchRoundtableResponse["recommendation"];
  riskLevel: string;
}) {
  const style = decisionStyle(recommendation.decision);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>💡</span> 投递建议
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 决策标签 */}
        <div className="text-center">
          <div
            className={`inline-block px-6 py-3 rounded-2xl border ${style.bg}`}
          >
            <span className="text-2xl mr-2">{style.emoji}</span>
            <span className={`text-2xl font-bold ${style.text}`}>
              {recommendation.decision}
            </span>
          </div>
          <div className="mt-2">
            <span
              className={`text-xs px-2 py-0.5 rounded ${riskLevelStyle(
                riskLevel
              )}`}
            >
              风险等级：{riskLevel}
            </span>
          </div>
        </div>

        {/* 理由 */}
        <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
            判断理由
          </p>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
            {recommendation.reason}
          </p>
        </div>

        {/* 下一步 */}
        <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800">
          <p className="text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">
            下一步行动
          </p>
          <p className="text-sm text-primary-800 dark:text-primary-200">
            {recommendation.next_step}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 3 角色发言面板
// ============================================================

function ParticipantsCard({
  participants,
}: {
  participants: MatchRoundtableResponse["participants"];
}) {
  const [activeRole, setActiveRole] = useState(participants[0]?.role ?? "");

  if (participants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>👥</span> 圆桌讨论
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            暂无讨论数据
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>👥</span> 圆桌讨论
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 角色 tab */}
        <div className="flex gap-2 mb-4">
          {participants.map((p) => {
            const meta = ROLE_META[p.role] ?? {
              label: p.role,
              icon: "💬",
              color: "text-neutral-600 dark:text-neutral-400",
              bgColor: "bg-neutral-50 dark:bg-neutral-900",
            };
            const isActive = activeRole === p.role;
            return (
              <button
                key={p.role}
                onClick={() => setActiveRole(p.role)}
                className={`flex-1 p-2.5 rounded-lg text-center transition-colors ${
                  isActive
                    ? `${meta.bgColor} ring-2 ring-primary-300 dark:ring-primary-700`
                    : "bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <span className="block text-lg mb-0.5">{meta.icon}</span>
                <span className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* 活跃角色详情 */}
        {participants.map((p) => {
          if (p.role !== activeRole) return null;
          const meta = ROLE_META[p.role] ?? {
            label: p.role,
            icon: "💬",
            color: "text-neutral-600 dark:text-neutral-400",
            bgColor: "bg-neutral-50 dark:bg-neutral-900",
          };

          // 拆分 round1 / round2（analysis 格式：【Round 1】...\n\n【Round 2】...）
          const rounds = splitRounds(p.analysis);

          return (
            <div key={p.role} className="space-y-3">
              {/* 头部 */}
              <div className={`p-4 rounded-lg ${meta.bgColor}`}>
                <p className={`text-sm font-medium ${meta.color} mb-2`}>
                  {meta.icon} {meta.label}
                </p>
                {rounds.round1 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                      Round 1 · 初始立场
                    </p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                      {rounds.round1}
                    </p>
                  </div>
                )}
                {rounds.round2 && (
                  <div>
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                      Round 2 · 交叉质疑后
                    </p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                      {rounds.round2}
                    </p>
                  </div>
                )}
                {/* 如果没有 round 标记，直接显示全文 */}
                {!rounds.round1 && !rounds.round2 && (
                  <div>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-1">
                      完整发言
                    </p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
                      {p.analysis}
                    </p>
                  </div>
                )}
              </div>

              {/* 核心观点 */}
              <div className="pl-3 border-l-2 border-primary-400 dark:border-primary-600">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  一句话核心观点
                </p>
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  {p.key_point}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** 拆分 Round 1 / Round 2 内容 */
function splitRounds(analysis: string): {
  round1: string | null;
  round2: string | null;
} {
  const r1Match = analysis.match(
    /【Round 1】\s*([\s\S]*?)(?=【Round 2】|$)/
  );
  const r2Match = analysis.match(/【Round 2】\s*([\s\S]*)$/);

  return {
    round1: r1Match?.[1]?.trim() ?? null,
    round2: r2Match?.[1]?.trim() ?? null,
  };
}

// ============================================================
// 共识 / 分歧
// ============================================================

function ConsensusCard({
  consensus,
  disagreements,
}: {
  consensus: string[];
  disagreements: string[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* 共识 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="text-emerald-500">✓</span> 共识
          </CardTitle>
        </CardHeader>
        <CardContent>
          {consensus.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              暂无共识结论。
            </p>
          ) : (
            <ul className="space-y-2">
              {consensus.map((c, i) => (
                <li
                  key={i}
                  className="text-sm text-neutral-700 dark:text-neutral-300 flex gap-2"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 分歧 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="text-amber-500">⚡</span> 分歧
          </CardTitle>
        </CardHeader>
        <CardContent>
          {disagreements.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              无明显分歧，圆桌达成一致。
            </p>
          ) : (
            <ul className="space-y-2">
              {disagreements.map((d, i) => (
                <li
                  key={i}
                  className="text-sm text-neutral-700 dark:text-neutral-300 flex gap-2"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-xs flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
