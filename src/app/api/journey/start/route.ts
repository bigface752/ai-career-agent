/**
 * POST /api/journey/start
 * 创建新的旅程会话
 *
 * 返回: 新创建的旅程会话
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { getJourneySession, createJourneySession, formatSessionResponse } from "@/lib/journey";

export async function POST(req: NextRequest) {
  // 1. 认证
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  // 2. 检查是否已有会话
  const existing = await getJourneySession(user.id);
  if (existing) {
    return Response.json(
      { error: "JOURNEY_ALREADY_EXISTS", message: "旅程已存在" },
      { status: 409 }
    );
  }

  // 3. 创建新会话（处理并发竞态）
  try {
    const session = await createJourneySession(user.id);

    return Response.json({
      session: formatSessionResponse(session),
    });
  } catch (error: unknown) {
    // Prisma P2002 = Unique constraint failed（并发创建冲突）
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return Response.json(
        { error: "JOURNEY_ALREADY_EXISTS", message: "旅程已存在" },
        { status: 409 }
      );
    }
    throw error;
  }
}
