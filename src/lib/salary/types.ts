/**
 * 薪资数据类型定义与验证
 *
 * 设计原则：
 * - 薪资数据来源分级：公开数据 > 用户补充 > AI推断
 * - 所有薪资数据必须标注来源和置信度
 * - 用户输入薪资单独存储，评估时与市场数据对比
 */
import { z } from "zod";

// ============================================================
// 薪资数据来源分级
// ============================================================

export type SalaryDataSource =
  | "public_web" // 公开数据（招聘网站、行业报告）
  | "user_input" // 用户补充
  | "llm_inference" // AI推断
  | "curated_llm_inference"; // 人工校验的AI推断（当前V1）

export type SalaryConfidence = "high" | "medium" | "low";

// ============================================================
// 市场薪资分位数据（对应 positions JSON 中的 salary 结构）
// ============================================================

export const SalaryPercentileSchema = z.object({
  P25: z.number(), // 25分位（元/月）
  P50: z.number(), // 中位数（元/月）
  P75: z.number(), // 75分位（元/月）
  P90: z.number(), // 90分位（元/月）
  sample_size: z.number(), // 样本量，0表示推断数据
});

export type SalaryPercentile = z.infer<typeof SalaryPercentileSchema>;

// ============================================================
// 城市标准化
// ============================================================

const CITY_ALIASES: Record<string, string> = {
  shanghai: "上海",
  sh: "上海",
  上海市: "上海",
  beijing: "北京",
  bj: "北京",
  北京市: "北京",
  shenzhen: "深圳",
  sz: "深圳",
  深圳市: "深圳",
  hangzhou: "杭州",
  hz: "杭州",
  杭州市: "杭州",
};

function normalizeCity(city: string): string {
  const lower = city.trim().toLowerCase();
  return CITY_ALIASES[lower] ?? city.trim();
}

// ============================================================
// 用户薪资输入
// ============================================================

export const UserSalaryInputSchema = z.object({
  // 必填
  annualSalary: z
    .number()
    .int("年薪必须为整数")
    .min(10000, "年薪不能低于1万")
    .max(10000000, "年薪不能超过1000万"),
  position: z.enum(["data-analyst", "b2b-sales", "pmm"], {
    message: "岗位必须是 data-analyst、b2b-sales 或 pmm",
  }),
  city: z.string().min(1, "城市不能为空").max(20),

  // 可选
  monthlyBase: z
    .number()
    .int("月薪必须为整数")
    .min(1000, "月薪不能低于1000")
    .max(1000000, "月薪不能超过100万")
    .optional(),
  bonus: z.number().int("奖金必须为整数").min(0).max(10000000).optional(), // 年终奖/提成
  experienceYears: z.number().min(0).max(50).optional(),
  companySize: z
    .enum(["startup", "scaleup", "enterprise", "unknown"])
    .optional(),
  isBaseSalary: z.boolean().optional(), // true=仅底薪，false=含提成
});

export type UserSalaryInput = z.infer<typeof UserSalaryInputSchema>;

// ============================================================
// 薪资对比结果（评估时使用）
// ============================================================

export interface SalaryComparison {
  userAnnualSalary: number;
  marketPercentile: number; // 用户薪资对应的市场分位 (0-100)
  marketRange: {
    P25: number;
    P50: number;
    P75: number;
    P90: number;
  };
  label: "强" | "中" | "弱";
  description: string;
  dataSource: string;
  confidence: SalaryConfidence;
  city: string;
  position: string;
}

// ============================================================
// 月薪资 → 年薪资转换（含13薪假设）
// ============================================================

const MONTHS_PER_YEAR = 13; // B2B企业软件通常13薪

export function monthlyToAnnual(monthlySalary: number): number {
  return Math.round(monthlySalary * MONTHS_PER_YEAR);
}

export function annualToMonthly(annualSalary: number): number {
  return Math.round(annualSalary / MONTHS_PER_YEAR);
}

// ============================================================
// 薪资分位计算
// ============================================================

/**
 * 计算用户薪资在市场分位中的位置
 * 基于线性插值法，比简单阶梯更准确
 * 防护：相邻分位相等时直接返回对应分位，避免除零
 */
export function calculatePercentile(
  userAnnualSalary: number,
  market: SalaryPercentile
): number {
  const annualP25 = monthlyToAnnual(market.P25);
  const annualP50 = monthlyToAnnual(market.P50);
  const annualP75 = monthlyToAnnual(market.P75);
  const annualP90 = monthlyToAnnual(market.P90);

  if (userAnnualSalary <= annualP25) return 25;
  if (userAnnualSalary >= annualP90) return 90;

  // 线性插值（含除零防护）
  if (userAnnualSalary <= annualP50) {
    if (annualP50 === annualP25) return 50;
    return Math.round(
      25 + ((userAnnualSalary - annualP25) / (annualP50 - annualP25)) * 25
    );
  }
  if (userAnnualSalary <= annualP75) {
    if (annualP75 === annualP50) return 75;
    return Math.round(
      50 + ((userAnnualSalary - annualP50) / (annualP75 - annualP50)) * 25
    );
  }
  if (annualP90 === annualP75) return 90;
  return Math.round(
    75 + ((userAnnualSalary - annualP75) / (annualP90 - annualP75)) * 15
  );
}

/**
 * 生成薪资对比结果
 * @param dataSource 数据来源标签，由调用方根据上下文决定
 */
export function compareSalary(
  input: UserSalaryInput,
  marketData: Record<string, SalaryPercentile>,
  dataSource: string = "curated_llm_inference"
): SalaryComparison {
  // 标准化城市名（#8 修复）
  const normalizedCity = normalizeCity(input.city);
  const cityKey =
    normalizedCity in marketData ? normalizedCity : "default";
  const market = marketData[cityKey];
  if (!market) {
    throw new Error(`市场数据缺失：${input.city} 且无 default 数据`);
  }

  const percentile = calculatePercentile(input.annualSalary, market);

  // 定性评级
  let label: "强" | "中" | "弱";
  let description: string;
  if (percentile >= 75) {
    label = "强";
    description = `你的薪资处于市场 P${percentile}，高于大多数同岗位从业者`;
  } else if (percentile >= 45) {
    label = "中";
    description = `你的薪资处于市场 P${percentile}，处于中等水平`;
  } else {
    label = "弱";
    description = `你的薪资处于市场 P${percentile}，低于市场中位数`;
  }

  return {
    userAnnualSalary: input.annualSalary,
    marketPercentile: percentile,
    marketRange: {
      P25: monthlyToAnnual(market.P25),
      P50: monthlyToAnnual(market.P50),
      P75: monthlyToAnnual(market.P75),
      P90: monthlyToAnnual(market.P90),
    },
    label,
    description,
    dataSource,
    confidence: market.sample_size > 0 ? "medium" : "low",
    city: cityKey,
    position: input.position,
  };
}
