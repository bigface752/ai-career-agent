/**
 * 模块一：职业认知 - Slot 定义
 *
 * 基于 SPEC.md §3.5 引导式对话设计
 */

import { SlotDefinition } from '../types';

/**
 * 模块一必填 Slot 列表
 *
 * 维度分类：
 * - basic: 基础信息（从简历解析，通常已填充）
 * - motivation: 职业动机
 * - value: 价值排序
 * - risk: 风险偏好
 * - constraint: 生活约束
 * - goal: 发展诉求
 * - ability: 能力自评
 * - ai: AI 能力
 */
export const CAREER_COGNITION_SLOTS: SlotDefinition[] = [
  // ============================================================
  // 基础信息（通常从简历解析，不需要对话收集）
  // ============================================================
  {
    name: 'current_role',
    label: '当前职位',
    required: true,
    type: 'string',
    dimension: 'basic',
    default_question: '', // 从简历解析
  },
  {
    name: 'industry',
    label: '所在行业',
    required: true,
    type: 'string',
    dimension: 'basic',
    default_question: '', // 从简历解析
  },
  {
    name: 'years_of_experience',
    label: '工作年限',
    required: true,
    type: 'number',
    dimension: 'basic',
    default_question: '', // 从简历解析
  },
  {
    name: 'city',
    label: '所在城市',
    required: true,
    type: 'string',
    dimension: 'basic',
    default_question: '', // 从简历解析
  },

  // ============================================================
  // 职业动机（对话收集）
  // ============================================================
  {
    name: 'motivation',
    label: '跳槽动机',
    required: true,
    type: 'string',
    dimension: 'motivation',
    default_question: '让你最近开始考虑跳槽的直接原因是什么？',
  },

  // ============================================================
  // 价值排序（对话收集）
  // ============================================================
  {
    name: 'value_ranking',
    label: '价值排序',
    required: true,
    type: 'string[]',
    dimension: 'value',
    default_question: '薪资、成长空间、工作生活平衡，你怎么排？',
  },

  // ============================================================
  // 风险偏好（对话收集）
  // ============================================================
  {
    name: 'risk_tolerance',
    label: '风险承受度',
    required: true,
    type: 'string',
    dimension: 'risk',
    validate: (v) => typeof v === 'string' && ['低', '中', '高'].includes(v),
    default_question: '如果跳槽后3个月没找到合适工作，你的财务状况如何？',
  },

  // ============================================================
  // 生活约束（对话收集）
  // ============================================================
  {
    name: 'life_constraints',
    label: '生活约束',
    required: true,
    type: 'string',
    dimension: 'constraint',
    default_question: '家庭、城市、通勤，有什么不能动的？',
  },

  // ============================================================
  // 发展诉求（对话收集）
  // ============================================================
  {
    name: 'development_goal',
    label: '3年发展目标',
    required: true,
    type: 'string',
    dimension: 'goal',
    default_question: '3年后你想成为什么样的职业状态？',
  },

  // ============================================================
  // 能力自评（对话收集）
  // ============================================================
  {
    name: 'key_achievement',
    label: '最有成就感的项目',
    required: true,
    type: 'string',
    dimension: 'ability',
    default_question: '你做过的最有成就感的项目是什么？为什么？',
  },

  // ============================================================
  // AI 能力（对话收集）
  // ============================================================
  {
    name: 'ai_literacy',
    label: 'AI素养自评',
    required: false,
    type: 'string',
    dimension: 'ai',
    default_question: '你平时用AI工具吗？用过哪些？',
  },
  {
    name: 'ai_impact_perception',
    label: 'AI对岗位的影响认知',
    required: false,
    type: 'string',
    dimension: 'ai',
    default_question: '你觉得AI会怎么影响你的岗位？',
  },
  {
    name: 'ai_efficiency_usage',
    label: 'AI提效使用情况',
    required: false,
    type: 'string',
    dimension: 'ai',
    default_question: '你有没有用AI来提效？效果如何？',
  },
];

/**
 * 获取必填 Slot 列表
 */
export function getRequiredSlots(): SlotDefinition[] {
  return CAREER_COGNITION_SLOTS.filter((s) => s.required);
}

/**
 * 获取对话收集的 Slot（排除从简历解析的基础信息）
 */
export function getDialogueSlots(): SlotDefinition[] {
  return CAREER_COGNITION_SLOTS.filter((s) => s.dimension !== 'basic');
}

/**
 * 按维度获取 Slot
 */
export function getSlotsByDimension(dimension: string): SlotDefinition[] {
  return CAREER_COGNITION_SLOTS.filter((s) => s.dimension === dimension);
}

/**
 * Slot 名称到显示标签的映射
 */
export const SLOT_LABELS: Record<string, string> = Object.fromEntries(
  CAREER_COGNITION_SLOTS.map((s) => [s.name, s.label])
);

/**
 * 验证 Slot 值
 */
export function validateSlotValue(slotName: string, value: unknown): boolean {
  const slotDef = CAREER_COGNITION_SLOTS.find((s) => s.name === slotName);
  if (!slotDef) return false;

  // 类型检查
  switch (slotDef.type) {
    case 'string':
      if (typeof value !== 'string') return false;
      break;
    case 'number':
      if (typeof value !== 'number') return false;
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return false;
      break;
    case 'string[]':
      if (!Array.isArray(value)) return false;
      break;
  }

  // 自定义验证
  if (slotDef.validate && !slotDef.validate(value)) return false;

  return true;
}
