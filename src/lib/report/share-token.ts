/**
 * 分享 Token 生成
 * 使用 crypto.randomBytes 生成 URL 安全的 token
 * 熵值 128 bit，碰撞概率极低
 */
import crypto from "crypto";

export function generateShareToken(): string {
  return crypto.randomBytes(16).toString("base64url"); // 22 字符，128 bit 熵
}
