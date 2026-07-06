/**
 * GET /api/journey/status
 * 查询用户的旅程会话状态
 *
 * 返回: 当前旅程状态 + 步骤进度，无会话时返回 { session: null }
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { getJourneySession, formatSessionResponse, validateStepData } from "@/lib/journey";

export async function GET(req: NextRequest) {
  // 1. 认证
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  // 2. 查询旅程会话
  const session = await getJourneySession(user.id);
  if (!session) {
    return Response.json({ session: null });
  }

  // 3. 获取步骤进度
  const gate = await validateStepData(user.id, session.currentStep);

  // 4. 返回状态
  return Response.json({
    session: formatSessionResponse(session),
    stepProgress: gate,
  });
}
