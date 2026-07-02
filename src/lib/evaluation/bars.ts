/**
 * BARS Rubric 定义
 *
 * Behaviorally Anchored Rating Scale（行为锚定评分法）
 * 基于 agents/*.md 中的 BARS 锚定描述提取
 *
 * 每个 Agent 有独立的维度 + 权重 + 锚定描述
 *
 * 权重配置化：从 config/weights.json 加载，支持按岗位差异化
 */

import { getAgentWeights, getDimensionWeights } from './config/loader';

// ============================================================
// 类型定义
// ============================================================

/** BARS 锚定描述 */
export interface BarsAnchor {
  score: 1 | 2 | 3 | 4 | 5;
  label: "弱" | "中弱" | "中" | "中强" | "强";
  description: string;
}

/** BARS 维度定义 */
export interface BarsDimension {
  name: string;
  weight: number;
  description: string;
  anchors: [BarsAnchor, BarsAnchor, BarsAnchor]; // 1分/3分/5分
}

/** Agent 的 BARS Rubric */
export interface BarsRubric {
  agent_id: string;
  agent_name: string;
  dimensions: BarsDimension[];
}

// ============================================================
// 市场对标 Agent BARS Rubric（锚定描述）
// ============================================================

const MARKET_BENCHMARK_ANCHORS: Omit<BarsDimension, 'weight'>[] = [
  {
    name: "技能匹配度",
    description: "用户技能与目标岗位的匹配程度",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "大部分技能不匹配目标岗位",
      },
      {
        score: 3,
        label: "中",
        description: "基本匹配，缺少 1-2 项关键技能",
      },
      {
        score: 5,
        label: "强",
        description: "核心技能与目标岗位高度匹配，有稀缺技能组合",
      },
    ],
  },
  {
    name: "经验深度",
    description: "用户在该岗位/行业的经验质量",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "经验不足或跨度大，无代表性项目",
      },
      {
        score: 3,
        label: "中",
        description: "3-5年经验，有项目但质量一般",
      },
      {
        score: 5,
        label: "强",
        description: "5年+同岗位经验，有代表性项目和量化成果",
      },
    ],
  },
  {
    name: "行业稀缺性",
    description: "用户在该行业的稀缺程度",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "供给过剩，竞争激烈",
      },
      {
        score: 3,
        label: "中",
        description: "供给适中，竞争正常",
      },
      {
        score: 5,
        label: "强",
        description: "该技能组合在市场上极少，供不应求",
      },
    ],
  },
  {
    name: "简历表达力",
    description: "简历的表达质量和专业度",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "无量化，描述模糊，逻辑不清",
      },
      {
        score: 3,
        label: "中",
        description: "有成就但表达一般，缺少量化",
      },
      {
        score: 5,
        label: "强",
        description: "STAR 法则，量化成果，清晰叙事",
      },
    ],
  },
  {
    name: "市场需求度",
    description: "该岗位在市场上的需求程度",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "需求下降，岗位萎缩",
      },
      {
        score: 3,
        label: "中",
        description: "需求稳定，无明显变化",
      },
      {
        score: 5,
        label: "强",
        description: "目标岗位需求增长，薪资上涨",
      },
    ],
  },
];

// ============================================================
// 猎头 Agent BARS Rubric（锚定描述）
// ============================================================

const HEADHUNTER_ANCHORS: Omit<BarsDimension, 'weight'>[] = [
  {
    name: "市场稀缺性",
    description: "用户的岗位+技能+行业组合在市场上有多少人",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "供给过剩，同质化竞争激烈",
      },
      {
        score: 3,
        label: "中",
        description: "有一定稀缺性，但非不可替代",
      },
      {
        score: 5,
        label: "强",
        description: "组合技能极稀缺，市场上几乎找不到同类人才",
      },
    ],
  },
  {
    name: "薪资竞争力",
    description: "用户的薪资在市场同岗位中处于什么位置",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "薪资低于 P25，跳槽可能降薪",
      },
      {
        score: 3,
        label: "中",
        description: "薪资处于 P50 附近，跳槽涨薪空间有限",
      },
      {
        score: 5,
        label: "强",
        description: "薪资高于市场 P75，跳槽有 30%+ 涨薪空间",
      },
    ],
  },
  {
    name: "简历竞争力",
    description: "和同岗位候选人比，用户的简历能排第几",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "经历薄弱，无量化，无差异化",
      },
      {
        score: 3,
        label: "中",
        description: "经历完整但无突出亮点",
      },
      {
        score: 5,
        label: "强",
        description: "有大厂/知名项目背书，量化成果突出",
      },
    ],
  },
  {
    name: "可迁移性",
    description: "用户的技能和经验能不能跨行业/跨岗位迁移",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "技能高度垂直，迁移困难",
      },
      {
        score: 3,
        label: "中",
        description: "部分技能可迁移，需要补充学习",
      },
      {
        score: 5,
        label: "强",
        description: "核心技能跨行业通用，转型成本低",
      },
    ],
  },
  {
    name: "核心卖点",
    description: "用户最能打动 HR 的是什么",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "无差异化，和普通候选人无区别",
      },
      {
        score: 3,
        label: "中",
        description: "有一定亮点但不够突出",
      },
      {
        score: 5,
        label: "强",
        description: "有明确差异化定位，能用一句话打动 HR",
      },
    ],
  },
  {
    name: "跳槽时机",
    description: "现在跳槽时机好不好",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "行业低迷或个人准备不足",
      },
      {
        score: 3,
        label: "中",
        description: "市场平稳，时机一般",
      },
      {
        score: 5,
        label: "强",
        description: "行业景气+个人准备充分+市场供不应求",
      },
    ],
  },
];

// ============================================================
// 职业导师 Agent BARS Rubric（锚定描述）
// ============================================================

const CAREER_MENTOR_ANCHORS: Omit<BarsDimension, 'weight'>[] = [
  {
    name: "天花板距离",
    description: "用户目前距职业天花板的距离",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "接近天花板，晋升路径不清晰",
      },
      {
        score: 3,
        label: "中",
        description: "中等距离，需要突破 1-2 个瓶颈",
      },
      {
        score: 5,
        label: "强",
        description: "距天花板远，上升空间大，3年内有明确晋升路径",
      },
    ],
  },
  {
    name: "卡点数量",
    description: "阻碍用户职业发展的卡点数量",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "4+个卡点，短期内难以突破",
      },
      {
        score: 3,
        label: "中",
        description: "2-3个卡点，需要系统性解决",
      },
      {
        score: 5,
        label: "强",
        description: "0-1个卡点，可快速突破",
      },
    ],
  },
  {
    name: "突破可行性",
    description: "突破当前瓶颈的可行性",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "路径不清晰或需要重大转型",
      },
      {
        score: 3,
        label: "中",
        description: "路径存在但需要 1-2 年",
      },
      {
        score: 5,
        label: "强",
        description: "有明确路径，3-6个月可见效",
      },
    ],
  },
  {
    name: "职业锚匹配",
    description: "当前方向与职业锚的一致性",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "严重不匹配，方向需要重新思考",
      },
      {
        score: 3,
        label: "中",
        description: "部分匹配，需要调整",
      },
      {
        score: 5,
        label: "强",
        description: "当前方向与职业锚高度一致",
      },
    ],
  },
];

// ============================================================
// AI 效能专家 Agent BARS Rubric（锚定描述）
// ============================================================

const AI_EXPERT_ANCHORS: Omit<BarsDimension, 'weight'>[] = [
  {
    name: "AI替代风险",
    description: "用户的哪些工作正在被 AI 替代",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "核心工作内容大部分可被 AI 替代",
      },
      {
        score: 3,
        label: "中",
        description: "部分工作可被替代，但核心价值仍在",
      },
      {
        score: 5,
        label: "强",
        description: "AI 无法替代，反而增强了岗位价值",
      },
    ],
  },
  {
    name: "AI增效机会",
    description: "AI 可以提升用户哪些效率",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "AI 增效机会有限，岗位对 AI 不敏感",
      },
      {
        score: 3,
        label: "中",
        description: "有明确的 AI 增效场景，但需要学习",
      },
      {
        score: 5,
        label: "强",
        description: "AI 可大幅提升效率，已有明确工具和路径",
      },
    ],
  },
  {
    name: "技能缺口",
    description: "用户需要学习哪些 AI 技能",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "AI 技能缺口大，需要系统性学习",
      },
      {
        score: 3,
        label: "中",
        description: "有 1-2 个关键技能缺口，可快速补齐",
      },
      {
        score: 5,
        label: "强",
        description: "AI 技能储备充足，无明显缺口",
      },
    ],
  },
];

// ============================================================
// 心理学家 Agent BARS Rubric（锚定描述）
// ============================================================

const PSYCHOLOGIST_ANCHORS: Omit<BarsDimension, 'weight'>[] = [
  {
    name: "适应力",
    description: "面对职业变化的适应能力",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "抗拒变化，难以适应新环境",
      },
      {
        score: 3,
        label: "中",
        description: "能适应变化，但需要时间",
      },
      {
        score: 5,
        label: "强",
        description: "主动拥抱变化，适应能力强",
      },
    ],
  },
  {
    name: "信心水平",
    description: "面对职业挑战的信心",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "缺乏信心，回避挑战",
      },
      {
        score: 3,
        label: "中",
        description: "有一定信心，但面对困难容易动摇",
      },
      {
        score: 5,
        label: "强",
        description: "信心充足，敢于面对挑战",
      },
    ],
  },
  {
    name: "焦虑管理",
    description: "管理职业焦虑的能力",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "焦虑严重，影响决策和行动",
      },
      {
        score: 3,
        label: "中",
        description: "有焦虑但能管理，不影响正常行动",
      },
      {
        score: 5,
        label: "强",
        description: "焦虑在可控范围内，转化为行动力",
      },
    ],
  },
  {
    name: "行动力",
    description: "将想法转化为行动的能力",
    anchors: [
      {
        score: 1,
        label: "弱",
        description: "想法多但行动少，拖延严重",
      },
      {
        score: 3,
        label: "中",
        description: "能执行计划，但缺乏持续性",
      },
      {
        score: 5,
        label: "强",
        description: "行动力强，能持续执行并看到结果",
      },
    ],
  },
];

// ============================================================
// 构建 Rubric 的辅助函数
// ============================================================

/**
 * 构建指定 Agent 的完整 BARS Rubric
 *
 * @param agentId Agent ID
 * @param positionId 岗位 ID（可选，用于加载差异化权重）
 * @returns 完整的 BarsRubric 对象
 */
export function buildBarsRubric(agentId: string, positionId?: string): BarsRubric {
  // Agent 名称映射
  const agentNames: Record<string, string> = {
    market_benchmark: "市场对标",
    headhunter: "猎头",
    career_mentor: "职业导师",
    ai_expert: "AI效能专家",
    psychologist: "心理学家",
  };

  // 锚定描述映射
  const anchorsMap: Record<string, Omit<BarsDimension, 'weight'>[]> = {
    market_benchmark: MARKET_BENCHMARK_ANCHORS,
    headhunter: HEADHUNTER_ANCHORS,
    career_mentor: CAREER_MENTOR_ANCHORS,
    ai_expert: AI_EXPERT_ANCHORS,
    psychologist: PSYCHOLOGIST_ANCHORS,
  };

  const agentName = agentNames[agentId];
  const anchors = anchorsMap[agentId];

  if (!agentName || !anchors) {
    throw new Error(`Unknown agent ID: ${agentId}`);
  }

  // 获取维度权重配置
  const dimWeights = getDimensionWeights(agentId, positionId);

  // 合并锚定描述和权重（硬校验：维度名必须匹配）
  const dimensions: BarsDimension[] = anchors.map(anchor => {
    const weight = dimWeights[anchor.name];
    if (weight === undefined) {
      throw new Error(`Missing weight for dimension "${anchor.name}" in agent "${agentId}"`);
    }
    return { ...anchor, weight };
  });

  return {
    agent_id: agentId,
    agent_name: agentName,
    dimensions,
  };
}

/**
 * 获取所有 Agent 的 Rubric
 *
 * @param positionId 岗位 ID（可选）
 * @returns 所有 Agent 的 Rubric 索引
 */
export function getAllRubrics(positionId?: string): Record<string, BarsRubric> {
  const agentIds = ['market_benchmark', 'headhunter', 'career_mentor', 'ai_expert', 'psychologist'];
  const rubrics: Record<string, BarsRubric> = {};

  for (const agentId of agentIds) {
    rubrics[agentId] = buildBarsRubric(agentId, positionId);
  }

  return rubrics;
}

// ============================================================
// 定性映射阈值
// ============================================================

/**
 * 综合分 → 定性评级映射
 *
 * 基于 SPEC.md §11.3 Step 4
 */
export function mapScoreToRating(score: number): "强" | "中" | "弱" {
  if (score >= 0.75) return "强";
  if (score >= 0.45) return "中";
  return "弱";
}

// ============================================================
// Agent 间权重（用于整体评级聚合）
// ============================================================

/**
 * 获取 5 个 Agent 的整体权重
 *
 * 用于最终的跨 Agent 聚合
 *
 * @param positionId 岗位 ID（可选）
 * @returns Agent 间权重配置
 */
export function getAgentWeightsForAggregation(positionId?: string): Record<string, number> {
  return getAgentWeights(positionId);
}
