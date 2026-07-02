"use client";

import { useState, useRef, FormEvent } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/Card";

interface JdInputStepProps {
  onSubmit: (jdText: string, method: "text" | "position_name") => void;
  loading: boolean;
  error: string | null;
  /** K2 匹配分析错误（K1 已成功时显示，带重试按钮） */
  analyzeError?: string | null;
  /** 重试 K2 分析 */
  onRetryAnalyze?: () => void;
  /** K1 是否已成功解析（用于决定显示哪种错误模式） */
  hasJdParsed?: boolean;
}

export function JdInputStep({
  onSubmit,
  loading,
  error,
  analyzeError,
  onRetryAnalyze,
  hasJdParsed,
}: JdInputStepProps) {
  const [jdText, setJdText] = useState("");
  const [mode, setMode] = useState<"text" | "position_name">("text");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = jdText.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed, mode);
  }

  const charCount = jdText.trim().length;
  const isValid = mode === "position_name" ? charCount > 0 : charCount >= 20;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>输入目标岗位</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 模式切换 */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("text")}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  mode === "text"
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 font-medium"
                    : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                粘贴 JD
              </button>
              <button
                type="button"
                onClick={() => setMode("position_name")}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  mode === "position_name"
                    ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 font-medium"
                    : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                输入岗位名称
              </button>
            </div>

            {/* 输入区 */}
            <div>
              <textarea
                ref={textareaRef}
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder={
                  mode === "text"
                    ? "粘贴完整的 JD 内容，包括岗位职责、任职要求等..."
                    : "例如：B2B 销售总监、数据分析师、产品营销经理"
                }
                rows={mode === "text" ? 10 : 3}
                className="w-full px-4 py-3 text-sm border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={loading}
              />
              <div className="flex justify-between mt-1.5">
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  {mode === "text"
                    ? "至少 20 字，解析更准确"
                    : "基于行业常识推断，可能与实际 JD 有差异"}
                </p>
                <span
                  className={`text-xs tabular-nums ${
                    mode === "text" && charCount > 0 && charCount < 20
                      ? "text-red-500"
                      : "text-neutral-400 dark:text-neutral-500"
                  }`}
                >
                  {charCount}/10000
                </span>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            )}

            {/* K2 失败提示（K1 已成功，提供重试入口） */}
            {analyzeError && hasJdParsed && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                  JD 已解析成功，但匹配分析失败：{analyzeError}
                </p>
                <button
                  type="button"
                  onClick={onRetryAnalyze}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  重新分析
                </button>
              </div>
            )}

            {/* 提交 */}
            <button
              type="submit"
              disabled={!isValid || loading}
              className="w-full px-4 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  解析中...
                </span>
              ) : (
                "解析 JD"
              )}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
