"use client";

/**
 * 轻量 Toast 组件
 * 使用 React Portal 渲染，支持自动消失
 */

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

let toastId = 0;
let listeners: Array<(toast: ToastItem) => void> = [];

export function showToast(
  message: string,
  type: "success" | "error" | "info" = "success"
) {
  const toast: ToastItem = { id: ++toastId, message, type };
  listeners.forEach((fn) => fn(toast));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timeouts = new Map<number, NodeJS.Timeout>();

    const handler = (toast: ToastItem) => {
      setToasts((prev) => [...prev, toast]);
      const timeout = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        timeouts.delete(toast.id);
      }, 3000);
      timeouts.set(toast.id, timeout);
    };

    listeners.push(handler);
    return () => {
      listeners = listeners.filter((l) => l !== handler);
      timeouts.forEach(clearTimeout);
    };
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => removeToast(toast.id)}
          className={`
            pointer-events-auto cursor-pointer px-4 py-3 rounded-lg shadow-lg text-sm font-medium
            animate-slide-in transition-opacity
            ${
              toast.type === "success"
                ? "bg-emerald-600 text-white"
                : toast.type === "error"
                  ? "bg-red-600 text-white"
                  : "bg-neutral-700 text-white"
            }
          `}
        >
          {toast.message}
        </div>
      ))}
    </div>,
    document.body
  );
}
