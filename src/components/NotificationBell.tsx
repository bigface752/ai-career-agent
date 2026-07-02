"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/contexts/NotificationContext";
import type { Notification, NotificationType } from "@/contexts/NotificationContext";

// ============================================================
// 图标
// ============================================================

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ============================================================
// 通知类型样式
// ============================================================

const typeConfig: Record<
  NotificationType,
  { icon: string; color: string }
> = {
  session_expiring: {
    icon: "⏰",
    color: "text-yellow-600 bg-yellow-50",
  },
  session_expired: {
    icon: "⚠️",
    color: "text-orange-600 bg-orange-50",
  },
  session_cleaned: {
    icon: "🗑️",
    color: "text-gray-600 bg-gray-50",
  },
  portrait_updated: {
    icon: "✨",
    color: "text-green-600 bg-green-50",
  },
  portrait_conflict: {
    icon: "🔔",
    color: "text-red-600 bg-red-50",
  },
};

// ============================================================
// 通知跳转映射
// ============================================================

const NOTIFICATION_LINKS: Partial<Record<NotificationType, string>> = {
  portrait_conflict: "/portrait",
};

// ============================================================
// 工具函数
// ============================================================

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "刚刚";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  return `${Math.floor(seconds / 86400)} 天前`;
}

// ============================================================
// 通知项
// ============================================================

function NotificationItem({
  notification,
  onRead,
  onNavigate,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onNavigate: (id: string, href: string) => void;
}) {
  const config = typeConfig[notification.type];
  const link = NOTIFICATION_LINKS[notification.type];

  return (
    <div
      className={`flex gap-3 p-3 transition-colors hover:bg-gray-50 ${
        !notification.read ? "bg-blue-50/50" : ""
      } ${link ? "cursor-pointer" : ""}`}
      onClick={() => {
        if (link) onNavigate(notification.id, link);
      }}
    >
      {/* 类型图标 */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${config.color}`}
      >
        {config.icon}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-gray-900 truncate">
            {notification.title}
          </p>
          {!notification.read && (
            <button
              onClick={() => onRead(notification.id)}
              className="flex-shrink-0 text-gray-400 hover:text-blue-600 transition-colors"
              title="标记已读"
            >
              <CheckIcon />
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
          {notification.content}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {formatTimeAgo(notification.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// 主组件
// ============================================================

export function NotificationBell() {
  const { notifications, unreadCount, isLoading, markRead, markAllRead } =
    useNotifications();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={panelRef}>
      {/* 铃铛按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="通知"
      >
        <BellIcon />
        {/* 未读角标 */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              通知
              {unreadCount > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-500">
                  ({unreadCount} 条未读)
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
              >
                全部已读
              </button>
            )}
          </div>

          {/* 通知列表 */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                暂无通知
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={markRead}
                  onNavigate={(id, href) => {
                    markRead(id);
                    setIsOpen(false);
                    router.push(href);
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
