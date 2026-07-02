/**
 * POST /api/report/unshare
 * 撤销报告分享
 *
 * Body: { reportId: string }
 * 返回: { ok: true }
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { db } from "@/lib/db";

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

    // 4. 幂等：已撤销则直接返回
    if (!report.shareToken) {
      return Response.json({ ok: true });
    }

    // 5. 清空分享信息
    await db.report.update({
      where: { id: body.reportId },
      data: {
        shareToken: null,
        sharedAt: null,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("撤销分享失败:", error);
    return Response.json(
      { error: "操作失败，请稍后重试" },
      { status: 500 }
    );
  }
}
