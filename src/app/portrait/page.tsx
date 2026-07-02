"use client";

import { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { PendingUpdateCard } from "@/components/PendingUpdateCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

// ============================================================
// 类型
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

// ============================================================
// 主页面
// ============================================================

export default function PortraitPage() {
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
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  function handleResolved(id: string) {
    setUpdates((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <Navbar badge="职业画像" />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* 待确认更新 */}
        <PendingSection
          updates={updates}
          loading={loading}
          error={error}
          onResolved={handleResolved}
        />

        {/* 画像详情（占位，后续扩展） */}
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
      </main>
    </div>
  );
}

// ============================================================
// 待确认更新区块
// ============================================================

function PendingSection({
  updates,
  loading,
  error,
  onResolved,
}: {
  updates: PendingUpdate[];
  loading: boolean;
  error: string | null;
  onResolved: (id: string) => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-red-600 dark:text-red-400 text-center">
            {error}
          </p>
        </CardContent>
      </Card>
    );
  }

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
