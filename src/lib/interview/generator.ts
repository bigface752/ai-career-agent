/**
 * 面试辅导 — 面试题生成器
 *
 * 职责：JD + 用户画像 + 面试轮次 → 定制化面试题
 * 模式：generateObject + Zod（复用 match/analyzer.ts 的模式）
 *
 * 对齐 SPEC.md §3.14
 */

import { generateObject } from "ai";
import { models } from "@/lib/ai";
import { db } from "@/lib/db";
import { loadPositionKnowledge } from "@/lib/knowledge/loader";
import {
  GenerateQuestionsOutputSchema,
  type GenerateQuestionsOutput,
  type GenerateQuestionsInput,
  type InterviewRound,
} from "./schema";
import { SYSTEM_PROMPT, buildGenerateQuestionsPrompt } from "./prompts";
import type { ParsedJd } from "@/lib/jd/schema";

// ============================================================
// 核心生成函数
// ============================================================

export interface GenerateQuestionsResult {
  output: GenerateQuestionsOutput;
  tokenUsage: number;
}

/**
 * 生成面试题
 *
 * @param input 面试题生成输入（JD + 画像 + 轮次）
 * @returns 结构化面试题 + token 使用量
 */
export async function generateQuestions(
  input: GenerateQuestionsInput
): Promise<GenerateQuestionsResult> {
  // 构建 JD 部分
  const jdLines: string[] = [];
  jdLines.push("## 目标岗位 JD");
  jdLines.push(`- 岗位：${input.jd.position}`);
  jdLines.push(`- 公司类型：${input.jd.company_type}`);
  jdLines.push(`- 核心技能要求：${input.jd.requirements.skills.join("、")}`);
  jdLines.push(`- 经验要求：${input.jd.requirements.experience}`);
  jdLines.push(`- 学历要求：${input.jd.requirements.education}`);
  jdLines.push(`- 薪资范围：${input.jd.requirements.salary_range}`);
  jdLines.push(`- 工作地点：${input.jd.requirements.location}`);
  if (input.jd.nice_to_have.length > 0) {
    jdLines.push(`- 加分项：${input.jd.nice_to_have.join("、")}`);
  }
  if (input.jd.key_challenges.length > 0) {
    jdLines.push(`- 岗位核心挑战：${input.jd.key_challenges.join("、")}`);
  }

  // 构建画像部分
  const portraitLines: string[] = [];
  portraitLines.push("## 用户画像");
  portraitLines.push(`- 当前职位：${input.portrait.basic_info.current_role}`);
  portraitLines.push(`- 行业：${input.portrait.basic_info.industry}`);
  portraitLines.push(`- 工作年限：${input.portrait.basic_info.years_of_experience} 年`);
  portraitLines.push(`- 核心优势：${input.portrait.strengths.join("、")}`);
  portraitLines.push(`- 待提升短板：${input.portrait.gaps.join("、")}`);

  if (input.portrait.career_segments && input.portrait.career_segments.length > 0) {
    portraitLines.push("\n## 职业经历");
    input.portrait.career_segments.forEach((seg, i) => {
      portraitLines.push(`### 经历 ${i + 1}：${seg.company}`);
      portraitLines.push(`- 岗位：${seg.position_id}`);
      portraitLines.push(`- 行业：${seg.industry}`);
      portraitLines.push(`- 核心技能：${seg.key_skills.join("、")}`);
      if (seg.key_achievements.length > 0) {
        portraitLines.push(`- 关键成就：${seg.key_achievements.join("、")}`);
      }
    });
  }

  // 构建知识卡部分
  let knowledgeSection = "";
  if (input.knowledge_card?.core_competencies?.irreplaceable) {
    const kLines: string[] = [];
    kLines.push("## 岗位知识卡（参考数据）");
    kLines.push("### 不可替代能力");
    input.knowledge_card.core_competencies.irreplaceable.forEach((c) => {
      kLines.push(`- ${c.capability}（${c.importance}）`);
    });
    knowledgeSection = kLines.join("\n");
  }

  // 组装 prompt
  const userPrompt = buildGenerateQuestionsPrompt(
    input.round,
    jdLines.join("\n"),
    portraitLines.join("\n"),
    knowledgeSection
  );

  // 调用 AI
  const result = await generateObject({
    model: models.mimo,
    schema: GenerateQuestionsOutputSchema,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.3,
    abortSignal: AbortSignal.timeout(60_000),
  });

  return {
    output: result.object as GenerateQuestionsOutput,
    tokenUsage:
      (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
  };
}

// ============================================================
// 从 DB 构建输入
// ============================================================

/**
 * 从数据库加载 JD 和用户画像，组装面试题生成输入
 *
 * @param jdId JD ID
 * @param userId 用户 ID
 * @param round 面试轮次
 * @returns 面试题生成输入
 */
export async function buildInterviewInput(
  jdId: string,
  userId: string,
  round: InterviewRound
): Promise<GenerateQuestionsInput> {
  // 1. 加载 JD
  const jd = await db.jobDescription.findFirst({
    where: { id: jdId, userId },
  });

  if (!jd) {
    throw new Error("JD_NOT_FOUND");
  }

  let parsedJd: ParsedJd;
  try {
    parsedJd = JSON.parse(jd.parsedJson) as ParsedJd;
  } catch {
    throw new Error("INVALID_JD_DATA");
  }

  // 2. 加载用户画像
  const portrait = await db.portrait.findUnique({
    where: { userId },
  });

  if (!portrait) {
    throw new Error("PORTRAIT_NOT_FOUND");
  }

  let portraitData: Record<string, unknown>;
  try {
    portraitData = JSON.parse(portrait.portraitJson);
  } catch {
    throw new Error("INVALID_PORTRAIT_DATA");
  }

  // 3. 尝试加载知识卡（失败不阻塞）
  let knowledgeCard: GenerateQuestionsInput["knowledge_card"];
  try {
    const positionId = inferPositionId(
      parsedJd.position,
      (portraitData.basic_info as Record<string, unknown>)?.current_role as string
    );
    if (positionId) {
      const card = loadPositionKnowledge(positionId);
      if (card) {
        knowledgeCard = {
          core_competencies: card.core_competencies,
        };
      }
    }
  } catch (e) {
    console.warn("[interview] Failed to load knowledge card:", e);
  }

  const basicInfo = (portraitData.basic_info || {}) as Record<string, unknown>;

  return {
    jd: {
      position: parsedJd.position,
      company_type: parsedJd.company_type,
      requirements: parsedJd.requirements,
      nice_to_have: parsedJd.nice_to_have,
      key_challenges: parsedJd.key_challenges,
    },
    portrait: {
      basic_info: {
        current_role: (basicInfo.current_role as string) || "",
        industry: (basicInfo.industry as string) || "",
        years_of_experience: (basicInfo.years_of_experience as number) ?? 0,
      },
      strengths: (portraitData.strengths as string[]) || [],
      gaps: (portraitData.gaps as string[]) || [],
      career_segments: portraitData.career_segments as GenerateQuestionsInput["portrait"]["career_segments"],
    },
    round,
    knowledge_card: knowledgeCard,
  };
}

// ============================================================
// 辅助函数（复用 match/analyzer.ts 的逻辑）
// ============================================================

const KEYWORD_MAP: Array<[string, string]> = [
  ["产品营销", "pmm"],
  ["客户成功", "b2b-sales"],
  ["数据分析", "data-analyst"],
  ["数据运营", "data-analyst"],
  ["PMM", "pmm"],
  ["售前", "b2b-sales"],
  ["销售", "b2b-sales"],
  ["BD", "b2b-sales"],
  ["BI", "data-analyst"],
];

function inferPositionId(jdPosition: string, currentRole?: string): string | null {
  const texts = [jdPosition, currentRole].filter(Boolean);
  for (const text of texts) {
    for (const [keyword, positionId] of KEYWORD_MAP) {
      if (text!.includes(keyword)) {
        return positionId;
      }
    }
  }
  return null;
}
