/**
 * Slot State Management
 *
 * 提供 SlotState 的创建、更新、查询、序列化功能
 *
 * 修复记录（对抗式审查后）：
 * - C-1: fillSlot 检查已确认值，不覆盖用户明确确认的信息
 * - M-1: 增加 question_variants 支持"换方式提问"
 * - M-2: 增加 initial_findings 管理函数
 * - M-3: 实现向前兼容版本迁移
 * - M-4: asked 数组清理机制（只保留每个 slot 最近 N 条）
 * - m-2: getNextSlotToAsk 使用 MAX_FOLLOWUP_COUNT
 */

import {
  SlotState,
  AskedQuestion,
  SlotDefinition,
  DialoguePhase,
  DialogueTurn,
  SLOT_STATE_SCHEMA_VERSION,
  RECENT_WINDOW_SIZE,
  MAX_FOLLOWUP_COUNT,
} from './types';

// ============================================================
// 常量
// ============================================================

/** 每个 slot 最多保留的提问记录数 */
const MAX_ASKED_PER_SLOT = 5;

// ============================================================
// 创建和初始化
// ============================================================

/**
 * 创建空的 SlotState
 */
export function createSlotState(): SlotState {
  return {
    schema_version: SLOT_STATE_SCHEMA_VERSION,
    filled: {},
    asked: [],
    current_focus: null,
    phase: 'warmup',
  };
}

/**
 * 从 JSON 字符串解析 SlotState
 * 返回解析失败时返回新的空状态
 *
 * M-3 修复：向前兼容策略
 * - 版本相同：直接返回
 * - 版本不同但结构兼容：补充缺失字段默认值
 * - 结构不兼容：返回新状态（最后手段）
 */
export function parseSlotState(json: string | null): SlotState {
  if (!json) return createSlotState();

  try {
    const parsed = JSON.parse(json);

    // 版本相同，直接返回
    if (parsed.schema_version === SLOT_STATE_SCHEMA_VERSION) {
      return parsed as SlotState;
    }

    // 向前兼容：补充缺失字段默认值
    return migrateSlotState(parsed);
  } catch {
    return createSlotState();
  }
}

/**
 * 版本迁移函数
 *
 * M-3 修复：向前兼容而非丢弃数据
 */
function migrateSlotState(old: Record<string, unknown>): SlotState {
  const migrated: SlotState = {
    schema_version: SLOT_STATE_SCHEMA_VERSION,
    // 保留已有的 filled 数据
    filled: (old.filled as SlotState['filled']) || {},
    // 迁移 asked：补充缺失的 question_variants
    asked: Array.isArray(old.asked)
      ? old.asked.map((q: Record<string, unknown>) => ({
          slot: (q.slot as string) || '',
          question: (q.question as string) || '',
          question_variants: (q.question_variants as string[]) || [(q.question as string) || ''],
          turn: (q.turn as number) || 0,
          answer_quality: (q.answer_quality as AskedQuestion['answer_quality']) || 'unanswered',
        }))
      : [],
    current_focus: (old.current_focus as string) || null,
    phase: (old.phase as SlotState['phase']) || 'warmup',
  };

  return migrated;
}

/**
 * 序列化 SlotState 为 JSON 字符串
 */
export function serializeSlotState(state: SlotState): string {
  return JSON.stringify(state);
}

// ============================================================
// Slot 操作（C-1 修复：增量提取，不覆盖已确认值）
// ============================================================

/**
 * 填充 Slot
 *
 * C-1 修复：增量提取原则
 * - 已确认且值相同：跳过
 * - 已确认但值不同：标记为待确认（改口场景）
 * - 未确认或不存在：直接填充
 *
 * @param state 当前状态
 * @param slotName Slot 名
 * @param value Slot 值
 * @param confidence 置信度
 * @param turn 当前轮次
 * @param confirmed 是否经过确认
 * @returns 更新后的状态（不修改原状态）
 */
export function fillSlot(
  state: SlotState,
  slotName: string,
  value: string | number | boolean | string[],
  confidence: 'high' | 'medium' | 'low',
  turn: number,
  confirmed: boolean = true
): SlotState {
  const existing = state.filled[slotName];

  // 已确认且值相同：跳过
  if (existing && existing.confirmed && existing.value === value) {
    return state;
  }

  // 已确认但值不同：标记为待确认（改口场景）
  if (existing && existing.confirmed && existing.value !== value) {
    return markSlotUnconfirmed(state, slotName);
  }

  // 未确认或不存在：直接填充
  return {
    ...state,
    filled: {
      ...state.filled,
      [slotName]: {
        value,
        confidence,
        turn,
        confirmed,
        updated_at: new Date().toISOString(),
      },
    },
  };
}

/**
 * 批量填充 Slot（增量提取结果）
 *
 * C-1 修复：遵循增量提取原则
 */
export function fillSlots(
  state: SlotState,
  slots: Record<string, { value: string | number | boolean | string[]; confidence: 'high' | 'medium' | 'low' }>,
  turn: number,
  confirmed: boolean = true
): SlotState {
  let newState = state;

  for (const [slotName, { value, confidence }] of Object.entries(slots)) {
    newState = fillSlot(newState, slotName, value, confidence, turn, confirmed);
  }

  return newState;
}

/**
 * 标记 Slot 为待确认（用户改口时）
 */
export function markSlotUnconfirmed(state: SlotState, slotName: string): SlotState {
  if (!state.filled[slotName]) return state;

  return {
    ...state,
    filled: {
      ...state.filled,
      [slotName]: {
        ...state.filled[slotName],
        confirmed: false,
        updated_at: new Date().toISOString(),
      },
    },
  };
}

/**
 * 删除 Slot
 */
export function removeSlot(state: SlotState, slotName: string): SlotState {
  const rest = Object.fromEntries(
    Object.entries(state.filled).filter(([key]) => key !== slotName)
  );
  return {
    ...state,
    filled: rest,
  };
}

/**
 * 获取 Slot 值
 */
export function getSlotValue(state: SlotState, slotName: string): string | number | boolean | string[] | null {
  const entry = state.filled[slotName];
  if (!entry || !entry.confirmed) return null;
  return entry.value;
}

/**
 * 检查 Slot 是否已填充且已确认
 */
export function isSlotFilled(state: SlotState, slotName: string): boolean {
  const entry = state.filled[slotName];
  return !!entry && entry.confirmed;
}

/**
 * 检查 Slot 是否存在（可能未确认）
 */
export function hasSlot(state: SlotState, slotName: string): boolean {
  return !!state.filled[slotName];
}

// ============================================================
// 问题追踪（M-1/M-4 修复）
// ============================================================

/**
 * 记录已问问题
 *
 * M-1 修复：记录 question_variants
 * M-4 修复：清理旧记录，每个 slot 最多保留 MAX_ASKED_PER_SLOT 条
 */
export function recordQuestion(
  state: SlotState,
  slot: string,
  question: string,
  turn: number,
  answerQuality: 'valid' | 'vague' | 'off_topic' | 'unanswered' = 'unanswered'
): SlotState {
  // M-4: 清理该 slot 的旧记录
  const slotQuestions = state.asked.filter((q) => q.slot === slot);
  const otherQuestions = state.asked.filter((q) => q.slot !== slot);

  // 保留最近的记录
  const trimmedSlotQuestions = slotQuestions.slice(-(MAX_ASKED_PER_SLOT - 1));

  // M-1: 收集已用问题变体
  const usedVariants = trimmedSlotQuestions.map((q) => q.question);

  const newQuestion: AskedQuestion = {
    slot,
    question,
    question_variants: [...usedVariants, question],
    turn,
    answer_quality: answerQuality,
  };

  return {
    ...state,
    asked: [...otherQuestions, ...trimmedSlotQuestions, newQuestion],
  };
}

/**
 * 更新最近问题的回答质量
 */
export function updateLastQuestionQuality(
  state: SlotState,
  answerQuality: 'valid' | 'vague' | 'off_topic' | 'unanswered'
): SlotState {
  if (state.asked.length === 0) return state;

  const updated = [...state.asked];
  updated[updated.length - 1] = {
    ...updated[updated.length - 1],
    answer_quality: answerQuality,
  };

  return {
    ...state,
    asked: updated,
  };
}

/**
 * 检查问题是否已问过
 */
export function isQuestionAsked(state: SlotState, slot: string): boolean {
  return state.asked.some((q) => q.slot === slot);
}

/**
 * 获取某个 Slot 的提问次数
 */
export function getQuestionCount(state: SlotState, slot: string): number {
  return state.asked.filter((q) => q.slot === slot).length;
}

/**
 * 获取某个 Slot 的有效回答次数
 */
export function getValidAnswerCount(state: SlotState, slot: string): number {
  return state.asked.filter((q) => q.slot === slot && q.answer_quality === 'valid').length;
}

/**
 * 获取某个 Slot 的已用问题变体列表
 *
 * M-1 修复：支持"换方式提问"
 */
export function getUsedQuestionVariants(state: SlotState, slot: string): string[] {
  const slotQuestions = state.asked.filter((q) => q.slot === slot);
  if (slotQuestions.length === 0) return [];

  // 返回最后一条记录的 question_variants
  return slotQuestions[slotQuestions.length - 1].question_variants;
}

// ============================================================
// 初步发现管理（M-2 修复）
// ============================================================

/**
 * 追加初步发现
 *
 * M-2 修复：管理 initial_findings
 */
export function addFinding(findings: string[], finding: string): string[] {
  return [...findings, finding];
}

/**
 * 批量追加初步发现
 */
export function addFindings(findings: string[], newFindings: string[]): string[] {
  return [...findings, ...newFindings];
}

/**
 * 判断是否应该显示初步发现
 *
 * SPEC §3.5: 第 4 轮后显示"初步发现"卡片
 */
export function shouldShowFindings(roundNumber: number): boolean {
  return roundNumber >= 4;
}

/**
 * 判断是否应该提示更新画像
 *
 * SPEC: 超过 10 轮时提示更新画像
 */
export function shouldPromptPortraitUpdate(roundNumber: number): boolean {
  return roundNumber > 0 && roundNumber % 10 === 0;
}

// ============================================================
// 状态查询
// ============================================================

/**
 * 获取所有已填充且已确认的 Slot 名
 */
export function getFilledSlotNames(state: SlotState): string[] {
  return Object.entries(state.filled)
    .filter(([, entry]) => entry.confirmed)
    .map(([name]) => name);
}

/**
 * 获取所有未确认的 Slot 名
 */
export function getUnconfirmedSlotNames(state: SlotState): string[] {
  return Object.entries(state.filled)
    .filter(([, entry]) => !entry.confirmed)
    .map(([name]) => name);
}

/**
 * 计算未填充的 Slot（动态计算，不存储）
 *
 * @param state 当前状态
 * @param requiredSlots 必填 Slot 定义列表
 * @returns 未填充的 Slot 名
 */
export function getPendingSlots(state: SlotState, requiredSlots: SlotDefinition[]): string[] {
  return requiredSlots
    .filter((slot) => slot.required && !isSlotFilled(state, slot.name))
    .map((slot) => slot.name);
}

/**
 * 计算填充进度
 *
 * @param state 当前状态
 * @param requiredSlots 必填 Slot 定义列表
 * @returns 进度 0-1
 */
export function getCompletionRate(state: SlotState, requiredSlots: SlotDefinition[]): number {
  const required = requiredSlots.filter((s) => s.required);
  if (required.length === 0) return 1;

  const filled = required.filter((s) => isSlotFilled(state, s.name)).length;
  return filled / required.length;
}

// ============================================================
// 对话阶段管理
// ============================================================

/**
 * 更新对话阶段
 */
export function setPhase(state: SlotState, phase: DialoguePhase): SlotState {
  return { ...state, phase };
}

/**
 * 设置当前聚焦的 Slot
 */
export function setCurrentFocus(state: SlotState, slotName: string | null): SlotState {
  return { ...state, current_focus: slotName };
}

/**
 * 自动决定下一个要问的 Slot
 *
 * 优先级：
 * 1. 未确认的 Slot（用户改口了）
 * 2. 未问过的必填 Slot
 * 3. 已问但回答无效的 Slot（追问，受 MAX_FOLLOWUP_COUNT 限制）
 * 4. 返回 null（所有必填 Slot 已填充）
 *
 * m-2 修复：使用 MAX_FOLLOWUP_COUNT 限制追问次数
 */
export function getNextSlotToAsk(
  state: SlotState,
  requiredSlots: SlotDefinition[]
): SlotDefinition | null {
  // 1. 未确认的 Slot
  const unconfirmed = getUnconfirmedSlotNames(state);
  if (unconfirmed.length > 0) {
    const slotDef = requiredSlots.find((s) => s.name === unconfirmed[0]);
    if (slotDef) return slotDef;
  }

  // 2. 未问过的必填 Slot
  const pending = getPendingSlots(state, requiredSlots);
  for (const slotName of pending) {
    if (!isQuestionAsked(state, slotName)) {
      const slotDef = requiredSlots.find((s) => s.name === slotName);
      if (slotDef) return slotDef;
    }
  }

  // 3. 已问但回答无效的 Slot（追问，受 MAX_FOLLOWUP_COUNT 限制）
  for (const slotName of pending) {
    const questionCount = getQuestionCount(state, slotName);
    const validCount = getValidAnswerCount(state, slotName);

    // m-2 修复：检查追问次数上限
    if (validCount === 0 && questionCount > 0 && questionCount < MAX_FOLLOWUP_COUNT) {
      const slotDef = requiredSlots.find((s) => s.name === slotName);
      if (slotDef) return slotDef;
    }
  }

  // 4. 所有必填 Slot 已填充或达到追问上限
  return null;
}

/**
 * 判断是否可以继续追问某个 Slot
 */
export function canFollowup(state: SlotState, slotName: string): boolean {
  const questionCount = getQuestionCount(state, slotName);
  return questionCount < MAX_FOLLOWUP_COUNT;
}

// ============================================================
// 滑动窗口管理
// ============================================================

/**
 * 添加轮次到滑动窗口
 */
export function addTurnToWindow(
  window: DialogueTurn[],
  turn: DialogueTurn
): DialogueTurn[] {
  const newWindow = [...window, turn];
  // 保留最近 N 轮
  if (newWindow.length > RECENT_WINDOW_SIZE) {
    return newWindow.slice(-RECENT_WINDOW_SIZE);
  }
  return newWindow;
}

/**
 * 从 JSON 解析滑动窗口
 */
export function parseRecentWindow(json: string | null): DialogueTurn[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as DialogueTurn[];
  } catch {
    return [];
  }
}

// ============================================================
// Prompt 注入
// ============================================================

/**
 * 构建注入 prompt 的精简版 Slot 状态
 *
 * 只包含已确认的 Slot，用于引导 Agent
 * m-6 修复：按维度分组，提高可读性
 */
export function buildSlotPrompt(state: SlotState, slotDefinitions?: SlotDefinition[]): string {
  const confirmedEntries = Object.entries(state.filled).filter(([, v]) => v.confirmed);

  if (confirmedEntries.length === 0) {
    return '已收集信息: (暂无)';
  }

  // m-6: 按维度分组
  if (slotDefinitions) {
    const grouped: Record<string, string[]> = {};
    for (const [name, entry] of confirmedEntries) {
      const def = slotDefinitions.find((d) => d.name === name);
      const dim = def?.dimension || 'other';
      if (!grouped[dim]) grouped[dim] = [];
      grouped[dim].push(`  ${name}: ${entry.value}`);
    }

    const lines: string[] = [];
    const dimLabels: Record<string, string> = {
      basic: '基础信息',
      motivation: '职业动机',
      value: '价值排序',
      risk: '风险偏好',
      constraint: '生活约束',
      goal: '发展诉求',
      ability: '能力自评',
      ai: 'AI 能力',
      work: '当前工作',
      custom: '岗位定制',
      other: '其他',
    };

    for (const [dim, items] of Object.entries(grouped)) {
      lines.push(`[${dimLabels[dim] || dim}]`);
      lines.push(...items);
    }

    const currentFocus = state.current_focus
      ? `\n当前正在收集: ${state.current_focus}`
      : '\n准备进入下一维度';

    const unconfirmed = getUnconfirmedSlotNames(state);
    const unconfirmedLine = unconfirmed.length > 0
      ? `\n待确认: ${unconfirmed.join(', ')}`
      : '';

    return `已收集信息:\n${lines.join('\n')}${currentFocus}${unconfirmedLine}`;
  }

  // 无维度定义时的简单输出
  const filled = confirmedEntries
    .map(([k, v]) => `  ${k}: ${v.value}`)
    .join('\n');

  const currentFocus = state.current_focus
    ? `当前正在收集: ${state.current_focus}`
    : '准备进入下一维度';

  const unconfirmed = getUnconfirmedSlotNames(state);
  const unconfirmedLine = unconfirmed.length > 0
    ? `\n待确认: ${unconfirmed.join(', ')}`
    : '';

  return `已收集信息:\n${filled}\n\n${currentFocus}${unconfirmedLine}`;
}

/**
 * 构建初步发现 prompt
 */
export function buildFindingsPrompt(findings: string[]): string {
  if (findings.length === 0) return '';
  return `初步发现:\n${findings.map((f, i) => `${i + 1}. ${f}`).join('\n')}`;
}
