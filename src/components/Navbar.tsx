"use client";

import Link from "next/link";
import { NotificationBell } from "./NotificationBell";

interface NavbarProps {
  /** 左侧返回链接 */
  backHref?: string;
  /** 左侧返回文本 */
  backText?: string;
  /** 中间标签 */
  badge?: string;
  /** 右侧额外内容 */
  rightContent?: React.ReactNode;
}

export function Navbar({
  backHref = "/",
  backText = "首页",
  badge,
  rightContent,
}: NavbarProps) {
  return (
    <header className="flex-shrink-0 border-b border-neutral-200 dark:border-neutral-800 px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        {/* 左侧 */}
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            ← {backText}
          </Link>
          {badge && (
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300">
              {badge}
            </span>
          )}
        </div>

        {/* 右侧 */}
        <div className="flex items-center gap-2">
          {rightContent}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
