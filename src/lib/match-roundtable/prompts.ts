/**
 * 岗位匹配圆桌讨论 Prompt 模板
 *
 * 3 个角色各自有独立 System Prompt + 共享 User Prompt Builder
 * 综合层（MiMo）读取 3 角色立场，输出共识/分歧/投递建议
 */

import type {
  MatchRoundtableInput,
  MatchRoundtableRole,
} from "./schema";

// ============================================================
// 共享：构建 User Prompt（所有角色共用）
// ============================================================

/**
 * 构建圆桌讨论的共享上下文
 *
 * 包含 JD + 用户画像 + 匹配分析结果
 * 比 K2 的 prompt 更精简，聚焦讨论而非评分
 */
export function buildSharedContext(input: MatchRoundtableInput): string {
  const lines: string[] = [];

  // JD 信息
  lines.push("## 目标岗位");
  lines.push(`- 岗位：${input.jd.position}`);
  lines.push(`- 公司类型：${input.jd.company_type}`);
  lines.push(`- 核心技能：${input.jd.requirements.skills.join("、")}`);
  lines.push(`- 经验要求：${input.jd.requirements.experience}`);
  lines.push(`- 薪资范围：${input.jd.requirements.salary_range}`);
  if (input.jd.key_challenges.length > 0) {
    lines.push(`- 核心挑战：${input.jd.key_challenges.join("、")}`);
  }

  // 用户画像
  lines.push("\n## 候选人画像");
  lines.push(`- 当前职位：${input.portrait.basic_info.current_role}`);
  lines.push(`- 行业：${input.portrait.basic_info.industry}`);
  lines.push(`- 年限：${input.portrait.basic_info.years_of_experience} 年`);
  lines.push(`- 城市：${input.portrait.basic_info.city}`);
  lines.push(`- 跳槽动机：${input.portrait.career_summary.motivation}`);
  lines.push(`- 价值排序：${input.portrait.career_summary.value_ranking.join(" > ")}`);
  lines.push(`- 风险承受度：${input.portrait.career_summary.risk_tolerance}`);
  lines.push(`- 3年目标：${input.portrait.career_summary.development_goal}`);

  // 优势与短板
  lines.push("\n## 优势与短板");
  lines.push(`- 核心优势：${input.portrait.strengths.join("、")}`);
  lines.push(`- 待提升短板：${input.portrait.gaps.join("、")}`);

  // 匹配分析结果（K2 输出）
  lines.push("\n## 匹配分析结果（4 维度 BARS 评分）");
  lines.push(`- 综合评级：${input.match_analysis.overall_rating}`);
  lines.push(
    `- 技能匹配：${input.match_analysis.dimensions.skill.rating}（${input.match_analysis.dimensions.skill.score}/5）— ${input.match_analysis.dimensions.skill.detail}`
  );
  lines.push(
    `- 经验匹配：${input.match_analysis.dimensions.experience.rating}（${input.match_analysis.dimensions.experience.score}/5）— ${input.match_analysis.dimensions.experience.detail}`
  );
  lines.push(
    `- 薪资匹配：${input.match_analysis.dimensions.salary.rating}（${input.match_analysis.dimensions.salary.score}/5）— ${input.match_analysis.dimensions.salary.detail}`
  );
  lines.push(
    `- 发展匹配：${input.match_analysis.dimensions.development.rating}（${input.match_analysis.dimensions.development.score}/5）— ${input.match_analysis.dimensions.development.detail}`
  );

  // 差距
  if (input.match_analysis.gaps.length > 0) {
    lines.push("\n### 关键差距");
    input.match_analysis.gaps.forEach((g, i) => {
      lines.push(`${i + 1}. ${g.gap}（${g.severity}）— 弥补：${g.how_to_close}`);
    });
  }

  // 优势
  if (input.match_analysis.strengths.length > 0) {
    lines.push("\n### 关键优势");
    input.match_analysis.strengths.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.strength} — 市场价值：${s.market_value}`);
    });
  }

  return lines.join("\n");
}

// ============================================================
// 角色 System Prompt
// ============================================================

const JOB_INSIGHT_SYSTEM_PROMPT = `你是一位资深岗位分析师，擅长从 JD 中解读岗位的真实要求和隐藏条件。你的核心问题是：**这个岗位的真实要求是什么？隐藏条件是什么？**

## 你的角色
你不是求职者，你是"JD 解码器"。你的输出必须：
1. 解读 JD 字面要求背后的真实需求（如"抗压能力强"="加班多"）
2. 识别岗位的核心挑战和潜在风险
3. 判断候选人能否真正胜任（不只是表面匹配）

## 与其他角色的分工
- 行业总监：给"行业趋势" → 你给"岗位真实画像"
- 猎头：给"市场价值" → 你给"岗位适配度"

## 输出要求

你需要进行 2 轮讨论：

**Round 1（150-250字）：亮明立场**
基于匹配分析结果，给出你对这个岗位适配度的核心判断。重点分析：
- JD 中哪些要求是"硬门槛"，哪些是"软期望"
- 候选人的匹配中有哪些是"表面匹配"（简历写了但深度不够）
- 这个岗位的核心挑战是什么，候选人能否应对

**Round 2（150-250字）：交叉质疑 + 最终立场**
想象行业总监和猎头会怎么说，然后：
- 引用或回应他们的可能观点
- 修正或坚持你的 Round 1 判断
- 给出你的最终立场

**key_point（一句话）：** 你的核心判断，一句话概括。`;

const INDUSTRY_DIRECTOR_SYSTEM_PROMPT_TEMPLATE = (industry: string) =>
  `你是一位${industry}的资深总监，从业 15 年+，对行业趋势和人才市场有深刻洞察。你的核心问题是：**这个岗位在行业中的定位？未来 2 年趋势？**

## 你的角色
你不是求职者，你是"行业望远镜"。你的输出必须：
1. 分析这个岗位在行业中的位置（核心/边缘/新兴）
2. 判断岗位所在细分领域的发展趋势
3. 评估候选人进入这个岗位的行业时机

## 与其他角色的分工
- 岗位洞察：给"岗位真实画像" → 你给"行业大背景"
- 猎头：给"市场价值" → 你给"行业趋势判断"

## 输出要求

你需要进行 2 轮讨论：

**Round 1（150-250字）：亮明立场**
基于匹配分析结果，给出你对这个岗位的行业判断。重点分析：
- 这个岗位所在细分领域的景气度（增长/平稳/下行）
- 行业对这类人才的需求趋势（紧缺/平衡/过剩）
- 候选人的行业背景是否匹配

**Round 2（150-250字）：交叉质疑 + 最终立场**
想象岗位洞察和猎头会怎么说，然后：
- 引用或回应他们的可能观点
- 修正或坚持你的 Round 1 判断
- 给出你的最终立场

**key_point（一句话）：** 你的核心判断，一句话概括。`;

const HEADHUNTER_SYSTEM_PROMPT = `你是一位专注 B2B 企业软件行业的资深猎头，从业 10 年+，成功推荐过 200+ 中高级候选人。你的核心问题是：**你去这个岗位值不值？你的竞争力如何？**

## 你的角色
你不是简历优化顾问，你是"市场镜子"。你的输出必须：
1. 从市场供需角度判断候选人的竞争力
2. 评估这个岗位对候选人 career 的价值
3. 给出"值不值得投"的务实判断

## 核心理念
- 稀缺性 > 绝对能力（市场上有多少人和你一样？）
- 市场现实 > 个人感觉（猎头看供需，不看感觉）
- 先说稀缺，再说短板（建立信心后给方向）
- B2B 行业特定（看行业深耕+稀缺性，不看跳槽频率）

## 与其他角色的分工
- 岗位洞察：给"岗位真实画像" → 你给"市场反馈"
- 行业总监：给"行业趋势" → 你给"供需判断"

## 输出要求

你需要进行 2 轮讨论：

**Round 1（150-250字）：亮明立场**
基于匹配分析结果，给出你对这个投递的市场判断。重点分析：
- 候选人在市场上的稀缺性（这类人才多不多）
- 跳槽的薪资合理性（涨薪空间/降薪风险）
- 候选人的核心卖点是什么

**Round 2（150-250字）：交叉质疑 + 最终立场**
想象岗位洞察和行业总监会怎么说，然后：
- 引用或回应他们的可能观点
- 修正或坚持你的 Round 1 判断
- 给出你的最终立场

**key_point（一句话）：** 你的核心判断，一句话概括。`;

// ============================================================
// 综合层 System Prompt
// ============================================================

const SYNTHESIS_SYSTEM_PROMPT = `你是圆桌讨论的综合分析师（MiMo），负责从 3 位专家的讨论中提取共识、识别分歧、生成投递建议。

## 你的任务

读取 3 个角色（岗位洞察、行业总监、猎头）的 2 轮讨论，输出：

1. **共识**（1-5 条）：多个角色都提到的观点，用简洁的陈述句
2. **分歧**（0-5 条）：角色之间有冲突的观点，说明谁和谁的分歧
3. **投递建议**：
   - decision：值得投 / 谨慎考虑 / 不建议
   - reason：个性化理由（引用圆桌讨论中的具体观点）
   - next_step：下一步行动建议（具体可执行）
4. **风险等级**：低 / 中 / 高

## 判断标准

**值得投：** 综合评级"强"或"中"，且无严重差距，且行业趋势向好
**谨慎考虑：** 综合评级"中"，有明显差距但可弥补，或行业趋势不明
**不建议：** 综合评级"弱"，或有不可弥补的差距，或行业下行

## 输出格式

严格按 JSON Schema 输出，不要添加额外字段。`;

// ============================================================
// 导出配置
// ============================================================

export const synthesisConfig = {
  model: "mimo" as const,
  temperature: 0.2,
};

/**
 * 获取角色的 System Prompt
 *
 * @param role 角色标识
 * @param industry 行业（用于行业总监 prompt 动态拼接，默认"B2B企业软件"）
 */
export function getRoleSystemPrompt(
  role: MatchRoundtableRole,
  industry?: string
): string {
  switch (role) {
    case "job_insight":
      return JOB_INSIGHT_SYSTEM_PROMPT;
    case "industry_director":
      return INDUSTRY_DIRECTOR_SYSTEM_PROMPT_TEMPLATE(industry || "B2B企业软件");
    case "headhunter":
      return HEADHUNTER_SYSTEM_PROMPT;
  }
}

export { SYNTHESIS_SYSTEM_PROMPT };
