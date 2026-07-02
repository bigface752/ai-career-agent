/**
 * POST /api/auth/logout
 * 登出：清除 httpOnly cookie + 删除设备session
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyJWT, getClearCookieHeader } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // 从 cookie 读取 token
    const token = req.cookies.get("token")?.value;

    if (token) {
      const payload = await verifyJWT(token);
      if (payload) {
        // 删除设备session
        await db.deviceSession.deleteMany({
          where: { userId: payload.userId },
        });
      }
    }

    const res = NextResponse.json({ message: "已登出" });
    res.headers.set("Set-Cookie", getClearCookieHeader());

    return res;
  } catch (error) {
    console.error("登出失败:", error);
    // 即使出错也清除 cookie
    const res = NextResponse.json({ message: "已登出" });
    res.headers.set("Set-Cookie", getClearCookieHeader());
    return res;
  }
}
