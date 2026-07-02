"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`block w-full rounded-md border px-3 py-2 text-sm transition-colors
            placeholder:text-neutral-400
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed
            dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-600
            dark:disabled:bg-neutral-800 dark:disabled:text-neutral-600
            ${
              error
                ? "border-error focus:ring-error focus:border-error"
                : "border-neutral-300 dark:border-neutral-700"
            }
            ${className}`}
          {...props}
        />
        {hint && !error && (
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
            {hint}
          </p>
        )}
        {error && (
          <p className="mt-1 text-xs text-error">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
