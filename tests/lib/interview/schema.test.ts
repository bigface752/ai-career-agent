/**
 * P1 测试：面试 Schema 验证
 *
 * 测试范围：
 * - InterviewRound（面试轮次枚举）
 * - InterviewQuestionSchema（单题 Schema）
 * - GenerateQuestionsOutputSchema（生成输出 Schema）
 * - AnswerInputSchema（回答输入 Schema）
 * - AiAnswerEvaluationSchema（AI 评估 Schema）
 * - EvaluateOutputSchema（评估输出 Schema）
 */

import { describe, it, expect } from 'vitest';
import {
  InterviewRound,
  InterviewQuestionSchema,
  GenerateQuestionsOutputSchema,
  AnswerInputSchema,
  AiAnswerEvaluationSchema,
  EvaluateOutputSchema,
  EVAL_DIMENSIONS,
} from '@/lib/interview/schema';

describe('interview/schema.ts', () => {
  // ============================================================
  // InterviewRound
  // ============================================================

  describe('InterviewRound', () => {
    it('应接受有效轮次', () => {
      expect(InterviewRound.parse('一面')).toBe('一面');
      expect(InterviewRound.parse('二面')).toBe('二面');
      expect(InterviewRound.parse('终面')).toBe('终面');
      expect(InterviewRound.parse('HR面')).toBe('HR面');
    });

    it('应拒绝无效轮次', () => {
      expect(() => InterviewRound.parse('三面')).toThrow();
      expect(() => InterviewRound.parse('')).toThrow();
      expect(() => InterviewRound.parse('hr')).toThrow();
    });
  });

  // ============================================================
  // InterviewQuestionSchema
  // ============================================================

  describe('InterviewQuestionSchema', () => {
    const validQuestion = {
      id: 'q1',
      type: '专业题' as const,
      question: '请解释一下什么是 SOLID 原则？',
      focus: '考察设计模式基础',
      difficulty: '中等' as const,
    };

    it('应接受有效题目', () => {
      const result = InterviewQuestionSchema.parse(validQuestion);
      expect(result.id).toBe('q1');
    });

    it('应接受所有题目类型', () => {
      expect(InterviewQuestionSchema.parse({ ...validQuestion, type: '专业题' }).type).toBe('专业题');
      expect(InterviewQuestionSchema.parse({ ...validQuestion, type: '行为题' }).type).toBe('行为题');
      expect(InterviewQuestionSchema.parse({ ...validQuestion, type: '非标准题' }).type).toBe('非标准题');
    });

    it('应接受所有难度', () => {
      expect(InterviewQuestionSchema.parse({ ...validQuestion, difficulty: '简单' }).difficulty).toBe('简单');
      expect(InterviewQuestionSchema.parse({ ...validQuestion, difficulty: '中等' }).difficulty).toBe('中等');
      expect(InterviewQuestionSchema.parse({ ...validQuestion, difficulty: '困难' }).difficulty).toBe('困难');
    });

    it('应拒绝过短的题目', () => {
      expect(() => InterviewQuestionSchema.parse({ ...validQuestion, question: '短' })).toThrow();
    });

    it('应拒绝无效类型', () => {
      expect(() => InterviewQuestionSchema.parse({ ...validQuestion, type: '未知类型' })).toThrow();
    });

    it('应拒绝无效难度', () => {
      expect(() => InterviewQuestionSchema.parse({ ...validQuestion, difficulty: '超难' })).toThrow();
    });
  });

  // ============================================================
  // GenerateQuestionsOutputSchema
  // ============================================================

  describe('GenerateQuestionsOutputSchema', () => {
    const makeQuestions = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `q${i + 1}`,
        type: '专业题' as const,
        question: `这是第 ${i + 1} 道面试题，用于测试生成输出`,
        focus: '测试',
        difficulty: '中等' as const,
      }));

    it('应接受 6 道题', () => {
      const result = GenerateQuestionsOutputSchema.parse({ questions: makeQuestions(6) });
      expect(result.questions).toHaveLength(6);
    });

    it('应接受 10 道题', () => {
      const result = GenerateQuestionsOutputSchema.parse({ questions: makeQuestions(10) });
      expect(result.questions).toHaveLength(10);
    });

    it('应拒绝少于 6 道题', () => {
      expect(() => GenerateQuestionsOutputSchema.parse({ questions: makeQuestions(5) })).toThrow();
    });

    it('应拒绝多于 10 道题', () => {
      expect(() => GenerateQuestionsOutputSchema.parse({ questions: makeQuestions(11) })).toThrow();
    });
  });

  // ============================================================
  // AnswerInputSchema
  // ============================================================

  describe('AnswerInputSchema', () => {
    const validInput = {
      interview_id: 'interview-123',
      question_id: 'q1',
      answer: '我的回答内容',
    };

    it('应接受有效输入', () => {
      const result = AnswerInputSchema.parse(validInput);
      expect(result.interview_id).toBe('interview-123');
    });

    it('应拒绝空 interview_id', () => {
      expect(() => AnswerInputSchema.parse({ ...validInput, interview_id: '' })).toThrow();
    });

    it('应拒绝空 question_id', () => {
      expect(() => AnswerInputSchema.parse({ ...validInput, question_id: '' })).toThrow();
    });

    it('应拒绝空 answer', () => {
      expect(() => AnswerInputSchema.parse({ ...validInput, answer: '' })).toThrow();
    });

    it('应拒绝超长 answer', () => {
      expect(() => AnswerInputSchema.parse({ ...validInput, answer: 'a'.repeat(5001) })).toThrow();
    });

    it('应接受恰好 5000 字的 answer', () => {
      const result = AnswerInputSchema.parse({ ...validInput, answer: 'a'.repeat(5000) });
      expect(result.answer).toHaveLength(5000);
    });
  });

  // ============================================================
  // AiAnswerEvaluationSchema
  // ============================================================

  describe('AiAnswerEvaluationSchema', () => {
    it('应接受 good 质量', () => {
      const result = AiAnswerEvaluationSchema.parse({
        answerQuality: 'good',
        shouldFollowUp: true,
        followUpQuestion: '能详细说说吗？',
      });
      expect(result.answerQuality).toBe('good');
    });

    it('应接受 too_short 质量', () => {
      const result = AiAnswerEvaluationSchema.parse({
        answerQuality: 'too_short',
        shouldFollowUp: false,
        reQuestion: '请详细回答',
      });
      expect(result.answerQuality).toBe('too_short');
    });

    it('应接受 off_topic 质量', () => {
      const result = AiAnswerEvaluationSchema.parse({
        answerQuality: 'off_topic',
        shouldFollowUp: false,
        reQuestion: '请围绕问题回答',
      });
      expect(result.answerQuality).toBe('off_topic');
    });

    it('应拒绝无效质量', () => {
      expect(() => AiAnswerEvaluationSchema.parse({
        answerQuality: 'excellent',
        shouldFollowUp: false,
      })).toThrow();
    });
  });

  // ============================================================
  // EvaluateOutputSchema
  // ============================================================

  describe('EvaluateOutputSchema', () => {
    const validOutput = {
      overall_rating: '4/5：良好',
      dimensions: {
        '专业深度': { score: 4, comment: '基础扎实' },
        '表达清晰度': { score: 3, comment: '可以更清晰' },
        'STAR结构运用': { score: 4, comment: '结构完整' },
        '抗压表现': { score: 3, comment: '稍显紧张' },
      },
      per_question: [
        {
          question_id: 'q1',
          rating: 4,
          strength: '回答全面',
          weakness: '缺少具体数据',
          optimized_answer: '使用 STAR 法则优化后的答案...',
          key_improvement: '补充量化数据',
        },
      ],
      top_3_improvements: [
        { priority: 1, what: '补充数据', how: '用具体数字说明成果' },
        { priority: 2, what: '结构化表达', how: '使用 STAR 法则' },
        { priority: 3, what: '控制时间', how: '每题 2-3 分钟' },
      ],
      preparation_directions: [
        { direction: '行业知识', reason: '需要了解最新趋势' },
      ],
    };

    it('应接受有效评估输出', () => {
      const result = EvaluateOutputSchema.parse(validOutput);
      expect(result.overall_rating).toBe('4/5：良好');
    });

    it('应包含所有评估维度', () => {
      const result = EvaluateOutputSchema.parse(validOutput);
      for (const dim of EVAL_DIMENSIONS) {
        expect(result.dimensions).toHaveProperty(dim);
      }
    });

    it('top_3_improvements 必须恰好 3 项', () => {
      expect(() => EvaluateOutputSchema.parse({
        ...validOutput,
        top_3_improvements: validOutput.top_3_improvements.slice(0, 2),
      })).toThrow();
    });

    it('per_question 至少 1 项', () => {
      expect(() => EvaluateOutputSchema.parse({
        ...validOutput,
        per_question: [],
      })).toThrow();
    });

    it('score 范围 1-5', () => {
      expect(() => EvaluateOutputSchema.parse({
        ...validOutput,
        dimensions: {
          ...validOutput.dimensions,
          '专业深度': { score: 0, comment: '无效' },
        },
      })).toThrow();

      expect(() => EvaluateOutputSchema.parse({
        ...validOutput,
        dimensions: {
          ...validOutput.dimensions,
          '专业深度': { score: 6, comment: '无效' },
        },
      })).toThrow();
    });
  });
});
