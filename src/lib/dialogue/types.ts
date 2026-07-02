/**
 * Dialogue State Types
 *
 * 基于 MultiWOZ belief_state + Rasa slot 系统设计
 * 支持增量提取、暂停恢复、防重复提问
 */

// ============================================================
// Slot 类型定义
// ============================================================

/** Slot 填充记录 */
export interface SlotEntry {
  /** Slot 的值（支持多种类型） */
  value: string | number | boolean | string[];
  /** 置信度：high=用户明确说的, medium=推断的, low=猜测的 */
  confidence: 'high' | 'medium' | 'low';
  /** 第几轮填充的 */
  turn: number;
  /** 是否经过用户确认（改口时标记为 false） */
  confirmed: boolean;
  /** 最后更新时间（ISO timestamp） */
  updated_at: string;
}

/** 已问问题记录 */
export interface AskedQuestion {
  /** 关联的 Slot 名 */
  slot: string;
  /** 实际问的问题（支持变体追问） */
  question: string;
  /** 已用过的问题变体（防止重复同一问法） */
  question_variants: string[];
  /** 第几轮问的 */
  turn: number;
  /** 回答质量 */
  answer_quality: 'valid' | 'vague' | 'off_topic' | 'unanswered';
}

/** 对话轮次（滑动窗口） */
export interface DialogueTurn {
  role: 'user' | 'assistant';
  content: string;
  turn: number;
}

/** 对话阶段 */
export type DialoguePhase = 'warmup' | 'core' | 'validation' | 'wrapup';

// ============================================================
// SlotState 核心结构
// ============================================================

/**
 * 对话 Slot 状态
 *
 * 设计原则：
 * 1. 最小化：只存储必要信息，pending_slots 动态计算
 * 2. 可验证：支持运行时验证
 * 3. 可扩展：schema_version 支持未来升级
 * 4. 高效查询：filled 为 key-value 结构，支持快速查找
 */
export interface SlotState {
  /** Schema 版本（支持未来扩展） */
  schema_version: number;

  /** 已填充的 Slot（核心，注入 prompt） */
  filled: Record<string, SlotEntry>;

  /** 已问问题（防重复，支持追问追踪） */
  asked: AskedQuestion[];

  /** 当前聚焦的 Slot（引导 Agent 聚焦） */
  current_focus: string | null;

  /** 对话阶段（控制节奏） */
  phase: DialoguePhase;
}

// ============================================================
// Slot 定义（用于验证和动态计算 pending）
// ============================================================

/** Slot 定义 */
export interface SlotDefinition {
  /** Slot 名 */
  name: string;
  /** 显示名称 */
  label: string;
  /** 是否必填 */
  required: boolean;
  /** 值类型 */
  type: 'string' | 'number' | 'boolean' | 'string[]';
  /** 验证规则（可选） */
  validate?: (value: unknown) => boolean;
  /** 默认问题 */
  default_question: string;
  /** 所属维度（basic=简历解析, work=当前工作, custom=岗位动态定制） */
  dimension: 'basic' | 'motivation' | 'value' | 'risk' | 'constraint' | 'goal' | 'ability' | 'ai' | 'work' | 'custom';
}

// ============================================================
// 对话会话状态
// ============================================================

/** 对话会话状态（数据库存储格式） */
export interface DialogueSessionState {
  /** 会话 ID */
  id: string;
  /** 用户 ID */
  user_id: string;
  /** 模块：career / match / interview */
  module: string;
  /** 状态：active / paused / expired / archived */
  status: 'active' | 'paused' | 'expired' | 'archived';
  /** Slot 状态（JSON） */
  slot_state: SlotState;
  /** 最近 3 轮原文（JSON） */
  recent_window: DialogueTurn[];
  /** 累积洞察（JSON） */
  initial_findings: string[];
  /** 当前轮次 */
  round_number: number;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
  /** 过期时间 */
  expires_at: string | null;
}

// ============================================================
// 常量
// ============================================================

/** 当前 schema 版本 */
export const SLOT_STATE_SCHEMA_VERSION = 1;

/** 滑动窗口大小 */
export const RECENT_WINDOW_SIZE = 3;

/** 默认过期时间（5天） */
export const DEFAULT_EXPIRY_DAYS = 5;

/** 最大追问次数 */
export const MAX_FOLLOWUP_COUNT = 3;
