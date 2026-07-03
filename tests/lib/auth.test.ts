/**
 * P0 测试：认证工具函数
 *
 * 测试范围：
 * - hashPassword / verifyPassword（密码哈希）
 * - signJWT / verifyJWT（JWT 签名验证）
 * - generateVerificationCode（验证码生成）
 * - validatePasswordStrength（密码强度校验）
 * - getTokenCookieHeader / getClearCookieHeader（Cookie 工具）
 */

import { describe, it, expect } from 'vitest';

// 设置环境变量（必须在模块加载前，auth.ts 在顶层读取 process.env.JWT_SECRET）
process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing-and-verification';
process.env.NODE_ENV = 'test';

const auth = await import('@/lib/auth');

describe('auth.ts', () => {
  // ============================================================
  // 密码哈希
  // ============================================================

  describe('hashPassword', () => {
    it('应该返回 bcrypt 格式的哈希值', async () => {
      const hash = await auth.hashPassword('password123');
      expect(hash).toMatch(/^\$2[aby]?\$\d{1,2}\$/);
    });

    it('相同密码应产生不同哈希（salt 不同）', async () => {
      const hash1 = await auth.hashPassword('password123');
      const hash2 = await auth.hashPassword('password123');
      expect(hash1).not.toBe(hash2);
    });

    it('哈希长度应在合理范围内', async () => {
      const hash = await auth.hashPassword('test');
      expect(hash.length).toBeGreaterThanOrEqual(50);
      expect(hash.length).toBeLessThanOrEqual(70);
    });
  });

  describe('verifyPassword', () => {
    it('正确密码应返回 true', async () => {
      const hash = await auth.hashPassword('password123');
      const result = await auth.verifyPassword('password123', hash);
      expect(result).toBe(true);
    });

    it('错误密码应返回 false', async () => {
      const hash = await auth.hashPassword('password123');
      const result = await auth.verifyPassword('wrongpassword', hash);
      expect(result).toBe(false);
    });

    it('空密码应返回 false', async () => {
      const hash = await auth.hashPassword('password123');
      const result = await auth.verifyPassword('', hash);
      expect(result).toBe(false);
    });
  });

  // ============================================================
  // JWT
  // ============================================================

  describe('signJWT', () => {
    it('应该返回 JWT 格式的 token', async () => {
      const token = await auth.signJWT('user123');
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('不同用户应产生不同 token', async () => {
      const token1 = await auth.signJWT('user1');
      const token2 = await auth.signJWT('user2');
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyJWT', () => {
    it('有效 token 应返回 userId', async () => {
      const token = await auth.signJWT('user123');
      const result = await auth.verifyJWT(token);
      expect(result).toEqual({ userId: 'user123' });
    });

    it('篡改的 token 应返回 null', async () => {
      const token = await auth.signJWT('user123');
      const tampered = token.slice(0, -5) + 'XXXXX';
      const result = await auth.verifyJWT(tampered);
      expect(result).toBeNull();
    });

    it('空字符串应返回 null', async () => {
      const result = await auth.verifyJWT('');
      expect(result).toBeNull();
    });

    it('随机字符串应返回 null', async () => {
      const result = await auth.verifyJWT('not-a-jwt');
      expect(result).toBeNull();
    });

    it('签名验证通过后应返回正确的 userId', async () => {
      const token = await auth.signJWT('abc-def-ghi');
      const result = await auth.verifyJWT(token);
      expect(result?.userId).toBe('abc-def-ghi');
    });
  });

  describe('signJWT + verifyJWT 集成', () => {
    it('签名后验证应闭环', async () => {
      const userId = 'test-user-id-12345';
      const token = await auth.signJWT(userId);
      const verified = await auth.verifyJWT(token);
      expect(verified?.userId).toBe(userId);
    });
  });

  // ============================================================
  // 验证码
  // ============================================================

  describe('generateVerificationCode', () => {
    it('应返回 6 位数字字符串', () => {
      const code = auth.generateVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
    });

    it('多次生成应返回不同值（概率性）', () => {
      const codes = new Set(Array.from({ length: 100 }, () => auth.generateVerificationCode()));
      // 100 次全部相同概率极低
      expect(codes.size).toBeGreaterThan(1);
    });

    it('应在 100000-999999 范围内', () => {
      for (let i = 0; i < 50; i++) {
        const code = parseInt(auth.generateVerificationCode(), 10);
        expect(code).toBeGreaterThanOrEqual(100000);
        expect(code).toBeLessThan(1000000);
      }
    });
  });

  // ============================================================
  // 密码强度校验
  // ============================================================

  describe('validatePasswordStrength', () => {
    it('强密码应返回 null', () => {
      expect(auth.validatePasswordStrength('password123')).toBeNull();
    });

    it('纯字母应返回错误', () => {
      expect(auth.validatePasswordStrength('abcdefgh')).toContain('数字');
    });

    it('纯数字应返回错误', () => {
      expect(auth.validatePasswordStrength('12345678')).toContain('字母');
    });

    it('短密码应返回错误', () => {
      expect(auth.validatePasswordStrength('ab1')).toContain('8位');
    });

    it('恰好 8 位且包含字母数字应通过', () => {
      expect(auth.validatePasswordStrength('abcd1234')).toBeNull();
    });

    it('空密码应返回错误', () => {
      expect(auth.validatePasswordStrength('')).not.toBeNull();
    });
  });

  // ============================================================
  // Cookie 工具
  // ============================================================

  describe('getTokenCookieHeader', () => {
    it('应包含 token 值', () => {
      const header = auth.getTokenCookieHeader('my-token');
      expect(header).toContain('token=my-token');
    });

    it('应包含 HttpOnly', () => {
      const header = auth.getTokenCookieHeader('my-token');
      expect(header).toContain('HttpOnly');
    });

    it('应包含 SameSite=Lax', () => {
      const header = auth.getTokenCookieHeader('my-token');
      expect(header).toContain('SameSite=Lax');
    });

    it('应包含 Path=/', () => {
      const header = auth.getTokenCookieHeader('my-token');
      expect(header).toContain('Path=/');
    });

    it('应包含 Max-Age', () => {
      const header = auth.getTokenCookieHeader('my-token');
      expect(header).toContain('Max-Age=604800'); // 7 天
    });
  });

  describe('getClearCookieHeader', () => {
    it('应包含空 token 值', () => {
      const header = auth.getClearCookieHeader();
      expect(header).toContain('token=');
    });

    it('应包含 Max-Age=0', () => {
      const header = auth.getClearCookieHeader();
      expect(header).toContain('Max-Age=0');
    });

    it('应包含 HttpOnly', () => {
      const header = auth.getClearCookieHeader();
      expect(header).toContain('HttpOnly');
    });
  });
});
