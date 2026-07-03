/**
 * Next.js Middleware — 路由保护 + 安全加固
 *
 * 第一性原理：
 * - 未认证用户不应看到受保护页面
 * - JWT 签名验证足以判断token有效性（不需要查库）
 * - httpOnly cookie 是Edge Runtime下最安全的token传输机制
 * - 速率限制防止API滥用
 * - 安全Headers防止常见Web攻击
 * - CORS限制跨域访问
 *
 * Occam 剃刀：无状态JWT + cookie = 最简方案
 * 贝叶斯：合法token P(有效签名) >> 攻击者伪造 P(碰撞)，只需验证签名
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// ============================================================
// 速率限制（滑动窗口）
// ============================================================
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// 已知限制：内存 Map 在 Vercel 无状态环境下不跨实例共享
// 灰度阶段流量低，作为第一道防线仍有效；正式上线后评估 Upstash Redis 替代方案
const rateLimitMap = new Map<string, RateLimitEntry>();

// 清理过期条目（每10分钟清理一次）
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10分钟

function cleanupRateLimitMap() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const key of Array.from(rateLimitMap.keys())) {
    const entry = rateLimitMap.get(key);
    if (entry && now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  cleanupRateLimitMap();

  const now = Date.now();
  const windowMs = 60 * 1000; // 1分钟窗口
  const maxRequests = 100; // 每分钟最多100次请求

  const key = ip;
  let entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    // 新窗口或过期
    entry = { count: 1, resetTime: now + windowMs };
    rateLimitMap.set(key, entry);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}

// ============================================================
// 安全 Headers
// ============================================================
function getSecurityHeaders(): Record<string, string> {
  return {
    // 防止 MIME 类型嗅探
    "X-Content-Type-Options": "nosniff",
    // 防止点击劫持
    "X-Frame-Options": "DENY",
    // 控制 referrer 信息
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // 权限策略：禁用不必要的浏览器功能
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    // Content Security Policy - 防止 XSS
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.resend.com https://*.turso.io https://api.mimo.com https://api.deepseek.com https://dashscope.aliyuncs.com https://open.bigmodel.cn",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  };
}

// ============================================================
// CORS 配置
// ============================================================
function getCorsHeaders(origin: string | null): Record<string, string> {
  // 开发环境允许 localhost
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://ai-career-agent.vercel.app", // 生产域名（待更新）
  ];

  // 检查 origin 是否在白名单中
  const isAllowed = origin && allowedOrigins.includes(origin);

  // origin 不在白名单时不设置 Access-Control-Allow-Origin（而非 "null"）
  // 防止 sandbox iframe 等 Origin: null 场景下绕过 CORS
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400", // 24小时预检缓存
  };

  if (isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

// JWT_SECRET 缺失时在启动阶段即报错，避免所有请求静默返回 401
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET 环境变量未配置，请检查 .env 文件");
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// 公开路由 — 不需要认证（精确匹配）
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/dialogue/cleanup", // cron 端点，安全由 CRON_SECRET 保证
  "/api/health", // 健康检查，公开访问
];

// 公开 API 前缀（startsWith 匹配）
const PUBLIC_API_PREFIXES = ["/api/auth/"];

// 公开页面前缀（startsWith 匹配，用于动态路由）
const PUBLIC_PATH_PREFIXES = ["/share/"];

function isPublicPath(pathname: string): boolean {
  // 首页公开
  if (pathname === "/") return true;

  // 精确匹配公开页面
  if (PUBLIC_PATHS.includes(pathname)) return true;

  // 前缀匹配公开 API
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix)))
    return true;

  // 前缀匹配公开页面（动态路由）
  if (PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)))
    return true;

  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get("origin");
  // 取 x-forwarded-for 最后一个值（最靠近服务器的代理 IP），防止客户端伪造
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",").pop()!.trim()
    : req.headers.get("x-real-ip") || "unknown";

  // 处理 CORS 预检请求（OPTIONS）
  if (req.method === "OPTIONS") {
    const corsHeaders = getCorsHeaders(origin);
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // 速率限制（仅对 API 路由生效，只消费一次配额）
  let rateLimitRemaining: number | null = null;
  if (pathname.startsWith("/api/")) {
    const { allowed, remaining } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
    rateLimitRemaining = remaining;
  }

  // 公开路由直接放行（添加安全 headers）
  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    // 添加安全 headers
    const securityHeaders = getSecurityHeaders();
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    // 添加 CORS headers
    const corsHeaders = getCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  // 从 cookie 读取 token
  const token = req.cookies.get("token")?.value;

  if (!token) {
    // 未登录：页面请求重定向到登录页，API 请求返回 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 验证 JWT 签名（不查库，Edge 兼容）
  try {
    await jwtVerify(token, JWT_SECRET);
    const response = NextResponse.next();
    // 添加安全 headers
    const securityHeaders = getSecurityHeaders();
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    // 添加 CORS headers（仅对 API 路由生效）
    if (pathname.startsWith("/api/")) {
      const corsHeaders = getCorsHeaders(origin);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      // 使用第一次 rate limit 调用的 remaining（不重复消费配额）
      response.headers.set("X-RateLimit-Limit", "100");
      response.headers.set("X-RateLimit-Remaining", String(rateLimitRemaining));
    }
    return response;
  } catch {
    // token 无效或过期：清除 cookie，重定向登录
    if (pathname.startsWith("/api/")) {
      const res = NextResponse.json(
        { error: "登录已过期" },
        { status: 401 }
      );
      res.cookies.delete("token");
      return res;
    }
    const loginUrl = new URL("/login", req.url);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("token");
    return res;
  }
}

export const config = {
  matcher: [
    // 排除静态资源和内部路由
    "/((?!_next/static|_next/image|favicon.ico|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
