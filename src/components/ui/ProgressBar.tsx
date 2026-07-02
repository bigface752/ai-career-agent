"use client";

import { HTMLAttributes, forwardRef } from "react";

interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** 0-100 的进度值 */
  value: number;
  /** 是否显示百分比文字 */
  showLabel?: boolean;
  /** 尺寸 */
  size?: "sm" | "md" | "lg";
  /** 颜色 */
  color?: "primary" | "success" | "warning" | "error";
}

const sizeStyles = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

const colorStyles = {
  primary: "bg-primary-600 dark:bg-primary-500",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
};

const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      value,
      showLabel = false,
      size = "md",
      color = "primary",
      className = "",
      ...props
    },
    ref
  ) => {
    const clamped = Math.max(0, Math.min(100, value));

    return (
      <div ref={ref} className={`w-full ${className}`} {...props}>
        {showLabel && (
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              进度
            </span>
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {Math.round(clamped)}%
            </span>
          </div>
        )}
        <div
          className={`w-full rounded-full bg-neutral-200 dark:bg-neutral-800 ${sizeStyles[size]}`}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`rounded-full transition-all duration-300 ease-out ${sizeStyles[size]} ${colorStyles[color]}`}
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
    );
  }
);

ProgressBar.displayName = "ProgressBar";

export { ProgressBar };
export type { ProgressBarProps };
