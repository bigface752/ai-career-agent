"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/Card";
import { ShareButton } from "@/components/report/ShareButton";
import type { ParsedJd } from "@/lib/jd/schema";
import type { MatchAnalyzeResponse } from "@/lib/match/schema";

// ============================================================
// 评级样式（复用 evaluation 页面模式）
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

function severityStyle(severity: string): string {
  switch (severity) {
    case "大":
      return "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200";
    case "中":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200";
    case "小":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    default:
      return "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200";
  }
}

// ============================================================
// 组件
// ============================================================

interface MatchReportStepProps {
  parsedJd: ParsedJd;
  confidence: "high" | "low";
  note: string | null;
  analysis: MatchAnalyzeResponse;
  onViewRoundtable: () => void;
  roundtableLoading: boolean;
  roundtableError: string | null;
  reportId?: string;
  shareToken?: string | null;
}

export function MatchReportStep({
  parsedJd,
  confidence,
  note,
  analysis,
  onViewRoundtable,
  roundtableLoading,
  roundtableError,
  reportId,
  shareToken,
}: MatchReportStepProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* 低置信提示 */}
      {confidence === "low" && note && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            ⚠️ {note}
          </p>
        </div>
      )}

      {/* 1. 岗位概览 */}
      <JdOverviewCard parsedJd={parsedJd} />

      {/* 2. 整体评级 + 4 维度 */}
      <OverallMatchCard analysis={analysis} />

      {/* 3. 优势 / 差距 */}
      <StrengthsGapsCard
        strengths={analysis.strengths}
        gaps={analysis.gaps}
      />

      {/* 4. 简历优化建议 */}
      <ResumeOptimizationCard items={analysis.resume_optimization} />

      {/* 5. 分享 */}
      {reportId && (
        <div className="flex justify-center">
          <ShareButton reportId={reportId} initialShareToken={shareToken} />
        </div>
      )}

      {/* 6. 圆桌讨论入口 */}
      {roundtableError && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">
            {roundtableError}
          </p>
        </div>
      )}
      <div className="flex justify-center">
        <button
          onClick={onViewRoundtable}
          disabled={roundtableLoading}
          className="px-6 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {roundtableLoading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              圆桌讨论生成中...
            </span>
          ) : (
            "查看圆桌讨论 →"
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 岗位概览卡片
// ============================================================

function JdOverviewCard({ parsedJd }: { parsedJd: ParsedJd }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>📋</span> 岗位概览
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {parsedJd.position}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            {parsedJd.company_type}
          </span>
        </div>

        {/* 核心要求 */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              经验要求
            </p>
            <p className="text-neutral-700 dark:text-neutral-300">
              {parsedJd.requirements.experience}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              学历要求
            </p>
            <p className="text-neutral-700 dark:text-neutral-300">
              {parsedJd.requirements.education}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              薪资范围
            </p>
            <p className="text-neutral-700 dark:text-neutral-300">
              {parsedJd.requirements.salary_range}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
              工作地点
            </p>
            <p className="text-neutral-700 dark:text-neutral-300">
              {parsedJd.requirements.location}
            </p>
          </div>
        </div>

        {/* 技能标签 */}
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">
            核心技能
          </p>
          <div className="flex flex-wrap gap-1.5">
            {parsedJd.requirements.skills.map((skill, i) => (
              <span
                key={i}
                className="px-2.5 py-0.5 text-xs rounded-full bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* 加分项 */}
        {parsedJd.nice_to_have.length > 0 && (
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">
              加分项
            </p>
            <div className="flex flex-wrap gap-1.5">
              {parsedJd.nice_to_have.map((item, i) => (
                <span
                  key={i}
                  className="px-2.5 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 核心挑战 */}
        {parsedJd.key_challenges.length > 0 && (
          <div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">
              核心挑战
            </p>
            <ul className="space-y-1">
              {parsedJd.key_challenges.map((challenge, i) => (
                <li
                  key={i}
                  className="text-sm text-neutral-600 dark:text-neutral-400 flex gap-2"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-xs flex items-center justify-center font-medium">
                    {i + 1}
                  </span>
                  <span>{challenge}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// 整体评级 + 4 维度
// ============================================================

function OverallMatchCard({ analysis }: { analysis: MatchAnalyzeResponse }) {
  const dimensionEntries = [
    { key: "技能匹配", data: analysis.dimensions["技能匹配"] },
    { key: "经验匹配", data: analysis.dimensions["经验匹配"] },
    { key: "薪资匹配", data: analysis.dimensions["薪资匹配"] },
    { key: "发展匹配", data: analysis.dimensions["发展匹配"] },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>🎯</span> 匹配分析
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 整体评级 */}
        <div className="text-center">
          <span
            className={`inline-block text-4xl font-bold px-6 py-2 rounded-2xl ${ratingStyle(
              analysis.overall_rating
            )}`}
          >
            {analysis.overall_rating}
          </span>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            综合匹配度
          </p>
        </div>

        {/* 4 维度 */}
        <div className="grid grid-cols-2 gap-3">
          {dimensionEntries.map(({ key, data }) => (
            <div
              key={key}
              className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {key}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${ratingStyle(
                    data.rating
                  )}`}
                >
                  {data.rating}
                </span>
              </div>
              {/* 分数条 */}
              <div className="flex items-center gap-1.5 mb-2">
                <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      data.score >= 4
                        ? "bg-emerald-500"
                        : data.score >= 3
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${(data.score / 5) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 w-4 text-right">
                  {data.score}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {data.detail}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 优势 / 差距
// ============================================================

function StrengthsGapsCard({
  strengths,
  gaps,
}: {
  strengths: MatchAnalyzeResponse["strengths"];
  gaps: MatchAnalyzeResponse["gaps"];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* 优势 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="text-emerald-500">▲</span> 你的优势
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {strengths.map((s, i) => (
              <li key={i} className="space-y-1">
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-center font-medium mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {s.strength}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 pl-7">
                  {s.market_value}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* 差距 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="text-red-500">▼</span> 需弥补差距
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {gaps.map((g, i) => (
              <li key={i} className="space-y-1">
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-xs flex items-center justify-center font-medium mt-0.5">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        {g.gap}
                      </span>
                      <span
                        className={`text-[10px] px-1 py-0.5 rounded ${severityStyle(
                          g.severity
                        )}`}
                      >
                        {g.severity}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 pl-7">
                  {g.how_to_close}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// 简历优化建议（可折叠）
// ============================================================

function ResumeOptimizationCard({
  items,
}: {
  items: MatchAnalyzeResponse["resume_optimization"];
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
            <span>📝</span> 简历优化建议
          </CardTitle>
          <span className="text-xs text-neutral-400">
            {expanded ? "收起" : `展开（${items.length} 项）`}
          </span>
        </button>
      </CardHeader>
      {expanded && (
        <CardContent>
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.priority}
                className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 text-xs flex items-center justify-center font-medium">
                    {item.priority}
                  </span>
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {item.section}
                  </span>
                </div>
                <div className="pl-7 space-y-1">
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      改什么：
                    </span>
                    {item.what}
                  </p>
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      怎么改：
                    </span>
                    {item.how}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 italic">
                    {item.why}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
