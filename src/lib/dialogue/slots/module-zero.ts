/**
 * 模块零：当前工作辅导 - Slot 定义
 *
 * 基于 module-0-career-coaching.md Step 2 设计
 * 5 个字段，3-5 轮对话快速收集
 */

import { SlotDefinition } from '../types';

/**
 * 模块零必填 Slot 列表
 *
 * 维度：work（当前工作信息）
 */
export const MODULE_ZERO_SLOTS: SlotDefinition[] = [
  {
    name: 'leader_style',
    label: '直属领导风格',
    required: true,
    type: 'string',
    dimension: 'work',
    default_question: '你目前的直属领导是什么风格？你们配合得怎么样？',
  },
  {
    name: 'team_size',
    label: '团队规模与管理职责',
    required: true,
    type: 'string',
    dimension: 'work',
    default_question: '你团队里有几个人？你带人吗？',
  },
  {
    name: 'pain_point',
    label: '最头疼的工作问题',
    required: true,
    type: 'string',
    dimension: 'work',
    default_question: '你最近半年最头疼的工作问题是什么？',
  },
  {
    name: 'biggest_bottleneck',
    label: '岗位最大瓶颈',
    required: true,
    type: 'string',
    dimension: 'work',
    default_question: '你觉得你在这个岗位上最大的瓶颈是什么？',
  },
  {
    name: 'unrealized_goal',
    label: '想争取但没争取到的',
    required: true,
    type: 'string',
    dimension: 'work',
    default_question: '你有没有想争取但没争取到的东西？比如晋升、加薪、转岗、新项目？',
  },
];

/**
 * 获取模块零必填 Slot 列表
 */
export function getModuleZeroRequiredSlots(): SlotDefinition[] {
  return MODULE_ZERO_SLOTS.filter((s) => s.required);
}
