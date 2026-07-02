/**
 * GET /api/portrait
 * 查询用户画像
 *
 * 返回: { portrait: PortraitTemplate | null, completion: number }
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  // 1. 认证
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  // 2. 查询画像
  const portrait = await db.portrait.findUnique({
    where: { userId: user.id },
  });

  if (!portrait) {
    return Response.json({ portrait: null, completion: 0 });
  }

  // 3. 解析 JSON
  let portraitData = null;
  try {
    portraitData = JSON.parse(portrait.portraitJson);
  } catch (error) {
    console.error("画像 JSON 解析失败:", error);
    return Response.json(
      { error: "画像数据损坏" },
      { status: 500 }
    );
  }

  return Response.json({
    portrait: portraitData,
    completion: portrait.completion,
    updatedAt: portrait.updatedAt,
  });
}
