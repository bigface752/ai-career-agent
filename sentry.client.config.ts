import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",

  // 开发环境全量采样，生产环境 10%
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // 生产环境才启用，开发环境关闭避免噪音
  enabled: process.env.NODE_ENV === "production" || !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 会话回放：生产 10% 采样
  replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // 过滤已知噪音
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
  ],
});
