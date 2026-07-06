"use client";

/**
 * PortraitPanel — 画像展示面板
 *
 * 从 /portrait/page.tsx 提取，作为 /journey 页面的 diagnosis 步骤内容。
 * 展示职业画像 + 待确认更新。
 */

import { useState, useEffect, useCallback } from "react";
import { PendingUpdateCard } from "@/components/PendingUpdateCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

// ============================================================
// Types
// ============================================================

interface PendingUpdate {
  id: string;
  field: string;
  currentValue: unknown;
  proposedValue: unknown;
  source: string;
  sessionId: string | null;
  createdAt: string;
}

interface PortraitPanelProps {
  /** 画像查看完成回调 */
  onComplete?: () => void;
  /** 错误回调 */
  onError?: (error: string) => void;
}

// ============================================================
// Component
// ============================================================

export function PortraitPanel({ onComplete, onError }: PortraitPanelProps) {
  const [updates, setUpdates] = useState<PendingUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/portrait/pending");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "加载失败");
      }
      const data = await res.json();
      setUpdates(data.updates);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "加载失败";
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  function handleResolved(id: string) {
    setUpdates((prev) => prev.filter((u) => u.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 步骤标识 */}
      <div>
        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 mb-2">
          步骤二 · 职业诊断
        </span>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          职业画像
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          基于对话信息生成的职业画像分析
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* 待确认更新 */}
      <PendingSection
        updates={updates}
        onResolved={handleResolved}
      />

      {/* 画像详情 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>👤</span> 职业画像
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            画像详情功能开发中，敬请期待。
          </p>
        </CardContent>
      </Card>

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
// 待确认更新区块
// ============================================================

function PendingSection({
  updates,
  onResolved,
}: {
  updates: PendingUpdate[];
  onResolved: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>🔔</span> 待确认更新
          </span>
          {updates.length > 0 && (
            <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full">
              {updates.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {updates.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
            暂无待确认的更新
          </p>
        ) : (
          <div className="space-y-4">
            {updates.map((update) => (
              <PendingUpdateCard
                key={update.id}
                update={update}
                onResolved={onResolved}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
