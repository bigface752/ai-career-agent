/**
 * P1 测试：共识算法
 *
 * 测试范围：
 * - majorityVote（多数投票算法）
 */

import { describe, it, expect } from 'vitest';
import { majorityVote } from '@/lib/evaluation/consensus';

describe('consensus.ts', () => {
  describe('majorityVote', () => {
    // ============================================================
    // 高置信度场景（2+ 次一致）
    // ============================================================

    it('3次一致: 强/强/强 → 强, high', () => {
      const result = majorityVote(['强', '强', '强']);
      expect(result.rating).toBe('强');
      expect(result.confidence).toBe('high');
    });

    it('3次一致: 中/中/中 → 中, high', () => {
      const result = majorityVote(['中', '中', '中']);
      expect(result.rating).toBe('中');
      expect(result.confidence).toBe('high');
    });

    it('3次一致: 弱/弱/弱 → 弱, high', () => {
      const result = majorityVote(['弱', '弱', '弱']);
      expect(result.rating).toBe('弱');
      expect(result.confidence).toBe('high');
    });

    it('2次一致+1次不同: 强/强/中 → 强, high', () => {
      const result = majorityVote(['强', '强', '中']);
      expect(result.rating).toBe('强');
      expect(result.confidence).toBe('high');
    });

    it('2次一致+1次不同: 弱/中/弱 → 弱, high', () => {
      const result = majorityVote(['弱', '中', '弱']);
      expect(result.rating).toBe('弱');
      expect(result.confidence).toBe('high');
    });

    it('2次一致+1次不同: 中/强/中 → 中, high', () => {
      const result = majorityVote(['中', '强', '中']);
      expect(result.rating).toBe('中');
      expect(result.confidence).toBe('high');
    });

    // ============================================================
    // 低置信度场景（3次各不同）
    // ============================================================

    it('3次各不同: 强/中/弱 → 中, low', () => {
      const result = majorityVote(['强', '中', '弱']);
      expect(result.rating).toBe('中');
      expect(result.confidence).toBe('low');
    });

    it('3次各不同: 弱/强/中 → 中, low', () => {
      const result = majorityVote(['弱', '强', '中']);
      expect(result.rating).toBe('中');
      expect(result.confidence).toBe('low');
    });

    // ============================================================
    // 边界情况
    // ============================================================

    it('排序不应影响结果（顺序无关）', () => {
      // 2次强+1次中，无论顺序如何，都应返回强
      expect(majorityVote(['强', '强', '中']).rating).toBe('强');
      expect(majorityVote(['强', '中', '强']).rating).toBe('强');
      expect(majorityVote(['中', '强', '强']).rating).toBe('强');
    });
  });
});
