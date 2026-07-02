/**
 * POST /api/salary/user-input
 * 用户补充薪资信息
 *
 * Body: UserSalaryInput
 * 返回: SalaryComparison + submissionId
 *
 * 设计：
 * - 用户输入薪资存入 SalarySubmission 表
 * - 同时返回与市场数据的对比结果
 * - 评估时自动读取用户薪资做对比
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/middleware/auth";
import { UserSalaryInputSchema, compareSalary } from "@/lib/salary";
import { MARKET_DATA } from "@/lib/salary/market-data";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    // 1. 认证
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // 2. 参数校验
    const body = await req.json();
    const parsed = UserSalaryInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "参数无效", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const input = parsed.data;

    // 3. 幂等检查：同一用户同一岗位同一城市不重复提交（24小时内）
    const recent = await db.salarySubmission.findFirst({
      where: {
        userId: user.id,
        position: input.position,
        city: input.city,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recent) {
      // 已有近期提交，返回对比结果但不重复存储
      const marketData = MARKET_DATA[input.position];
      if (!marketData) {
        return NextResponse.json({ error: "不支持的岗位" }, { status: 400 });
      }
      const comparison = compareSalary(input, marketData, "user_input");
      return NextResponse.json({
        submissionId: recent.id,
        comparison,
        isDuplicate: true,
      });
    }

    // 4. 存储用户薪资
    const submission = await db.salarySubmission.create({
      data: {
        userId: user.id,
        annualSalary: input.annualSalary,
        monthlyBase: input.monthlyBase ?? null,
        bonus: input.bonus ?? null,
        position: input.position,
        city: input.city,
        experienceYears: input.experienceYears ?? null,
        companySize: input.companySize ?? null,
        isBaseSalary: input.isBaseSalary ?? null,
      },
    });

    // 5. 计算对比结果（data_source = "user_input"，表示来自用户真实输入）
    const marketData = MARKET_DATA[input.position];
    if (!marketData) {
      return NextResponse.json({ error: "不支持的岗位" }, { status: 400 });
    }
    const comparison = compareSalary(input, marketData, "user_input");

    return NextResponse.json({
      submissionId: submission.id,
      comparison,
      isDuplicate: false,
    });
  } catch (error) {
    console.error("薪资输入处理失败:", error);
    return NextResponse.json({ error: "内部错误" }, { status: 500 });
  }
}

/**
 * GET /api/salary/user-input
 * 获取用户已提交的薪资数据
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const submissions = await db.salarySubmission.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        annualSalary: true,
        monthlyBase: true,
        bonus: true,
        position: true,
        city: true,
        experienceYears: true,
        companySize: true,
        isBaseSalary: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ submissions });
  } catch (error) {
    console.error("薪资查询失败:", error);
    return NextResponse.json({ error: "内部错误" }, { status: 500 });
  }
}
