/**
 * P0 测试：对话 Slot 状态管理
 *
 * 测试范围：
 * - createSlotState / parseSlotState / serializeSlotState（创建、序列化）
 * - fillSlot / fillSlots / markSlotUnconfirmed / removeSlot（Slot 操作）
 * - getSlotValue / isSlotFilled / hasSlot（Slot 查询）
 * - recordQuestion / isQuestionAsked / getQuestionCount（问题追踪）
 * - getPendingSlots / getCompletionRate（进度计算）
 * - getNextSlotToAsk / canFollowup（对话流程控制）
 * - addTurnToWindow / parseRecentWindow（滑动窗口）
 * - buildSlotPrompt / buildFindingsPrompt（Prompt 构建）
 */

import { describe, it, expect } from 'vitest';
import {
  createSlotState,
  parseSlotState,
  serializeSlotState,
  fillSlot,
  fillSlots,
  markSlotUnconfirmed,
  removeSlot,
  getSlotValue,
  isSlotFilled,
  hasSlot,
  recordQuestion,
  isQuestionAsked,
  getQuestionCount,
  getValidAnswerCount,
  getUsedQuestionVariants,
  updateLastQuestionQuality,
  addFinding,
  addFindings,
  shouldShowFindings,
  shouldPromptPortraitUpdate,
  getFilledSlotNames,
  getUnconfirmedSlotNames,
  getPendingSlots,
  getCompletionRate,
  setPhase,
  setCurrentFocus,
  getNextSlotToAsk,
  canFollowup,
  addTurnToWindow,
  parseRecentWindow,
  buildSlotPrompt,
  buildFindingsPrompt,
} from '@/lib/dialogue/slot-state';
import type { SlotDefinition, SlotState } from '@/lib/dialogue/types';

// ============================================================
// 测试用 Slot 定义
// ============================================================

const TEST_SLOTS: SlotDefinition[] = [
  { name: 'current_role', label: '当前职位', required: true, type: 'string', default_question: '你现在做什么工作？', dimension: 'basic' },
  { name: 'industry', label: '行业', required: true, type: 'string', default_question: '你在哪个行业？', dimension: 'basic' },
  { name: 'years', label: '工作年限', required: true, type: 'number', default_question: '你工作几年了？', dimension: 'basic' },
  { name: 'goal', label: '职业目标', required: true, type: 'string', default_question: '你的职业目标是什么？', dimension: 'goal' },
  { name: 'hobby', label: '兴趣爱好', required: false, type: 'string', default_question: '你有什么兴趣爱好？', dimension: 'custom' },
];

// ============================================================
// 创建和序列化
// ============================================================

describe('SlotState 创建和序列化', () => {
  it('createSlotState 应返回空状态', () => {
    const state = createSlotState();
    expect(state.filled).toEqual({});
    expect(state.asked).toEqual([]);
    expect(state.current_focus).toBeNull();
    expect(state.phase).toBe('warmup');
  });

  it('serializeSlotState 应返回有效 JSON', () => {
    const state = createSlotState();
    const json = serializeSlotState(state);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('parseSlotState(null) 应返回新状态', () => {
    const state = parseSlotState(null);
    expect(state.filled).toEqual({});
  });

  it('parseSlotState(无效JSON) 应返回新状态', () => {
    const state = parseSlotState('not-json');
    expect(state.filled).toEqual({});
  });

  it('round-trip: create → serialize → parse 应保持一致', () => {
    const original = createSlotState();
    const json = serializeSlotState(original);
    const parsed = parseSlotState(json);
    expect(parsed.schema_version).toBe(original.schema_version);
    expect(parsed.phase).toBe(original.phase);
  });

  it('parseSlotState 应兼容旧版本（向前兼容）', () => {
    const oldState = {
      filled: { current_role: { value: '工程师', confidence: 'high', turn: 1, confirmed: true } },
      asked: [],
      current_focus: null,
      phase: 'warmup',
      // 缺少 schema_version
    };
    const parsed = parseSlotState(JSON.stringify(oldState));
    expect(parsed.filled.current_role?.value).toBe('工程师');
  });
});

// ============================================================
// Slot 操作
// ============================================================

describe('fillSlot', () => {
  it('应填充新 Slot', () => {
    const state = createSlotState();
    const filled = fillSlot(state, 'current_role', '产品经理', 'high', 1);
    expect(filled.filled.current_role?.value).toBe('产品经理');
    expect(filled.filled.current_role?.confirmed).toBe(true);
  });

  it('不应修改原状态（不可变性）', () => {
    const state = createSlotState();
    const filled = fillSlot(state, 'current_role', '产品经理', 'high', 1);
    // 原状态不应被污染
    expect(state.filled.current_role).toBeUndefined();
    expect(filled.filled.current_role?.value).toBe('产品经理');
  });

  it('已确认且值相同应跳过（返回原引用）', () => {
    const state = fillSlot(createSlotState(), 'current_role', '产品经理', 'high', 1);
    const result = fillSlot(state, 'current_role', '产品经理', 'high', 2);
    expect(result).toBe(state); // 同一引用
  });

  it('已确认但值不同应标记为未确认', () => {
    const state = fillSlot(createSlotState(), 'current_role', '产品经理', 'high', 1);
    const result = fillSlot(state, 'current_role', '数据分析师', 'high', 2);
    expect(result.filled.current_role?.confirmed).toBe(false);
  });

  it('未确认 Slot 应直接覆盖', () => {
    let state = fillSlot(createSlotState(), 'current_role', '产品经理', 'high', 1);
    state = markSlotUnconfirmed(state, 'current_role');
    const result = fillSlot(state, 'current_role', '数据分析师', 'high', 2);
    expect(result.filled.current_role?.value).toBe('数据分析师');
    expect(result.filled.current_role?.confirmed).toBe(true);
  });

  it('confirmed=false 应填充为未确认', () => {
    const state = fillSlot(createSlotState(), 'current_role', '产品经理', 'medium', 1, false);
    expect(state.filled.current_role?.confirmed).toBe(false);
  });
});

describe('fillSlots', () => {
  it('应批量填充多个 Slot', () => {
    const state = fillSlots(createSlotState(), {
      current_role: { value: '产品经理', confidence: 'high' },
      industry: { value: '互联网', confidence: 'high' },
    }, 1);
    expect(state.filled.current_role?.value).toBe('产品经理');
    expect(state.filled.industry?.value).toBe('互联网');
  });
});

describe('markSlotUnconfirmed', () => {
  it('应将已确认 Slot 标记为未确认', () => {
    const state = fillSlot(createSlotState(), 'current_role', '产品经理', 'high', 1);
    const result = markSlotUnconfirmed(state, 'current_role');
    expect(result.filled.current_role?.confirmed).toBe(false);
  });

  it('不存在的 Slot 应返回原状态', () => {
    const state = createSlotState();
    const result = markSlotUnconfirmed(state, 'nonexistent');
    expect(result).toBe(state);
  });
});

describe('removeSlot', () => {
  it('应删除指定 Slot', () => {
    const state = fillSlot(createSlotState(), 'current_role', '产品经理', 'high', 1);
    const result = removeSlot(state, 'current_role');
    expect(result.filled.current_role).toBeUndefined();
  });

  it('删除不存在的 Slot 应无副作用', () => {
    const state = createSlotState();
    const result = removeSlot(state, 'nonexistent');
    expect(result.filled).toEqual({});
  });
});

// ============================================================
// Slot 查询
// ============================================================

describe('getSlotValue', () => {
  it('已确认 Slot 应返回值', () => {
    const state = fillSlot(createSlotState(), 'current_role', '产品经理', 'high', 1);
    expect(getSlotValue(state, 'current_role')).toBe('产品经理');
  });

  it('未确认 Slot 应返回 null', () => {
    const state = fillSlot(createSlotState(), 'current_role', '产品经理', 'high', 1, false);
    expect(getSlotValue(state, 'current_role')).toBeNull();
  });

  it('不存在的 Slot 应返回 null', () => {
    expect(getSlotValue(createSlotState(), 'nonexistent')).toBeNull();
  });
});

describe('isSlotFilled', () => {
  it('已确认 Slot 应返回 true', () => {
    const state = fillSlot(createSlotState(), 'current_role', '产品经理', 'high', 1);
    expect(isSlotFilled(state, 'current_role')).toBe(true);
  });

  it('未确认 Slot 应返回 false', () => {
    const state = fillSlot(createSlotState(), 'current_role', '产品经理', 'high', 1, false);
    expect(isSlotFilled(state, 'current_role')).toBe(false);
  });
});

describe('hasSlot', () => {
  it('已确认 Slot 应返回 true', () => {
    const state = fillSlot(createSlotState(), 'current_role', '产品经理', 'high', 1);
    expect(hasSlot(state, 'current_role')).toBe(true);
  });

  it('未确认 Slot 应返回 true（存在但未确认）', () => {
    const state = fillSlot(createSlotState(), 'current_role', '产品经理', 'high', 1, false);
    expect(hasSlot(state, 'current_role')).toBe(true);
  });

  it('不存在的 Slot 应返回 false', () => {
    expect(hasSlot(createSlotState(), 'nonexistent')).toBe(false);
  });
});

// ============================================================
// 问题追踪
// ============================================================

describe('recordQuestion', () => {
  it('应记录问题', () => {
    const state = recordQuestion(createSlotState(), 'current_role', '你做什么工作？', 1);
    expect(state.asked).toHaveLength(1);
    expect(state.asked[0].slot).toBe('current_role');
    expect(state.asked[0].question).toBe('你做什么工作？');
  });

  it('应记录 answer_quality', () => {
    const state = recordQuestion(createSlotState(), 'current_role', '你做什么工作？', 1, 'valid');
    expect(state.asked[0].answer_quality).toBe('valid');
  });

  it('应保留 question_variants', () => {
    let state = recordQuestion(createSlotState(), 'current_role', '问题1', 1);
    state = recordQuestion(state, 'current_role', '问题2', 2);
    expect(state.asked[1].question_variants).toContain('问题1');
    expect(state.asked[1].question_variants).toContain('问题2');
  });
});

describe('isQuestionAsked', () => {
  it('已问过应返回 true', () => {
    const state = recordQuestion(createSlotState(), 'current_role', '问题？', 1);
    expect(isQuestionAsked(state, 'current_role')).toBe(true);
  });

  it('未问过应返回 false', () => {
    expect(isQuestionAsked(createSlotState(), 'current_role')).toBe(false);
  });
});

describe('getQuestionCount', () => {
  it('应返回提问次数', () => {
    let state = recordQuestion(createSlotState(), 'current_role', '问题1', 1);
    state = recordQuestion(state, 'current_role', '问题2', 2);
    expect(getQuestionCount(state, 'current_role')).toBe(2);
  });

  it('不同 Slot 应独立计数', () => {
    let state = recordQuestion(createSlotState(), 'current_role', '问题1', 1);
    state = recordQuestion(state, 'industry', '问题2', 2);
    expect(getQuestionCount(state, 'current_role')).toBe(1);
    expect(getQuestionCount(state, 'industry')).toBe(1);
  });
});

describe('getValidAnswerCount', () => {
  it('应只计算有效回答', () => {
    let state = recordQuestion(createSlotState(), 'current_role', '问题1', 1, 'valid');
    state = recordQuestion(state, 'current_role', '问题2', 2, 'vague');
    state = recordQuestion(state, 'current_role', '问题3', 3, 'valid');
    expect(getValidAnswerCount(state, 'current_role')).toBe(2);
  });
});

describe('updateLastQuestionQuality', () => {
  it('应更新最后一个问题的质量', () => {
    let state = recordQuestion(createSlotState(), 'current_role', '问题？', 1);
    state = updateLastQuestionQuality(state, 'valid');
    expect(state.asked[0].answer_quality).toBe('valid');
  });

  it('空 asked 应返回原状态', () => {
    const state = updateLastQuestionQuality(createSlotState(), 'valid');
    expect(state.asked).toHaveLength(0);
  });
});

describe('getUsedQuestionVariants', () => {
  it('空状态应返回空数组', () => {
    expect(getUsedQuestionVariants(createSlotState(), 'current_role')).toEqual([]);
  });

  it('应返回最后一条记录的 question_variants', () => {
    let state = recordQuestion(createSlotState(), 'current_role', '问题1', 1);
    state = recordQuestion(state, 'current_role', '问题2', 2);
    const variants = getUsedQuestionVariants(state, 'current_role');
    expect(variants).toContain('问题1');
    expect(variants).toContain('问题2');
  });

  it('不同 Slot 应独立返回', () => {
    let state = recordQuestion(createSlotState(), 'current_role', 'CR问题', 1);
    state = recordQuestion(state, 'industry', 'IND问题', 2);
    expect(getUsedQuestionVariants(state, 'current_role')).toEqual(['CR问题']);
    expect(getUsedQuestionVariants(state, 'industry')).toEqual(['IND问题']);
  });
});

// ============================================================
// 初步发现
// ============================================================

describe('initial findings', () => {
  it('addFinding 应追加发现', () => {
    const findings = addFinding([], '发现1');
    expect(findings).toEqual(['发现1']);
  });

  it('addFindings 应批量追加', () => {
    const findings = addFindings(['发现1'], ['发现2', '发现3']);
    expect(findings).toEqual(['发现1', '发现2', '发现3']);
  });

  it('shouldShowFindings: 第4轮后应显示', () => {
    expect(shouldShowFindings(3)).toBe(false);
    expect(shouldShowFindings(4)).toBe(true);
    expect(shouldShowFindings(5)).toBe(true);
  });

  it('shouldPromptPortraitUpdate: 每10轮提示', () => {
    expect(shouldPromptPortraitUpdate(0)).toBe(false);
    expect(shouldPromptPortraitUpdate(10)).toBe(true);
    expect(shouldPromptPortraitUpdate(20)).toBe(true);
    expect(shouldPromptPortraitUpdate(15)).toBe(false);
  });
});

// ============================================================
// 进度计算
// ============================================================

describe('getPendingSlots', () => {
  it('应返回未填充的必填 Slot', () => {
    const state = fillSlot(createSlotState(), 'current_role', '产品经理', 'high', 1);
    const pending = getPendingSlots(state, TEST_SLOTS);
    expect(pending).toContain('industry');
    expect(pending).toContain('years');
    expect(pending).toContain('goal');
    expect(pending).not.toContain('current_role');
    expect(pending).not.toContain('hobby'); // 非必填
  });
});

describe('getCompletionRate', () => {
  it('空状态应返回 0', () => {
    expect(getCompletionRate(createSlotState(), TEST_SLOTS)).toBe(0);
  });

  it('全部填充应返回 1', () => {
    let state = createSlotState();
    state = fillSlot(state, 'current_role', 'PM', 'high', 1);
    state = fillSlot(state, 'industry', '互联网', 'high', 1);
    state = fillSlot(state, 'years', '5', 'high', 1);
    state = fillSlot(state, 'goal', '成长', 'high', 1);
    expect(getCompletionRate(state, TEST_SLOTS)).toBe(1);
  });

  it('部分填充应返回正确比例', () => {
    const state = fillSlot(createSlotState(), 'current_role', 'PM', 'high', 1);
    expect(getCompletionRate(state, TEST_SLOTS)).toBe(0.25); // 1/4
  });
});

describe('getFilledSlotNames / getUnconfirmedSlotNames', () => {
  it('应正确分类', () => {
    let state = fillSlot(createSlotState(), 'current_role', 'PM', 'high', 1);
    state = fillSlot(state, 'industry', '互联网', 'high', 1, false);
    expect(getFilledSlotNames(state)).toEqual(['current_role']);
    expect(getUnconfirmedSlotNames(state)).toEqual(['industry']);
  });
});

// ============================================================
// 对话流程控制
// ============================================================

describe('getNextSlotToAsk', () => {
  it('空状态应返回第一个必填 Slot', () => {
    const next = getNextSlotToAsk(createSlotState(), TEST_SLOTS);
    expect(next?.name).toBe('current_role');
  });

  it('已填充的 Slot 应跳过', () => {
    const state = fillSlot(createSlotState(), 'current_role', 'PM', 'high', 1);
    const next = getNextSlotToAsk(state, TEST_SLOTS);
    expect(next?.name).toBe('industry');
  });

  it('全部填充应返回 null', () => {
    let state = createSlotState();
    state = fillSlot(state, 'current_role', 'PM', 'high', 1);
    state = fillSlot(state, 'industry', '互联网', 'high', 1);
    state = fillSlot(state, 'years', '5', 'high', 1);
    state = fillSlot(state, 'goal', '成长', 'high', 1);
    expect(getNextSlotToAsk(state, TEST_SLOTS)).toBeNull();
  });

  it('未确认 Slot 应优先返回', () => {
    let state = fillSlot(createSlotState(), 'current_role', 'PM', 'high', 1);
    state = markSlotUnconfirmed(state, 'current_role');
    const next = getNextSlotToAsk(state, TEST_SLOTS);
    expect(next?.name).toBe('current_role');
  });
});

describe('canFollowup', () => {
  it('未达追问上限应返回 true', () => {
    const state = recordQuestion(createSlotState(), 'current_role', '问题？', 1);
    expect(canFollowup(state, 'current_role')).toBe(true);
  });

  it('未问过应返回 true', () => {
    expect(canFollowup(createSlotState(), 'current_role')).toBe(true);
  });
});

// ============================================================
// 滑动窗口
// ============================================================

describe('addTurnToWindow', () => {
  it('应添加轮次', () => {
    const window = addTurnToWindow([], { role: 'user', content: '你好', turn: 1 });
    expect(window).toHaveLength(1);
  });

  it('超过窗口大小应截断到 RECENT_WINDOW_SIZE', () => {
    let window: Array<{ role: 'user' | 'assistant'; content: string; turn: number }> = [];
    for (let i = 0; i < 10; i++) {
      window = addTurnToWindow(window, { role: 'user', content: `消息${i}`, turn: i + 1 });
    }
    // RECENT_WINDOW_SIZE = 3，应只保留最近 3 轮
    expect(window).toHaveLength(3);
    expect(window[0].content).toBe('消息7');
    expect(window[2].content).toBe('消息9');
  });
});

describe('parseRecentWindow', () => {
  it('null 应返回空数组', () => {
    expect(parseRecentWindow(null)).toEqual([]);
  });

  it('无效 JSON 应返回空数组', () => {
    expect(parseRecentWindow('not-json')).toEqual([]);
  });

  it('有效 JSON 应返回解析结果', () => {
    const turns = [{ role: 'user', content: '你好' }];
    expect(parseRecentWindow(JSON.stringify(turns))).toEqual(turns);
  });
});

// ============================================================
// Prompt 构建
// ============================================================

describe('buildSlotPrompt', () => {
  it('空状态应返回提示', () => {
    expect(buildSlotPrompt(createSlotState())).toContain('暂无');
  });

  it('有已确认 Slot 应列出', () => {
    const state = fillSlot(createSlotState(), 'current_role', '产品经理', 'high', 1);
    const prompt = buildSlotPrompt(state);
    expect(prompt).toContain('current_role');
    expect(prompt).toContain('产品经理');
  });

  it('有维度定义时应按维度分组', () => {
    const state = fillSlot(createSlotState(), 'current_role', 'PM', 'high', 1);
    const prompt = buildSlotPrompt(state, TEST_SLOTS);
    expect(prompt).toContain('基础信息');
  });
});

describe('buildFindingsPrompt', () => {
  it('空发现应返回空字符串', () => {
    expect(buildFindingsPrompt([])).toBe('');
  });

  it('有发现应编号列出', () => {
    const prompt = buildFindingsPrompt(['发现1', '发现2']);
    expect(prompt).toContain('1. 发现1');
    expect(prompt).toContain('2. 发现2');
  });
});

// ============================================================
// 阶段管理
// ============================================================

describe('setPhase / setCurrentFocus', () => {
  it('setPhase 应更新阶段', () => {
    const state = setPhase(createSlotState(), 'deep_dive');
    expect(state.phase).toBe('deep_dive');
  });

  it('setCurrentFocus 应更新聚焦', () => {
    const state = setCurrentFocus(createSlotState(), 'current_role');
    expect(state.current_focus).toBe('current_role');
  });
});
