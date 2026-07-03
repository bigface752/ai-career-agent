/**
 * P2 测试：边界情况和错误处理
 *
 * 测试范围：
 * - 认证函数边界情况
 * - Slot 状态边界情况
 * - 共识算法边界情况
 */

import { describe, it, expect } from 'vitest';

// 设置环境变量（必须在模块加载前）
process.env.JWT_SECRET = 'test-secret-key-for-edge-cases-testing';
process.env.NODE_ENV = 'test';

const auth = await import('@/lib/auth');
const {
  createSlotState,
  fillSlot,
  getSlotValue,
  isSlotFilled,
  getCompletionRate,
  getNextSlotToAsk,
  recordQuestion,
  canFollowup,
  parseSlotState,
  serializeSlotState,
} = await import('@/lib/dialogue/slot-state');
const { majorityVote } = await import('@/lib/evaluation/consensus');

describe('边界情况', () => {
  // ============================================================
  // 认证边界
  // ============================================================

  describe('auth 边界', () => {
    it('极长密码应能哈希', async () => {
      const longPassword = 'a'.repeat(1000);
      const hash = await auth.hashPassword(longPassword);
      const valid = await auth.verifyPassword(longPassword, hash);
      expect(valid).toBe(true);
    });

    it('特殊字符密码应能哈希', async () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      const hash = await auth.hashPassword(specialPassword);
      const valid = await auth.verifyPassword(specialPassword, hash);
      expect(valid).toBe(true);
    });

    it('Unicode 密码应能哈希', async () => {
      const unicodePassword = '密码123🔐';
      const hash = await auth.hashPassword(unicodePassword);
      const valid = await auth.verifyPassword(unicodePassword, hash);
      expect(valid).toBe(true);
    });

    it('verifyPassword 对损坏的哈希应返回 false', async () => {
      const result = await auth.verifyPassword('password', 'not-a-hash');
      expect(result).toBe(false);
    });

    it('verifyJWT 对刚签发的 token 应验证通过', async () => {
      const token = await auth.signJWT('user123');
      const result = await auth.verifyJWT(token);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user123');
    });

    it('generateVerificationCode 应总是6位', () => {
      for (let i = 0; i < 100; i++) {
        const code = auth.generateVerificationCode();
        expect(code).toHaveLength(6);
      }
    });
  });

  // ============================================================
  // Slot 状态边界
  // ============================================================

  describe('SlotState 边界', () => {
    it('fillSlot 应返回新对象（不可变性）', () => {
      const state = createSlotState();
      const filled = fillSlot(state, 'test', 'value', 'high', 1);
      expect(filled).not.toBe(state);
      expect(state.filled.test).toBeUndefined();
    });

    it('多次 fillSlot 不同 Slot 应累积', () => {
      let state = createSlotState();
      state = fillSlot(state, 'slot1', 'v1', 'high', 1);
      state = fillSlot(state, 'slot2', 'v2', 'high', 2);
      state = fillSlot(state, 'slot3', 'v3', 'high', 3);
      expect(Object.keys(state.filled)).toHaveLength(3);
    });

    it('getSlotValue 应区分 confirmed 和 unconfirmed', () => {
      let state = createSlotState();
      state = fillSlot(state, 'test', 'value', 'high', 1, false);
      expect(getSlotValue(state, 'test')).toBeNull();
      state = fillSlot(state, 'test', 'value', 'high', 1, true);
      expect(getSlotValue(state, 'test')).toBe('value');
    });

    it('parseSlotState 应处理各种异常输入', () => {
      expect(parseSlotState(null).filled).toEqual({});
      expect(parseSlotState('').filled).toEqual({});
      expect(parseSlotState('null').filled).toEqual({});
      expect(parseSlotState('{}').filled).toEqual({});
      expect(parseSlotState('[]').filled).toEqual({});
    });

    it('serializeSlotState 应保持数据完整性', () => {
      let state = createSlotState();
      state = fillSlot(state, 'test', 'value', 'high', 1);
      state = recordQuestion(state, 'test', '问题？', 1);
      const serialized = serializeSlotState(state);
      const parsed = parseSlotState(serialized);
      expect(parsed.filled.test?.value).toBe('value');
      expect(parsed.asked).toHaveLength(1);
    });

    it('getCompletionRate 空 requiredSlots 应返回 1', () => {
      expect(getCompletionRate(createSlotState(), [])).toBe(1);
    });

    it('getCompletionRate 无必填 Slot 应返回 1', () => {
      const slots = [
        { name: 'optional', label: '可选', required: false, dimension: 'custom' },
      ];
      expect(getCompletionRate(createSlotState(), slots)).toBe(1);
    });
  });

  // ============================================================
  // 共识算法边界
  // ============================================================

  describe('majorityVote 边界', () => {
    it('2次弱+1次强 → 弱, high', () => {
      const result = majorityVote(['弱', '强', '弱']);
      expect(result.rating).toBe('弱');
      expect(result.confidence).toBe('high');
    });

    it('2次强+1次弱 → 强, high', () => {
      const result = majorityVote(['强', '弱', '强']);
      expect(result.rating).toBe('强');
      expect(result.confidence).toBe('high');
    });

    it('所有排列的 3 次各不同都应返回中, low', () => {
      const permutations: Array<['强' | '中' | '弱', '强' | '中' | '弱', '强' | '中' | '弱']> = [
        ['强', '中', '弱'],
        ['强', '弱', '中'],
        ['中', '强', '弱'],
        ['中', '弱', '强'],
        ['弱', '强', '中'],
        ['弱', '中', '强'],
      ];
      for (const perm of permutations) {
        const result = majorityVote(perm);
        expect(result.rating).toBe('中');
        expect(result.confidence).toBe('low');
      }
    });
  });

  // ============================================================
  // 问题追踪边界
  // ============================================================

  describe('问题追踪边界', () => {
    it('MAX_FOLLOWUP_COUNT 限制追问', () => {
      let state = createSlotState();
      // MAX_FOLLOWUP_COUNT = 3
      state = recordQuestion(state, 'test', '问题1', 1, 'vague');
      expect(canFollowup(state, 'test')).toBe(true);
      state = recordQuestion(state, 'test', '问题2', 2, 'vague');
      expect(canFollowup(state, 'test')).toBe(true);
      state = recordQuestion(state, 'test', '问题3', 3, 'vague');
      // 3次后应不能再追问
      expect(canFollowup(state, 'test')).toBe(false);
    });

    it('不同 Slot 追问次数独立', () => {
      let state = createSlotState();
      state = recordQuestion(state, 'slot1', '问题1', 1, 'vague');
      state = recordQuestion(state, 'slot1', '问题2', 2, 'vague');
      state = recordQuestion(state, 'slot1', '问题3', 3, 'vague');
      // slot1 已满
      expect(canFollowup(state, 'slot1')).toBe(false);
      // slot2 还能追问
      expect(canFollowup(state, 'slot2')).toBe(true);
    });
  });
});
