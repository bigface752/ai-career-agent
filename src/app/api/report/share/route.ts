/**
 * POST /api/report/share
 * 创建报告分享链接
 *
 * Body: { reportId: string }
 * 返回: { shareToken: string, shareUrl: string, alreadyShared?: boolean }
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { db } from "@/lib/db";
import { generateShareToken } from "@/lib/report/share-token";

export async function POST(req: NextRequest) {
  // 1. 认证
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  // 2. 解析请求
  let body: { reportId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (!body.reportId) {
    return Response.json({ error: "缺少 reportId" }, { status: 400 });
  }

  try {
    // 3. 查找报告并校验归属
    const report = await db.report.findUnique({
      where: { id: body.reportId },
      select: { id: true, userId: true, shareToken: true },
    });

    if (!report) {
      return Response.json({ error: "报告不存在" }, { status: 404 });
    }

    if (report.userId !== user.id) {
      return Response.json({ error: "无权操作此报告" }, { status: 403 });
    }

    // 4. 幂等：已分享则直接返回现有链接
    const origin = req.nextUrl.origin;
    if (report.shareToken) {
      return Response.json({
        shareToken: report.shareToken,
        shareUrl: `${origin}/share/${report.shareToken}`,
        alreadyShared: true,
      });
    }

    // 5. 生成 token 并更新
    const token = generateShareToken();
    await db.report.update({
      where: { id: body.reportId },
      data: {
        shareToken: token,
        sharedAt: new Date(),
      },
    });

    return Response.json({
      shareToken: token,
      shareUrl: `${origin}/share/${token}`,
    });
  } catch (error) {
    console.error("创建分享链接失败:", error);
    return Response.json(
      { error: "操作失败，请稍后重试" },
      { status: 500 }
    );
  }
}
