/**
 * JD 解析 — Zod 类型定义
 * 对齐 specs/api-endpoints.md POST /api/match/parse-jd 的响应结构
 */
import { z } from "zod";

// JD 解析结果的结构化输出
export const ParsedJdSchema = z.object({
  position: z.string().describe("岗位名称"),
  company_type: z.string().describe("公司类型，如 B2B SaaS、互联网大厂"),
  requirements: z.object({
    skills: z.array(z.string()).describe("核心技能要求，3-6项"),
    experience: z.string().describe("经验要求，如 8年+"),
    education: z.string().describe("学历要求"),
    salary_range: z.string().describe("薪资范围，如 40-60万"),
    location: z.string().describe("工作地点"),
  }),
  nice_to_have: z.array(z.string()).describe("加分项"),
  key_challenges: z.array(z.string()).describe("岗位核心挑战"),
});

export type ParsedJd = z.infer<typeof ParsedJdSchema>;

// API 响应类型
export interface ParseJdResponse {
  jd_id: string;
  parsed_jd: ParsedJd;
  confidence: "high" | "low";
  note: string | null;
}
