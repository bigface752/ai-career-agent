"use client";

/**
 * ReportPanel — 最终报告面板
 *
 * 作为 /journey 页面的 complete 步骤内容。
 * 展示旅程完成状态 + 后续入口。
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

// ============================================================
// Component
// ============================================================

export function ReportPanel() {
  return (
    <div className="space-y-6">
      {/* 步骤标识 */}
      <div>
        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 mb-2">
          步骤四 · 完成
        </span>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          旅程完成
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          恭喜你完成了职业决策旅程！
        </p>
      </div>

      {/* 完成卡片 */}
      <Card>
        <CardContent className="text-center py-8">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            你已完成全部步骤
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
            通过信息采集、职业诊断和行动建议，你对自己的职业方向有了更清晰的认识。
          </p>
        </CardContent>
      </Card>

      {/* 后续入口 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🚀</span> 后续建议
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              📊 查看完整评估报告
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              包含 5 个 AI Agent 的详细评语和交叉质疑分析
            </p>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              💼 进入岗位匹配
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              基于你的画像，匹配适合的目标岗位
            </p>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              🎯 模拟面试训练
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              针对目标岗位进行模拟面试和辅导
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
