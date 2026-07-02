/**
 * Next.js Middleware — 路由保护
 *
 * 第一性原理：
 * - 未认证用户不应看到受保护页面
 * - JWT 签名验证足以判断token有效性（不需要查库）
 * - httpOnly cookie 是Edge Runtime下最安全的token传输机制
 *
 * Occam 剃刀：无状态JWT + cookie = 最简方案
 * 贝叶斯：合法token P(有效签名) >> 攻击者伪造 P(碰撞)，只需验证签名
 */
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

// 公开路由 — 不需要认证（精确匹配）
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/dialogue/cleanup", // cron 端点，安全由 CRON_SECRET 保证
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

  // 公开路由直接放行
  if (isPublicPath(pathname)) {
    return NextResponse.next();
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
    return NextResponse.next();
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
