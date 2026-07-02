/**
 * 最近岗位匹配算法
 * 当 positions/{position}.json 不存在时，找最近的岗位作为 fallback
 * 基于 DYNAMIC-ROLE-GENERATION-PROCESS.md 中的匹配表
 */

// 技能簇 → 基础岗位映射
const SKILL_CLUSTER_MAP: Record<string, string> = {
  // 数据簇
  "data-pm": "data-analyst",
  "bi-analyst": "data-analyst",
  "data-ops": "data-analyst",
  "data-engineer": "data-analyst",
  "data-product-manager": "data-analyst",

  // 销售簇
  "pre-sales": "b2b-sales",
  "solution-sales": "b2b-sales",
  "customer-success": "b2b-sales",
  bd: "b2b-sales",

  // 产品簇 → 归入数据簇
  "product-manager": "data-analyst",
  "product-ops": "data-analyst",

  // 营销簇 → 归入销售簇
  marketing: "b2b-sales",
  brand: "b2b-sales",
  "channel-ops": "b2b-sales",

  // 技术簇 → 归入数据簇
  frontend: "data-analyst",
  backend: "data-analyst",
  "qa-test": "data-analyst",

  // PMM
  pmm: "pmm",
  "product-marketing": "pmm",
};

// 已有知识卡的岗位列表
const AVAILABLE_POSITIONS = ["data-analyst", "b2b-sales", "pmm"];

/**
 * 查找最近的岗位
 * 1. 精确匹配
 * 2. 映射表匹配
 * 3. 默认 fallback 到 data-analyst
 */
export function findNearestPosition(positionId: string): string | null {
  // 1. 精确匹配
  if (AVAILABLE_POSITIONS.includes(positionId)) {
    return positionId;
  }

  // 2. 映射表匹配
  const mapped = SKILL_CLUSTER_MAP[positionId];
  if (mapped) {
    console.warn(
      `[fallback] "${positionId}" mapped to "${mapped}" via skill cluster`
    );
    return mapped;
  }

  // 3. 模糊匹配（包含关系）
  for (const [key, value] of Object.entries(SKILL_CLUSTER_MAP)) {
    if (positionId.includes(key) || key.includes(positionId)) {
      console.warn(
        `[fallback] "${positionId}" fuzzy matched to "${value}" via "${key}"`
      );
      return value;
    }
  }

  // 4. 默认 fallback
  console.warn(
    `[fallback] No match for "${positionId}", defaulting to "data-analyst" (confidence=low)`
  );
  return "data-analyst";
}

/**
 * 判断一个岗位是否有对应的知识卡
 */
export function hasPositionCard(positionId: string): boolean {
  return AVAILABLE_POSITIONS.includes(positionId);
}

/**
 * 获取所有可用岗位
 */
export function getAvailablePositions(): string[] {
  return [...AVAILABLE_POSITIONS];
}
