/**
 * 认证工具函数
 * 密码哈希、JWT、验证码、邮件发送
 */
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { Resend } from "resend";

// ============================================================
// 配置
// ============================================================

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@ai-career-agent.com";

// 延迟初始化，避免构建时报错
let resend: Resend;
function getResend() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY!);
  }
  return resend;
}

// ============================================================
// 密码哈希
// ============================================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================================
// JWT
// ============================================================

export async function signJWT(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyJWT(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { userId: payload.userId as string };
  } catch {
    return null;
  }
}

// ============================================================
// 验证码
// ============================================================

export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "密码至少8位";
  if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) return "密码需包含字母和数字";
  return null;
}

// ============================================================
// Cookie 工具（httpOnly，middleware 读取用）
// ============================================================

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7天，与JWT过期一致

export function getTokenCookieHeader(token: string): string {
  const isProduction = process.env.NODE_ENV === "production";
  return [
    `token=${token}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE}`,
    "HttpOnly",
    "SameSite=Lax",
    isProduction ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function getClearCookieHeader(): string {
  const isProduction = process.env.NODE_ENV === "production";
  return [
    "token=",
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
    isProduction ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

// ============================================================
// 邮件发送
// ============================================================

export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<boolean> {
  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "AI Career Agent - 验证码",
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
          <h2>验证码</h2>
          <p>你的验证码是：</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">
            ${code}
          </div>
          <p style="color: #666;">10分钟内有效，请勿泄露给他人。</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("发送邮件失败:", error);
    return false;
  }
}

export async function sendPasswordResetEmail(
  email: string,
  code: string
): Promise<boolean> {
  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "AI Career Agent - 密码重置验证码",
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
          <h2>密码重置</h2>
          <p>你正在重置密码，验证码是：</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #dc2626;">
            ${code}
          </div>
          <p style="color: #666;">10分钟内有效，请勿泄露给他人。</p>
          <p style="color: #999; font-size: 12px;">如果这不是你的操作，请忽略此邮件。</p>
        </div>
      `,
    });
    return true;
  } catch (error) {
    console.error("发送密码重置邮件失败:", error);
    return false;
  }
}
