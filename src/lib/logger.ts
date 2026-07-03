import pino from "pino";
import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV !== "production";

const pinoInstance = pino({
  level: isDev ? "debug" : "info",

  // 生产环境 JSON，开发环境 pretty
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
    : undefined,

  // 序列化：Error 对象提取 message + stack
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },

  // 全局字段
  base: { service: "tiaobutiao" },
});

// ========== Sentry 集成 ==========
// warn/error 级别自动上报 Sentry

function sendToSentry(level: string, msg: string, context?: LogContext) {
  Sentry.withScope((scope) => {
    if (context?.userId) scope.setUser({ id: context.userId });
    if (context?.requestId) scope.setTag("requestId", context.requestId);
    if (context?.route) scope.setTag("route", context.route);

    if (level === "error") {
      scope.setLevel("error");
      // 有 Error 对象时用 captureException（保留完整栈信息）
      if (context?.err instanceof Error) {
        scope.setExtra("logMessage", msg);
        scope.setExtra("loggerContext", context);
        Sentry.captureException(context.err);
      } else {
        Sentry.captureMessage(msg, "error");
      }
    } else if (level === "warn") {
      scope.setLevel("warning");
      Sentry.captureMessage(msg, "warning");
    }
  });
}

// ========== 类型定义 ==========

export interface LogContext {
  /** 用户 ID */
  userId?: string;
  /** 请求 ID（用于跨日志关联） */
  requestId?: string;
  /** 路由标识，如 "interview/answer" */
  route?: string;
  /** 会话 ID */
  sessionId?: string;
  /** 模块名 */
  module?: string;
  /** Error 对象（Sentry 优先用 captureException 保留栈信息） */
  err?: Error | unknown;
  /** 额外结构化数据 */
  [key: string]: unknown;
}

export interface Logger {
  debug(msg: string, ctx?: LogContext): void;
  info(msg: string, ctx?: LogContext): void;
  warn(msg: string, ctx?: LogContext): void;
  error(msg: string, ctx?: LogContext): void;
  /** 创建带固定上下文的子 logger（用于路由级别） */
  childContext(fixed: LogContext): Logger;
}

// ========== Logger 实现 ==========

function normalizeContext(ctx: LogContext): LogContext {
  // 确保 err 字段是 Error 实例，pino serializer 才能正确序列化
  if (ctx.err && !(ctx.err instanceof Error)) {
    ctx.err = new Error(String(ctx.err));
  }
  return ctx;
}

function createLogger(fixedCtx: LogContext = {}): Logger {
  const merge = (ctx?: LogContext) => normalizeContext({ ...fixedCtx, ...ctx });

  const log = (level: "debug" | "info" | "warn" | "error", msg: string, ctx?: LogContext) => {
    const merged = merge(ctx);
    pinoInstance[level](merged, msg);

    // warn/error 上报 Sentry
    if (level === "warn" || level === "error") {
      sendToSentry(level, msg, merged);
    }
  };

  return {
    debug: (msg, ctx) => log("debug", msg, ctx),
    info: (msg, ctx) => log("info", msg, ctx),
    warn: (msg, ctx) => log("warn", msg, ctx),
    error: (msg, ctx) => log("error", msg, ctx),
    childContext: (fixed: LogContext) => createLogger({ ...fixedCtx, ...fixed }),
  };
}

// 全局 logger 实例
export const logger = createLogger();

/**
 * 创建路由级别的 logger（自带 route 上下文）
 *
 * @example
 * const log = createRouteLogger("interview/answer");
 * log.info("开始处理", { userId, sessionId });
 * log.error("AI 调用失败", { userId, err });
 */
export function createRouteLogger(route: string): Logger {
  return logger.childContext({ route });
}
