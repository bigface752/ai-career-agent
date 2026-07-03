import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withSentryConfig(nextConfig, {
  // 仅上传 source map 到 Sentry（生产 + 有 DSN 时）
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // CI 环境无 SENTRY_AUTH_TOKEN 时跳过 source map 上传
  dryRun: !process.env.SENTRY_AUTH_TOKEN,

  // 自动上传 source map（生产构建时）
  widenClientFileUpload: true,

  // 隐藏 source map 在客户端的引用
  hideSourceMaps: true,

  // 自动打 instrumentation（Prisma、fetch 等）
  autoInstrumentServerFunctions: true,

  // Vercel Cron 路由的自动 instrument
  automaticVercelMonitors: true,

  // 静默 Sentry 构建日志中的警告
  silent: true,
});
