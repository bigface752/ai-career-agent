"use client";

/**
 * useJourney — 旅程状态管理 hook
 *
 * 封装 /api/journey/* API 调用，提供旅程状态查询和自动推进能力。
 */

import { useState, useCallback, useRef } from "react";
import type { JourneyStepName } from "@/lib/journey-steps";

// ============================================================
// Types
// ============================================================

export interface JourneySession {
  id: string;
  currentStep: JourneyStepName;
  stepStatus: "pending" | "in_progress" | "completed";
  completedSteps: JourneyStepName[];
  version: number;
}

export interface StepProgress {
  allowed: boolean;
  missing: string[];
  progress: number;
}

interface JourneyStatusResponse {
  session: JourneySession | null;
  stepProgress: StepProgress | null;
}

export interface UseJourneyReturn {
  /** 当前旅程会话 */
  session: JourneySession | null;
  /** 步骤进度 */
  stepProgress: StepProgress | null;
  /** 加载中 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 加载旅程状态 */
  loadStatus: () => Promise<void>;
  /** 创建新旅程 */
  startJourney: () => Promise<void>;
  /** 推进到下一步 */
  advanceStep: (auto?: boolean, reason?: string) => Promise<boolean>;
  /** 回退到上一步 */
  rollbackStep: () => Promise<boolean>;
  /** 更新步骤状态 */
  updateStep: (stepStatus: "in_progress" | "completed") => Promise<boolean>;
}

// ============================================================
// Hook
// ============================================================

export function useJourney(): UseJourneyReturn {
  const [session, setSession] = useState<JourneySession | null>(null);
  const [stepProgress, setStepProgress] = useState<StepProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 防止并发请求
  const pendingRef = useRef(false);

  // ============================================================
  // 加载旅程状态
  // ============================================================

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/journey/status");
      if (!res.ok) {
        if (res.status === 401) throw new Error("未认证");
        throw new Error("加载失败");
      }

      const data: JourneyStatusResponse = await res.json();
      setSession(data.session);
      setStepProgress(data.stepProgress);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "加载失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================
  // 创建新旅程
  // ============================================================

  const startJourney = useCallback(async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;

    try {
      const res = await fetch("/api/journey/start", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "创建失败");
      }

      const data = await res.json();
      setSession(data.session);
      // 重新加载状态以获取 stepProgress
      await loadStatus();
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "创建失败";
      setError(msg);
    } finally {
      pendingRef.current = false;
    }
  }, [loadStatus]);

  // ============================================================
  // 推进到下一步
  // ============================================================

  const advanceStep = useCallback(
    async (auto = false, reason?: string): Promise<boolean> => {
      if (!session || pendingRef.current) return false;
      pendingRef.current = true;

      try {
        const res = await fetch("/api/journey/advance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: session.version,
            auto,
            reason,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 409) {
            // 版本冲突，刷新状态
            await loadStatus();
            return false;
          }
          throw new Error(data.message || "推进失败");
        }

        const data = await res.json();
        setSession(data.session);
        // 重新加载状态以获取新步骤的 stepProgress
        await loadStatus();
        setError(null);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "推进失败";
        setError(msg);
        return false;
      } finally {
        pendingRef.current = false;
      }
    },
    [session, loadStatus]
  );

  // ============================================================
  // 回退到上一步
  // ============================================================

  const rollbackStep = useCallback(async (): Promise<boolean> => {
    if (!session || pendingRef.current) return false;
    pendingRef.current = true;

    try {
      const res = await fetch("/api/journey/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: session.version }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          await loadStatus();
          return false;
        }
        throw new Error(data.message || "回退失败");
      }

      const data = await res.json();
      setSession(data.session);
      await loadStatus();
      setError(null);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "回退失败";
      setError(msg);
      return false;
    } finally {
      pendingRef.current = false;
    }
  }, [session, loadStatus]);

  // ============================================================
  // 更新步骤状态
  // ============================================================

  const updateStep = useCallback(
    async (stepStatus: "in_progress" | "completed"): Promise<boolean> => {
      if (!session || pendingRef.current) return false;
      pendingRef.current = true;

      try {
        const res = await fetch("/api/journey/step", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepStatus, version: session.version }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 409) {
            await loadStatus();
            return false;
          }
          throw new Error(data.message || "更新失败");
        }

        const data = await res.json();
        setSession(data.session);
        await loadStatus();
        setError(null);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "更新失败";
        setError(msg);
        return false;
      } finally {
        pendingRef.current = false;
      }
    },
    [session, loadStatus]
  );

  return {
    session,
    stepProgress,
    loading,
    error,
    loadStatus,
    startJourney,
    advanceStep,
    rollbackStep,
    updateStep,
  };
}
