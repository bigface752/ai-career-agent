/**
 * 搜索策略路由
 * 根据触发条件决定是否需要搜索增强
 */
import type { TriggerType } from "./schema";
import { hasPositionCard } from "../knowledge/fallback";

export interface SearchTrigger {
  type: TriggerType;
  position?: string;
  company?: string;
  reason: string;
}

/**
 * 检查是否需要触发搜索
 * 在 Agent 调用前由 Orchestrator 调用
 */
export function checkSearchTriggers(params: {
  positionId: string;
  companyName?: string;
  isPositionExpired?: boolean;
  knownCompanies?: string[];
}): SearchTrigger[] {
  const triggers: SearchTrigger[] = [];
  const { positionId, companyName, isPositionExpired, knownCompanies = [] } = params;

  // 1. new_position: 岗位不在 positions/ 中
  if (!hasPositionCard(positionId)) {
    triggers.push({
      type: "new_position",
      position: positionId,
      reason: `岗位 "${positionId}" 没有对应的知识卡`,
    });
  }

  // 2. data_expired: 知识卡过期
  if (isPositionExpired && hasPositionCard(positionId)) {
    triggers.push({
      type: "data_expired",
      position: positionId,
      reason: `岗位 "${positionId}" 的知识卡数据已过期`,
    });
  }

  // 3. target_company: 用户提到意向公司
  if (companyName) {
    triggers.push({
      type: "target_company",
      company: companyName,
      reason: `用户提到意向公司 "${companyName}"`,
    });
  }

  // 4. unknown_company: 简历中的公司不在已知列表
  if (companyName && !knownCompanies.includes(companyName)) {
    triggers.push({
      type: "unknown_company",
      company: companyName,
      reason: `公司 "${companyName}" 不在已知列表中`,
    });
  }

  return triggers;
}

/**
 * 根据触发类型生成搜索查询
 * 替换模板中的变量占位符
 */
export function renderQueryTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}
