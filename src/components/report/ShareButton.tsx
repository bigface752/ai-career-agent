"use client";

/**
 * 报告分享按钮组件
 * 支持分享/撤销/复制链接
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { showToast } from "@/components/ui/Toast";

interface ShareButtonProps {
  reportId: string;
  initialShareToken?: string | null;
}

export function ShareButton({ reportId, initialShareToken }: ShareButtonProps) {
  const [shareToken, setShareToken] = useState<string | null>(
    initialShareToken ?? null
  );
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [origin, setOrigin] = useState<string>("");

  // SSR 安全：只在客户端获取 origin
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const isShared = !!shareToken;
  const shareUrl = shareToken && origin ? `${origin}/share/${shareToken}` : null;

  const handleShare = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch("/api/report/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reportId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "分享失败");
      }

      const data = await res.json();
      setShareToken(data.shareToken);
      showToast("分享链接已创建");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "分享失败", "error");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [reportId]);

  const handleUnshare = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch("/api/report/unshare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reportId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "撤销失败");
      }

      setShareToken(null);
      showToast("分享已撤销");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "撤销失败", "error");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [reportId]);

  const handleCopy = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => showToast("链接已复制"))
      .catch(() => showToast("复制失败", "error"));
  }, [shareUrl]);

  return (
    <div className="flex items-center gap-2">
      {!isShared ? (
        <button
          onClick={handleShare}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border border-primary-300 dark:border-primary-700 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-950/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "生成中..." : "🔗 分享报告"}
        </button>
      ) : (
        <>
          <button
            onClick={handleCopy}
            className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border border-primary-300 dark:border-primary-700 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-950/50 transition-colors"
          >
            📋 复制链接
          </button>
          <button
            onClick={handleUnshare}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-neutral-500 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "撤销中..." : "撤销分享"}
          </button>
        </>
      )}
    </div>
  );
}
