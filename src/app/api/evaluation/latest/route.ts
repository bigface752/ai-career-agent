/**
 * GET /api/evaluation/latest
 * 获取当前用户最新的评估结果（不限 sessionId）
 *
 * 用于旅程 coaching 步骤，无需知道具体 sessionId。
 * 返回: 最新一条评估结果 + 薪资对比数据
 */
import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import type { EvaluationResult } from "@/lib/evaluation/schema";
import type { SalaryComparison } from "@/lib/salary";
import { compareSalary } from "@/lib/salary";
import { MARKET_DATA, POSITION_DISPLAY_NAMES } from "@/lib/salary/market-data";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  try {
    const evaluation = await db.evaluation.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!evaluation) {
      return Response.json({ error: "未找到评估结果" }, { status: 404 });
    }

    const result = JSON.parse(evaluation.resultJson) as EvaluationResult;

    // 计算薪资对比数据
    let salaryComparison: (SalaryComparison & { positionName: string }) | undefined;
    try {
      const salaryPositioning = result.agents?.market_benchmark?.output?.salary_positioning;
      if (salaryPositioning?.data_source === "user_input") {
        const submission = await db.salarySubmission.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
        });
        if (submission) {
          const marketData = MARKET_DATA[submission.position];
          if (marketData) {
            const comparison = compareSalary(
              {
                annualSalary: submission.annualSalary,
                position: submission.position as "data-analyst" | "b2b-sales" | "pmm",
                city: submission.city,
              },
              marketData,
              "user_input"
            );
            salaryComparison = {
              ...comparison,
              positionName: POSITION_DISPLAY_NAMES[submission.position] ?? submission.position,
            };
          }
        }
      }
    } catch (error) {
      console.warn("Failed to compute salary comparison:", error);
    }

    return Response.json({
      evaluationId: evaluation.id,
      evaluation: result,
      salaryComparison,
      createdAt: evaluation.createdAt,
    });
  } catch (error) {
    console.error("查询评估结果失败:", error);
    return Response.json(
      { error: "查询失败，请稍后重试" },
      { status: 500 }
    );
  }
}
