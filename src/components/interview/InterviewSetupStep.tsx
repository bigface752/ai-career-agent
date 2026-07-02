"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/Card";
import type { InterviewRound, GenerateQuestionsResponse } from "@/lib/interview/schema";

// ============================================================
// Types
// ============================================================

interface JdOption {
  id: string;
  position: string;
  company_type: string;
}

const ROUNDS: { value: InterviewRound; label: string; desc: string }[] = [
  { value: "一面", label: "一面", desc: "技术面 / 业务面" },
  { value: "二面", label: "二面", desc: "部门负责人面" },
  { value: "终面", label: "终面", desc: "VP / 总监面" },
  { value: "HR面", label: "HR面", desc: "HR / 文化匹配" },
];

// ============================================================
// Component
// ============================================================

interface InterviewSetupStepProps {
  onStart: (data: GenerateQuestionsResponse) => void;
}

export function InterviewSetupStep({ onStart }: InterviewSetupStepProps) {
  const [jds, setJds] = useState<JdOption[]>([]);
  const [selectedJd, setSelectedJd] = useState<string>("");
  const [selectedRound, setSelectedRound] = useState<InterviewRound>("一面");
  const [loading, setLoading] = useState(false);
  const [loadingJds, setLoadingJds] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================
  // 加载用户的 JD 列表
  // ============================================================

  useEffect(() => {
    async function loadJds() {
      try {
        const res = await fetch("/api/match/parse-jd");
        if (res.ok) {
          const data = await res.json();
          setJds(data.jds || []);
        } else {
          setError("加载岗位列表失败，请刷新重试");
        }
      } catch {
        setError("网络错误，请检查连接后刷新重试");
      } finally {
        setLoadingJds(false);
      }
    }
    loadJds();
  }, []);

  // ============================================================
  // 生成面试题
  // ============================================================

  const handleStart = useCallback(async () => {
    if (!selectedJd) {
      setError("请选择目标岗位");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/interview/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd_id: selectedJd, round: selectedRound }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "生成面试题失败");
      }

      const data: GenerateQuestionsResponse = await res.json();
      onStart(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "生成面试题失败，请重试";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedJd, selectedRound, onStart]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* 标题 */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          面试辅导
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          选择目标岗位和面试轮次，AI 生成定制化面试题
        </p>
      </div>

      {/* JD 选择 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>📋</span> 选择目标岗位
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingJds ? (
            <div className="flex items-center gap-2 py-4">
              <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-neutral-500">加载岗位列表...</span>
            </div>
          ) : jds.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
                还没有解析过 JD，请先去岗位匹配模块解析一个岗位
              </p>
              <a
                href="/match"
                className="inline-block px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                去解析 JD →
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {jds.map((jd) => (
                <button
                  key={jd.id}
                  onClick={() => setSelectedJd(jd.id)}
                  className={`p-3 rounded-lg text-left transition-colors ${
                    selectedJd === jd.id
                      ? "bg-primary-50 dark:bg-primary-950/50 ring-2 ring-primary-500"
                      : "bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    {jd.position}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {jd.company_type}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 轮次选择 */}
      {jds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>🎯</span> 面试轮次
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ROUNDS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setSelectedRound(r.value)}
                  className={`p-3 rounded-lg text-center transition-colors ${
                    selectedRound === r.value
                      ? "bg-primary-50 dark:bg-primary-950/50 ring-2 ring-primary-500"
                      : "bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    {r.label}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {r.desc}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* 开始按钮 */}
      {jds.length > 0 && (
        <div className="flex justify-center">
          <button
            onClick={handleStart}
            disabled={!selectedJd || loading}
            className="px-8 py-3 text-sm font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                生成面试题中...
              </span>
            ) : (
              "开始模拟面试"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
