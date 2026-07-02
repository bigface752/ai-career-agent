/**
 * 薪资数据管理模块
 *
 * 职责：
 * - 薪资数据类型和验证
 * - 用户薪资输入处理
 * - 市场薪资分位计算
 */
export {
  type SalaryDataSource,
  type SalaryConfidence,
  type SalaryPercentile,
  type UserSalaryInput,
  type SalaryComparison,
  SalaryPercentileSchema,
  UserSalaryInputSchema,
  monthlyToAnnual,
  annualToMonthly,
  calculatePercentile,
  compareSalary,
} from "./types";

export { MARKET_DATA, POSITION_DISPLAY_NAMES, inferPositionId } from "./market-data";
