/**
 * 搜索策略 Schema 定义
 * 基于 kitty-specs/v1-career-cognition/agents/search-strategies/_schema.md
 */
import { z } from "zod";

// ============================================================
// 触发条件
// ============================================================

export const TriggerTypeSchema = z.enum([
  "new_position", // 用户岗位不在 positions/ 中
  "target_company", // 用户提到意向公司
  "data_expired", // positions/{id}.json 的 last_updated > 90天
  "unknown_company", // 用户简历中的公司不在已知列表中
]);

export type TriggerType = z.infer<typeof TriggerTypeSchema>;

export const TriggerSchema = z.object({
  condition: z.string(),
  trigger_type: TriggerTypeSchema,
});

// ============================================================
// 查询模板
// ============================================================

export const QueryTemplateSchema = z.object({
  query_template: z.string(), // 支持 {position}, {industry}, {company}, {year} 变量
  variables: z.array(z.string()),
  purpose: z.string(),
});

// ============================================================
// 结果处理
// ============================================================

export const ResultProcessingSchema = z.object({
  extract_fields: z.array(z.string()),
  output_target: z.string(), // "positions/{id}.json" 或 "sessions/{user_id}/"
  confidence_check: z.string(),
});

// ============================================================
// 完整搜索策略
// ============================================================

export const SearchStrategySchema = z.object({
  meta: z.object({
    position_id: z.string(),
    last_updated: z.string(),
  }),
  triggers: z.array(TriggerSchema),
  queries: z.record(z.string(), z.array(QueryTemplateSchema)),
  result_processing: ResultProcessingSchema,
});

export type SearchStrategy = z.infer<typeof SearchStrategySchema>;

// ============================================================
// 公司缓存
// ============================================================

export const CompanyCacheSchema = z.object({
  meta: z.object({
    company: z.string(),
    last_updated: z.string(),
    data_sources: z.array(z.string()),
    confidence_level: z.string(),
  }),
  company_info: z.object({
    name: z.string(),
    industry: z.string(),
    size: z.string().optional(),
    china_presence: z.boolean().optional(),
    main_products: z.array(z.string()).optional(),
    culture_keywords: z.array(z.string()).optional(),
  }),
  hiring_signals: z
    .object({
      active_positions: z.array(z.string()).optional(),
      salary_range: z.record(z.string(), z.string()).optional(),
      hiring_trend: z.string().optional(),
    })
    .optional(),
});

export type CompanyCache = z.infer<typeof CompanyCacheSchema>;

// ============================================================
// 搜索结果质量控制
// ============================================================

export const QualityCheckResultSchema = z.object({
  passed: z.boolean(),
  issues: z.array(
    z.object({
      type: z.enum(["missing_source", "outdated", "inconsistent", "incomplete"]),
      message: z.string(),
      severity: z.enum(["error", "warning"]),
    })
  ),
});

export type QualityCheckResult = z.infer<typeof QualityCheckResultSchema>;

/**
 * 搜索结果质量检查
 */
export function checkSearchResultQuality(
  result: Record<string, unknown>,
  existingData?: Record<string, unknown>
): QualityCheckResult {
  const issues: QualityCheckResult["issues"] = [];

  // 检查来源
  if (!result.source && !result.data_sources) {
    issues.push({
      type: "missing_source",
      message: "搜索结果缺少数据来源",
      severity: "error",
    });
  }

  // 检查时效性（如果有 last_updated）
  if (typeof result.last_updated === "string") {
    const updated = new Date(result.last_updated);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (updated < sixMonthsAgo) {
      issues.push({
        type: "outdated",
        message: "薪资数据超过6个月",
        severity: "warning",
      });
    }
  }

  // 检查与现有数据的一致性（偏差 > 30%）
  // 简化：如果有新旧 P50 数据，比较偏差
  const newSalary = result.salary as Record<string, unknown> | undefined;
  const oldSalary = existingData?.salary as Record<string, unknown> | undefined;
  if (newSalary && oldSalary) {
    const newByCity = newSalary.by_city as Record<string, Record<string, number>> | undefined;
    const oldByCity = oldSalary.by_city as Record<string, Record<string, number>> | undefined;
    const newP50 = newByCity?.default?.P50;
    const oldP50 = oldByCity?.default?.P50;
    if (typeof newP50 === "number" && typeof oldP50 === "number" && oldP50 > 0) {
      const deviation = Math.abs(newP50 - oldP50) / oldP50;
      if (deviation > 0.3) {
        issues.push({
          type: "inconsistent",
          message: `薪资数据偏差 ${(deviation * 100).toFixed(0)}%，超过30%阈值`,
          severity: "warning",
        });
      }
    }
  }

  return {
    passed: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}
