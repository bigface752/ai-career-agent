/**
 * GET /api/health
 * 健康检查端点
 *
 * 返回：
 * - status: "healthy" | "degraded" | "unhealthy"
 * - version: package.json version
 * - uptime: 进程运行时间（秒）
 * - timestamp: ISO 时间戳
 * - checks: { database: "ok" | "error" }
 *
 * 用途：
 * - Vercel 部署健康检查
 * - 监控系统探活
 * - 负载均衡器后端健康检测
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const checks: Record<string, string> = {};
  let status: "healthy" | "degraded" | "unhealthy" = "healthy";

  // 数据库探活：轻量级查询
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
    status = "unhealthy";
  }

  const response = {
    status,
    version: process.env.npm_package_version || "0.1.0",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    checks,
  };

  return NextResponse.json(response, {
    status: status === "unhealthy" ? 503 : 200,
  });
}
