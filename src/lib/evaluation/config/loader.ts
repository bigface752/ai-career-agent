/**
 * BARS 权重配置加载器
 *
 * 从 weights.json 加载权重配置，支持按岗位差异化
 * 缓存配置避免重复读取
 */

import weightsData from './weights.json';

// ============================================================
// 类型定义
// ============================================================

/** 权重配置结构 */
export interface WeightsConfig {
  meta: {
    schema_version: string;
    last_updated: string;
    description: string;
  };
  default: {
    agent_weights: Record<string, number>;
    dimension_weights: Record<string, Record<string, number>>;
  };
  positions: Record<string, {
    agent_weights?: Record<string, number>;
    dimension_weights?: Record<string, Record<string, number>>;
  }>;
}

// ============================================================
// 配置缓存
// ============================================================

/** 缓存的配置 */
let cachedConfig: WeightsConfig | null = null;

/**
 * 获取权重配置（带缓存）
 */
export function getWeightsConfig(): WeightsConfig {
  if (!cachedConfig) {
    cachedConfig = weightsData as WeightsConfig;
  }
  return cachedConfig;
}

// ============================================================
// Agent 间权重
// ============================================================

/**
 * 获取 Agent 间权重
 *
 * @param positionId 岗位 ID（可选）
 * @returns Agent 间权重配置
 */
export function getAgentWeights(positionId?: string): Record<string, number> {
  const config = getWeightsConfig();

  // 如果有岗位特定配置，合并到默认配置上
  if (positionId && config.positions[positionId]?.agent_weights) {
    return {
      ...config.default.agent_weights,
      ...config.positions[positionId].agent_weights,
    };
  }

  return config.default.agent_weights;
}

// ============================================================
// Agent 内维度权重
// ============================================================

/**
 * 获取指定 Agent 的维度权重
 *
 * @param agentId Agent ID
 * @param positionId 岗位 ID（可选）
 * @returns 维度权重配置
 */
export function getDimensionWeights(
  agentId: string,
  positionId?: string
): Record<string, number> {
  const config = getWeightsConfig();

  // 默认维度权重
  const defaultWeights = config.default.dimension_weights[agentId];
  if (!defaultWeights) {
    throw new Error(`Unknown agent ID: ${agentId}`);
  }

  // 如果有岗位特定配置，合并到默认配置上
  if (positionId && config.positions[positionId]?.dimension_weights?.[agentId]) {
    return {
      ...defaultWeights,
      ...config.positions[positionId].dimension_weights[agentId],
    };
  }

  return defaultWeights;
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 验证权重配置
 *
 * 检查所有权重是否在合理范围内（0-1，且总和接近 1）
 */
export function validateWeightsConfig(): { valid: boolean; errors: string[] } {
  const config = getWeightsConfig();
  const errors: string[] = [];

  // 验证 Agent 间权重
  const agentWeights = Object.values(config.default.agent_weights);
  const agentSum = agentWeights.reduce((a, b) => a + b, 0);
  if (Math.abs(agentSum - 1) > 0.01) {
    errors.push(`Default agent weights sum to ${agentSum.toFixed(3)}, expected ~1.0`);
  }

  // 验证各 Agent 的维度权重
  for (const [agentId, dimWeights] of Object.entries(config.default.dimension_weights)) {
    const dimValues = Object.values(dimWeights);
    const dimSum = dimValues.reduce((a, b) => a + b, 0);
    if (Math.abs(dimSum - 1) > 0.01) {
      errors.push(`Default dimension weights for ${agentId} sum to ${dimSum.toFixed(3)}, expected ~1.0`);
    }

    // 验证单个权重范围
    for (const [dimName, weight] of Object.entries(dimWeights)) {
      if (weight < 0 || weight > 1) {
        errors.push(`Weight for ${agentId}.${dimName} is ${weight}, expected 0-1`);
      }
    }
  }

  // 验证岗位覆盖配置
  for (const [positionId, positionConfig] of Object.entries(config.positions)) {
    if (positionConfig.agent_weights) {
      const posAgentValues = Object.values(positionConfig.agent_weights);
      const posAgentSum = posAgentValues.reduce((a, b) => a + b, 0);
      if (Math.abs(posAgentSum - 1) > 0.01) {
        errors.push(`Position "${positionId}" agent weights sum to ${posAgentSum.toFixed(3)}, expected ~1.0`);
      }
    }

    if (positionConfig.dimension_weights) {
      for (const [agentId, dimWeights] of Object.entries(positionConfig.dimension_weights)) {
        const dimValues = Object.values(dimWeights);
        const dimSum = dimValues.reduce((a, b) => a + b, 0);
        if (Math.abs(dimSum - 1) > 0.01) {
          errors.push(`Position "${positionId}" dimension weights for ${agentId} sum to ${dimSum.toFixed(3)}, expected ~1.0`);
        }

        for (const [dimName, weight] of Object.entries(dimWeights)) {
          if (weight < 0 || weight > 1) {
            errors.push(`Position "${positionId}" weight for ${agentId}.${dimName} is ${weight}, expected 0-1`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 清除配置缓存（用于测试）
 */
export function clearWeightsCache(): void {
  cachedConfig = null;
}
