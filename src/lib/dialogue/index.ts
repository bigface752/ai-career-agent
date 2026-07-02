/**
 * Dialogue State Management
 *
 * 对话状态管理模块，提供：
 * - SlotState 类型定义和工具函数
 * - 模块一（职业认知）Slot 定义
 * - 滑动窗口管理
 * - Prompt 注入工具
 *
 * 对抗式审查修复记录：
 * - C-1: fillSlot 增量提取，不覆盖已确认值
 * - M-1: question_variants 支持"换方式提问"
 * - M-2: initial_findings 管理函数
 * - M-3: 向前兼容版本迁移
 * - M-4: asked 数组清理机制
 * - m-2: MAX_FOLLOWUP_COUNT 限制追问次数
 * - m-4: dimension 增加 'custom' 类型
 * - m-5: DialogueTurn 提取为公共类型
 * - m-6: buildSlotPrompt 按维度分组
 */

// Types
export type {
  SlotState,
  SlotEntry,
  AskedQuestion,
  SlotDefinition,
  DialoguePhase,
  DialogueTurn,
  DialogueSessionState,
} from './types';

export {
  SLOT_STATE_SCHEMA_VERSION,
  RECENT_WINDOW_SIZE,
  DEFAULT_EXPIRY_DAYS,
  MAX_FOLLOWUP_COUNT,
} from './types';

// Slot State Management
export {
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
  updateLastQuestionQuality,
  isQuestionAsked,
  getQuestionCount,
  getValidAnswerCount,
  getUsedQuestionVariants,
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
} from './slot-state';

// Slot Definitions
export {
  CAREER_COGNITION_SLOTS,
  getRequiredSlots,
  getDialogueSlots,
  getSlotsByDimension,
  SLOT_LABELS,
  validateSlotValue,
  MODULE_ZERO_SLOTS,
  getModuleZeroRequiredSlots,
  getSlotsForModule,
  getRequiredSlotsForModule,
} from './slots';

// Session Manager
export type {
  DialogueSessionData,
  SessionWithProgress,
} from './session-manager';
export {
  createDialogueSession,
  getDialogueSession,
  getActiveSession,
  getSessionWithProgress,
  pauseDialogueSession,
  resumeDialogueSession,
  saveMessage,
  getMessages,
  updateSessionState,
} from './session-manager';
