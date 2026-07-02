/**
 * 市场薪资分位数据
 *
 * 唯一数据源，salary/user-input API 和 evaluation API 共用。
 * 数据来源：基于招聘网站公开区间 + 行业报告交叉校验（LLM 推断）。
 * 待接入真实数据源后更新此文件。
 */
import type { SalaryPercentile } from "./types";

export const MARKET_DATA: Record<string, Record<string, SalaryPercentile>> = {
  "data-analyst": {
    上海: { P25: 15000, P50: 22000, P75: 30000, P90: 40000, sample_size: 0 },
    北京: { P25: 16000, P50: 24000, P75: 32000, P90: 42000, sample_size: 0 },
    深圳: { P25: 14000, P50: 21000, P75: 28000, P90: 38000, sample_size: 0 },
    杭州: { P25: 13000, P50: 20000, P75: 27000, P90: 36000, sample_size: 0 },
    default: { P25: 12000, P50: 18000, P75: 25000, P90: 35000, sample_size: 0 },
  },
  "b2b-sales": {
    上海: { P25: 12000, P50: 20000, P75: 35000, P90: 55000, sample_size: 0 },
    北京: { P25: 13000, P50: 22000, P75: 38000, P90: 58000, sample_size: 0 },
    深圳: { P25: 11000, P50: 18000, P75: 32000, P90: 50000, sample_size: 0 },
    杭州: { P25: 10000, P50: 17000, P75: 30000, P90: 48000, sample_size: 0 },
    default: { P25: 9000, P50: 15000, P75: 28000, P90: 45000, sample_size: 0 },
  },
  pmm: {
    上海: { P25: 15000, P50: 25000, P75: 38000, P90: 52000, sample_size: 0 },
    北京: { P25: 16000, P50: 27000, P75: 40000, P90: 55000, sample_size: 0 },
    深圳: { P25: 14000, P50: 23000, P75: 35000, P90: 48000, sample_size: 0 },
    杭州: { P25: 13000, P50: 22000, P75: 33000, P90: 45000, sample_size: 0 },
    default: { P25: 12000, P50: 20000, P75: 30000, P90: 42000, sample_size: 0 },
  },
};

/** 岗位ID → 中文名映射（用于从 SlotState 匹配岗位） */
export const POSITION_DISPLAY_NAMES: Record<string, string> = {
  "data-analyst": "数据分析师",
  "b2b-sales": "B2B销售",
  pmm: "产品营销经理",
};

/**
 * 从 SlotState 的 current_role 推断 position_id
 * 支持中文名和英文ID两种输入
 */
export function inferPositionId(currentRole: string): string | null {
  // 直接是 position_id
  if (currentRole in MARKET_DATA) return currentRole;

  // 中文名 → position_id
  for (const [id, name] of Object.entries(POSITION_DISPLAY_NAMES)) {
    if (currentRole.includes(name) || name.includes(currentRole)) return id;
  }

  // 模糊匹配
  const lower = currentRole.toLowerCase();
  if (lower.includes("数据") || lower.includes("analyst")) return "data-analyst";
  if (lower.includes("销售") || lower.includes("sales")) return "b2b-sales";
  if (lower.includes("pmm") || lower.includes("产品营销") || lower.includes("市场")) return "pmm";

  return null;
}
