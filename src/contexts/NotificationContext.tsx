"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ============================================================
// 类型
// ============================================================

export type NotificationType =
  | "session_expiring"
  | "session_expired"
  | "session_cleaned"
  | "portrait_updated"
  | "portrait_conflict";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  sessionId: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  /** 刷新通知列表 */
  refresh: () => Promise<void>;
  /** 标记单条通知为已读 */
  markRead: (notificationId: string) => Promise<void>;
  /** 标记所有通知为已读 */
  markAllRead: () => Promise<void>;
}

// ============================================================
// Context
// ============================================================

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) {
        // 未登录或请求失败，静默处理
        setNotifications([]);
        return;
      }
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {
      // 网络错误等，静默处理
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markRead = useCallback(
    async (notificationId: string) => {
      try {
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId }),
        });

        if (res.ok) {
          // 乐观更新
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notificationId ? { ...n, read: true } : n
            )
          );
        }
      } catch {
        // 静默失败，下次刷新会同步
      }
    },
    []
  );

  const markAllRead = useCallback(async () => {
    const unreadIds = notifications
      .filter((n) => !n.read)
      .map((n) => n.id);

    if (unreadIds.length === 0) return;

    // 乐观更新
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    // 逐个标记（后端暂无批量接口）
    for (const id of unreadIds) {
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: id }),
        });
      } catch {
        // 静默失败
      }
    }
  }, [notifications]);

  // 初始加载 + 定时刷新（每 5 分钟）
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        refresh,
        markRead,
        markAllRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications 必须在 NotificationProvider 内使用"
    );
  }
  return context;
}
