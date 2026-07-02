/**
 * 待确认画像更新 API
 *
 * GET  /api/portrait/pending — 查询当前用户的待确认更新
 * PUT  /api/portrait/pending — 处理待确认更新（accept/reject/merge）
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { savePortrait } from "@/lib/portrait/merger";
import { applyPortraitChanges } from "@/lib/portrait/extractor";
import { db } from "@/lib/db";
import type { PortraitTemplate } from "@/lib/portrait/schema";
import type { PortraitChange } from "@/lib/portrait/extractor";

// ============================================================
// GET — 查询待确认更新
// ============================================================

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  const pendingUpdates = await db.pendingUpdate.findMany({
    where: {
      userId: user.id,
      status: "pending",
    },
    orderBy: { createdAt: "desc" },
  });

  const updates = pendingUpdates.map((u) => {
    let currentValue: unknown = null;
    let proposedValue: unknown = null;
    try {
      if (u.currentValue) currentValue = JSON.parse(u.currentValue);
    } catch {
      currentValue = null;
    }
    try {
      if (u.proposedValue) proposedValue = JSON.parse(u.proposedValue);
    } catch {
      proposedValue = null;
    }
    return {
      id: u.id,
      field: u.field,
      currentValue,
      proposedValue,
      source: u.source,
      sessionId: u.sessionId,
      createdAt: u.createdAt,
    };
  });

  return Response.json({
    updates,
    count: pendingUpdates.length,
  });
}

// ============================================================
// PUT — 处理待确认更新
// ============================================================

interface PutBody {
  updateId: string;
  action: "accept" | "reject" | "merge";
  mergedValue?: unknown;
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  let body: PutBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "请求格式错误" }, { status: 400 });
  }

  if (!body.updateId || !body.action) {
    return Response.json(
      { error: "缺少 updateId 或 action" },
      { status: 400 }
    );
  }

  if (!["accept", "reject", "merge"].includes(body.action)) {
    return Response.json(
      { error: "action 必须为 accept/reject/merge" },
      { status: 400 }
    );
  }

  if (body.action === "merge" && body.mergedValue === undefined) {
    return Response.json(
      { error: "merge 操作需要提供 mergedValue" },
      { status: 400 }
    );
  }

  // 查找待确认记录
  const pending = await db.pendingUpdate.findFirst({
    where: {
      id: body.updateId,
      userId: user.id,
      status: "pending",
    },
  });

  if (!pending) {
    return Response.json(
      { error: "待确认记录不存在或已处理" },
      { status: 404 }
    );
  }

  // reject：直接标记拒绝，不需要更新画像
  if (body.action === "reject") {
    await db.pendingUpdate.update({
      where: { id: pending.id },
      data: {
        status: "rejected",
        resolvedAt: new Date(),
      },
    });
    return Response.json({ status: "rejected", id: pending.id });
  }

  // accept 或 merge：需要更新画像
  let valueToApply: unknown = null;
  if (body.action === "merge") {
    valueToApply = body.mergedValue;
  } else if (pending.proposedValue) {
    try {
      valueToApply = JSON.parse(pending.proposedValue);
    } catch {
      return Response.json({ error: "待确认记录数据损坏" }, { status: 500 });
    }
  }

  if (valueToApply === null) {
    return Response.json({ error: "无可用值" }, { status: 400 });
  }

  // 获取现有画像
  const portraitRecord = await db.portrait.findUnique({
    where: { userId: user.id },
  });

  if (!portraitRecord) {
    return Response.json({ error: "画像不存在" }, { status: 500 });
  }

  let portrait: PortraitTemplate;
  try {
    portrait = JSON.parse(portraitRecord.portraitJson);
  } catch {
    return Response.json({ error: "画像数据损坏" }, { status: 500 });
  }

  // 构造变更并应用
  const change: PortraitChange = {
    field: pending.field,
    changeType: "updated",
    newValue: valueToApply,
    evidence: `用户从待确认更新中${body.action === "merge" ? "合并" : "接受"}`,
    confidence: "high",
  };

  const updatedPortrait = applyPortraitChanges(portrait, [change]);
  await savePortrait(user.id, updatedPortrait, db);

  // 标记为已处理
  await db.pendingUpdate.update({
    where: { id: pending.id },
    data: {
      status: body.action === "merge" ? "merged" : "accepted",
      resolvedAt: new Date(),
    },
  });

  return Response.json({
    status: body.action === "merge" ? "merged" : "accepted",
    id: pending.id,
    field: pending.field,
    appliedValue: valueToApply,
  });
}
