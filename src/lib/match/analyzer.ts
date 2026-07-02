/**
 * 岗位匹配分析器
 *
 * 职责：JD 解析结果 + 用户画像 → 4 维度 BARS 匹配分析
 * 模式：generateObject + Zod（复用 E1 的 generateObject 模式）
 *
 * 与 E1 竞争力评估的区别：
 * - E1 是 5 Agent × 3 次共识（重量级，评估"你在市场上值多少"）
 * - K2 是单次 generateObject（轻量级，评估"你和这个岗位匹配多少"）
 * - K2 聚焦特定 JD，E1 聚焦市场定位
 */

import { generateObject } from "ai";
import { models } from "@/lib/ai";
import { db } from "@/lib/db";
import { loadPositionKnowledge } from "@/lib/knowledge/loader";
import { MatchAnalysisSchema, type MatchAnalysis, type MatchAnalysisInput } from "./schema";
import type { ParsedJd } from "@/lib/jd/schema";

// ============================================================
// BARS 锚定描述（4 维度）
// ============================================================

const MATCH_BARS_RUBRIC = `
## BARS 锚定评分标准

### 技能匹配（权重 0.35）
说明：用户技能与 JD 核心技能要求的匹配程度
| 评级 | 分数 | 行为锚定 |
|------|------|---------|
| 弱 | 1 | 核心技能缺失 3+ 项，需要大量学习才能胜任 |
| 中 | 3 | 核心技能匹配 60-80%，缺少 1-2 项但可快速补齐 |
| 强 | 5 | 核心技能高度匹配，且有 JD 未要求的加分技能 |

### 经验匹配（权重 0.30）
说明：用户工作经验与 JD 经验要求的匹配程度
| 评级 | 分数 | 行为锚定 |
|------|------|---------|
| 弱 | 1 | 经验年限不足或行业/岗位跨度大，无代表性项目 |
| 中 | 3 | 年限基本达标，有相关项目但深度或规模一般 |
| 强 | 5 | 经验超出要求，有高相关度的代表性项目和量化成果 |

### 薪资匹配（权重 0.15）
说明：用户当前薪资与 JD 薪资范围的匹配程度
| 评级 | 分数 | 行为锚定 |
|------|------|---------|
| 弱 | 1 | 用户薪资远高于 JD 范围上限，跳槽大概率降薪 |
| 中 | 3 | 用户薪资在 JD 范围内，涨降薪空间有限 |
| 强 | 5 | 用户薪资低于 JD 范围下限，跳槽有显著涨薪空间 |

### 发展匹配（权重 0.20）
说明：JD 岗位的发展前景与用户职业目标的匹配程度
| 评级 | 分数 | 行为锚定 |
|------|------|---------|
| 弱 | 1 | 岗位发展方向与用户目标背离，或岗位天花板低 |
| 中 | 3 | 岗位发展与用户目标部分一致，有成长空间但有限 |
| 强 | 5 | 岗位发展与用户目标高度一致，有清晰的上升路径 |
`;

// ============================================================
// System Prompt
// ============================================================

const SYSTEM_PROMPT = `你是一位专注 B2B 企业软件行业的职业匹配分析师。你的核心任务是：**评估用户与特定岗位的匹配程度，找出差距和优势，给出简历优化建议**。

## 你的角色
你不是万能的职业顾问，你是"岗位匹配仪"。你的输出必须：
1. 基于证据（每个判断都要有依据，从 JD 和用户画像中提取）
2. 可执行（差距要有弥补方案，优势要说明市场价值）
3. 聚焦匹配（不做泛泛的职业建议，只评估"你 vs 这个岗位"）

${MATCH_BARS_RUBRIC}

## 评估流程（强制执行）

**Step 1: 证据收集**
从 JD 和用户画像中提取匹配/不匹配的关键事实。

**Step 2: 维度评分（BARS 锚定 + CoT）**
对每个维度：
1. 先对照 BARS 锚定描述，找到最匹配的等级
2. 给 1-5 分
3. 写详细分析（20-500字）

**Step 3: 综合评级**
- 综合分 = 技能×0.35 + 经验×0.30 + 薪资×0.15 + 发展×0.20
- 综合分 ≥ 0.75 → 强；0.45 ≤ 综合分 < 0.75 → 中；综合分 < 0.45 → 弱

**Step 4: 差距分析**
找出 1-5 个关键差距，按严重程度降序，每个都要有弥补方案。

**Step 5: 优势分析**
找出 1-5 个关键优势，按市场价值降序，每个都要说明市场价值。

**Step 6: 简历优化建议**
给出 1-5 条简历优化建议，按优先级降序。

## 输出格式（JSON）

严格按以下结构输出，不要添加额外字段：

{
  "overall_rating": "强/中/弱",
  "overall_score": 0.0-1.0,
  "dimensions": {
    "skill": {"name": "技能匹配", "rating": "强/中/弱", "score": 1-5, "detail": "详细分析"},
    "experience": {"name": "经验匹配", "rating": "强/中/弱", "score": 1-5, "detail": "详细分析"},
    "salary": {"name": "薪资匹配", "rating": "强/中/弱", "score": 1-5, "detail": "详细分析"},
    "development": {"name": "发展匹配", "rating": "强/中/弱", "score": 1-5, "detail": "详细分析"}
  },
  "gaps": [{"gap": "差距描述", "severity": "大/中/小", "how_to_close": "如何弥补"}],
  "strengths": [{"strength": "优势描述", "market_value": "市场价值说明"}],
  "resume_optimization": [{"priority": 1, "section": "简历板块", "what": "改什么", "how": "怎么改", "why": "为什么改"}]
}

## 红线
- ❌ 不能给没有证据的分数
- ❌ 不能泛泛而谈（"建议提升技能"这种废话）
- ❌ 不能忽略 JD 中的具体要求
- ✅ 每个判断都要有从 JD 或用户画像中提取的具体证据
- ✅ 差距弥补方案要具体可执行
- ✅ 简历优化建议要具体到板块和内容`;

// ============================================================
// 维度 key 映射（内部英文 → API 中文）
// ============================================================

const DIMENSION_KEY_MAP: Record<string, string> = {
  skill: "技能匹配",
  experience: "经验匹配",
  salary: "薪资匹配",
  development: "发展匹配",
};

/**
 * 将内部英文维度 key 映射为 API 响应的中文 key
 */
export function mapDimensionKey(englishKey: string): string {
  return DIMENSION_KEY_MAP[englishKey] ?? englishKey;
}

// ============================================================
// 构建 User Prompt
// ============================================================

function buildUserPrompt(input: MatchAnalysisInput): string {
  const lines: string[] = [];

  // JD 信息
  lines.push("## 目标岗位 JD");
  lines.push(`- 岗位：${input.jd.position}`);
  lines.push(`- 公司类型：${input.jd.company_type}`);
  lines.push(`- 核心技能要求：${input.jd.requirements.skills.join("、")}`);
  lines.push(`- 经验要求：${input.jd.requirements.experience}`);
  lines.push(`- 学历要求：${input.jd.requirements.education}`);
  lines.push(`- 薪资范围：${input.jd.requirements.salary_range}`);
  lines.push(`- 工作地点：${input.jd.requirements.location}`);
  if (input.jd.nice_to_have.length > 0) {
    lines.push(`- 加分项：${input.jd.nice_to_have.join("、")}`);
  }
  if (input.jd.key_challenges.length > 0) {
    lines.push(`- 岗位核心挑战：${input.jd.key_challenges.join("、")}`);
  }

  // 用户画像
  lines.push("\n## 用户画像");
  lines.push(`- 当前职位：${input.portrait.basic_info.current_role}`);
  lines.push(`- 行业：${input.portrait.basic_info.industry}`);
  lines.push(`- 工作年限：${input.portrait.basic_info.years_of_experience} 年`);
  lines.push(`- 城市：${input.portrait.basic_info.city}`);
  if (input.portrait.basic_info.company) {
    lines.push(`- 公司：${input.portrait.basic_info.company}`);
  }

  lines.push("\n## 职业摘要");
  lines.push(`- 跳槽动机：${input.portrait.career_summary.motivation}`);
  lines.push(`- 价值排序：${input.portrait.career_summary.value_ranking.join(" > ")}`);
  lines.push(`- 风险承受度：${input.portrait.career_summary.risk_tolerance}`);
  lines.push(`- 3年目标：${input.portrait.career_summary.development_goal}`);

  lines.push("\n## 优势与短板");
  lines.push(`- 核心优势：${input.portrait.strengths.join("、")}`);
  lines.push(`- 待提升短板：${input.portrait.gaps.join("、")}`);

  // 多段经历
  if (input.portrait.career_segments && input.portrait.career_segments.length > 0) {
    lines.push("\n## 职业经历");
    input.portrait.career_segments.forEach((seg, i) => {
      lines.push(`### 经历 ${i + 1}：${seg.company}（${seg.duration_years}年）`);
      lines.push(`- 岗位：${seg.position_id}`);
      lines.push(`- 行业：${seg.industry}`);
      lines.push(`- 核心技能：${seg.key_skills.join("、")}`);
      if (seg.key_achievements.length > 0) {
        lines.push(`- 关键成就：${seg.key_achievements.join("、")}`);
      }
    });
  }

  // 知识卡数据
  if (input.knowledge_card) {
    lines.push("\n## 岗位知识卡（参考数据）");
    if (input.knowledge_card.core_competencies) {
      const irreplaceable = input.knowledge_card.core_competencies.irreplaceable;
      if (irreplaceable && irreplaceable.length > 0) {
        lines.push("### 不可替代能力");
        irreplaceable.forEach((c) => {
          lines.push(`- ${c.capability}（${c.importance}）`);
        });
      }
    }
  }

  lines.push("\n---");
  lines.push("## 你的任务");
  lines.push("请基于以上 JD 和用户画像，评估用户与该岗位的匹配程度。");
  lines.push("1. 对 4 个维度逐一评分（先对照 BARS 锚定，再给分和分析）");
  lines.push("2. 找出关键差距（1-5 个）和弥补方案");
  lines.push("3. 找出关键优势（1-5 个）和市场价值");
  lines.push("4. 给出简历优化建议（1-5 条）");

  return lines.join("\n");
}

// ============================================================
// 核心分析函数
// ============================================================

export interface MatchAnalysisResult {
  analysis: MatchAnalysis;
  tokenUsage: number;
}

/**
 * 运行匹配分析
 *
 * @param input 匹配分析输入（JD + 画像 + 知识卡）
 * @returns 结构化匹配分析结果 + token 使用量
 */
export async function analyzeMatch(input: MatchAnalysisInput): Promise<MatchAnalysisResult> {
  const result = await generateObject({
    model: models.mimo,
    schema: MatchAnalysisSchema,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(input),
    temperature: 0.2,
    abortSignal: AbortSignal.timeout(60_000),
  });

  return {
    analysis: result.object as MatchAnalysis,
    tokenUsage: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
  };
}

// ============================================================
// 从 DB 构建输入
// ============================================================

/**
 * 从数据库加载 JD 和用户画像，组装匹配分析输入
 *
 * @param jdId JD ID
 * @param userId 用户 ID
 * @returns 匹配分析输入
 * @throws JD 不存在或不属于该用户
 */
export async function buildMatchInput(
  jdId: string,
  userId: string
): Promise<MatchAnalysisInput> {
  // 1. 加载 JD（用 findFirst 因为 id+userId 组合无唯一约束）
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
  let knowledgeCard: MatchAnalysisInput["knowledge_card"];
  try {
    const positionId = inferPositionId(parsedJd.position, (portraitData.basic_info as Record<string, unknown>)?.current_role as string);
    if (positionId) {
      const card = loadPositionKnowledge(positionId);
      if (card) {
        knowledgeCard = {
          core_competencies: card.core_competencies,
          salary: card.salary,
        };
      }
    }
  } catch (e) {
    console.warn("[match] Failed to load knowledge card:", e);
  }

  const basicInfo = (portraitData.basic_info || {}) as Record<string, unknown>;
  const careerSummary = (portraitData.career_summary || {}) as Record<string, unknown>;

  return {
    jd: parsedJd,
    portrait: {
      basic_info: {
        current_role: (basicInfo.current_role as string) || "",
        industry: (basicInfo.industry as string) || "",
        years_of_experience: (basicInfo.years_of_experience as number) || 0,
        city: (basicInfo.city as string) || "",
        company: basicInfo.company as string | undefined,
      },
      career_summary: {
        motivation: (careerSummary.motivation as string) || "",
        value_ranking: (careerSummary.value_ranking as string[]) || [],
        risk_tolerance: (careerSummary.risk_tolerance as "低" | "中" | "高") || "中",
        life_constraints: (careerSummary.life_constraints as string) || "",
        development_goal: (careerSummary.development_goal as string) || "",
      },
      strengths: (portraitData.strengths as string[]) || [],
      gaps: (portraitData.gaps as string[]) || [],
      career_segments: portraitData.career_segments as MatchAnalysisInput["portrait"]["career_segments"],
    },
    knowledge_card: knowledgeCard,
  };
}

// ============================================================
// 辅助函数
// ============================================================

// 中文关键词 → position_id 映射（按长度降序，避免短关键词误命中）
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

/**
 * 从 JD 岗位名或用户当前职位推断 position_id
 * 优先匹配长关键词，避免"数据产品经理"误命中"数据分析"
 */
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
