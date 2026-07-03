/**
 * Next.js Instrumentation Hook
 * Sentry 用于初始化 server/edge runtime 的 SDK
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  try {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      // Server-side Sentry init
      await import("../sentry.server.config");
    }

    if (process.env.NEXT_RUNTIME === "edge") {
      // Edge Runtime Sentry init (middleware)
      await import("../sentry.edge.config");
    }
  } catch (error) {
    // 监控工具初始化失败不应阻塞应用启动
    console.warn("[instrumentation] Sentry initialization failed:", error);
  }
}
