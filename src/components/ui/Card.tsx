"use client";

import { HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

const paddingStyles = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = "md", hover = false, className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900
          ${hover ? "transition-shadow hover:shadow-md" : "shadow-sm"}
          ${paddingStyles[padding]}
          ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

// 子组件
function CardHeader({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`border-b border-neutral-200 dark:border-neutral-800 pb-3 mb-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

function CardTitle({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`text-base font-semibold text-neutral-900 dark:text-neutral-100 ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

function CardDescription({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`text-sm text-neutral-500 dark:text-neutral-400 mt-1 ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

function CardContent({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

function CardFooter({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`border-t border-neutral-200 dark:border-neutral-800 pt-3 mt-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
export type { CardProps };
