import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",

  // 开发环境全量采样，生产环境 10%
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // 生产环境才启用
  enabled: process.env.NODE_ENV === "production" || !!process.env.SENTRY_DSN,

  // Prisma 查询追踪（Sentry 自动检测 @prisma/client）
  integrations: [Sentry.prismaIntegration()],
});
