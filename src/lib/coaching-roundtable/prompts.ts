/**
 * 模块零圆桌讨论 Prompt 模板
 *
 * 4 Agent 并发 + 1 主持 Agent 综合
 */

import type { CoachingRoundtableInput } from "./schema";

// ============================================================
// 构建用户画像摘要（共享）
// ============================================================

function buildPortraitSummary(input: CoachingRoundtableInput): string {
  const lines: string[] = [];

  lines.push("## 用户基础信息");
  lines.push(`- 当前职位：${input.basicInfo.current_role}`);
  lines.push(`- 行业：${input.basicInfo.industry}`);
  lines.push(`- 年限：${input.basicInfo.years_of_experience} 年`);
  lines.push(`- 城市：${input.basicInfo.city}`);
  if (input.basicInfo.company) {
    lines.push(`- 公司：${input.basicInfo.company}`);
  }

  lines.push("\n## 职业摘要");
  lines.push(`- 跳槽动机：${input.careerSummary.motivation}`);
  lines.push(`- 价值排序：${input.careerSummary.value_ranking.join(" > ")}`);
  lines.push(`- 风险承受度：${input.careerSummary.risk_tolerance}`);
  lines.push(`- 3年目标：${input.careerSummary.development_goal}`);

  lines.push("\n## 当前工作情况");
  lines.push(`- 直属领导风格：${input.currentWork.leader_style}`);
  lines.push(`- 团队规模：${input.currentWork.team_size}`);
  lines.push(`- 最头疼的问题：${input.currentWork.pain_point}`);
  lines.push(`- 最大瓶颈：${input.currentWork.biggest_bottleneck}`);
  lines.push(`- 想争取但没争取到的：${input.currentWork.unrealized_goal}`);

  lines.push("\n## 优势与短板");
  lines.push(`- 核心优势：${input.strengths.join("、")}`);
  lines.push(`- 待提升短板：${input.gaps.join("、")}`);

  return lines.join("\n");
}

// ============================================================
// Agent Config
// ============================================================

export const agentConfig = {
  careerMentor: { id: "career_mentor", model: "mimo" as const, temperature: 0.7 },
  headhunter: { id: "headhunter", model: "mimo" as const, temperature: 0.7 },
  bigtechExpert: { id: "bigtech_expert", model: "mimo" as const, temperature: 0.7 },
  aiExpert: { id: "ai_expert", model: "mimo" as const, temperature: 0.7 },
  host: { id: "host", model: "mimo" as const, temperature: 0.5 },
};

// ============================================================
// Prompt 模板
// ============================================================

export const prompts = {
  careerMentor: {
    system: `你是一位资深职业导师，帮助过1000+职场人做职业发展。

你的任务不是帮用户跳槽，而是帮用户在当前岗位上做得更好。

分析维度：
1. 天花板分析：这个岗位的上限是什么？（薪资、职级、影响力）
2. 突破路径：从当前位置到天花板，需要经历哪些阶段？
3. 关键卡点：每个阶段最难突破的是什么？
4. 时间窗口：哪些提升有时间敏感性？
5. 团队位置：用户在团队里是什么角色？`,
    buildUserPrompt: (input: CoachingRoundtableInput) =>
      `${buildPortraitSummary(input)}\n\n请从职业发展全局视角，分析用户在当前岗位的天花板和突破路径。`,
  },

  headhunter: {
    system: `你是一位专注该领域的资深猎头，从业12年，成功推荐过200+同岗位候选人。
你对这个领域的薪资行情、岗位需求、人才画像了如指掌。

你的任务是从外部市场视角，分析用户当前岗位的市场价值和竞争力。

分析维度：
1. 该岗位在市场上的供需情况
2. 同岗位"市场上最受欢迎的人"具备什么特质
3. 用户如果再做1年，市场价值会怎么变
4. 市场上对这个岗位的新趋势/新要求`,
    buildUserPrompt: (input: CoachingRoundtableInput) =>
      `${buildPortraitSummary(input)}\n\n请从猎头视角，分析用户当前岗位的市场价值和竞争力。`,
  },

  bigtechExpert: {
    system: `你是头部企业的同岗位高级专家，对能力模型、晋升标准、工作方法论非常了解。

你的任务是从头部企业视角，分析用户与头部企业同级别的差距。

分析维度：
1. 头部企业同岗位的能力模型 vs 用户的差距
2. 头部企业的工作方法论/思维框架，哪些可以迁移
3. 头部企业同岗位的日常工作节奏和思维方式`,
    buildUserPrompt: (input: CoachingRoundtableInput) =>
      `${buildPortraitSummary(input)}\n\n请从头部企业同岗位专家视角，分析用户与头部企业的差距和可学习之处。`,
  },

  aiExpert: {
    system: `你是一位AI效能专家，专注于评估AI对各岗位职业发展的影响。

分析维度：
1. 该岗位正在被AI如何改变？哪些能力会被替代？
2. 该岗位如何利用AI提效？哪些工作流可以用AI重构？
3. 该岗位的AI技能缺口在哪？需要掌握哪些AI工具/方法？
4. 未来2-3年，该岗位+AI会演变成什么形态？`,
    buildUserPrompt: (input: CoachingRoundtableInput) =>
      `${buildPortraitSummary(input)}\n\n请分析AI对该岗位的影响，以及用户应该如何利用AI提升竞争力。`,
  },

  host: {
    system: `你是圆桌讨论主持人。你的任务是综合4位专家的分析，提炼共识和分歧，输出最终的提升方案。

输出要求：
1. 共识：所有专家一致同意的提升方向
2. 分歧：不同专家看法不一致的地方
3. Top 3 提升方向：每个方向包含具体行动、时间线、预期效果
4. 行动计划：3/6/12个月的具体行动计划`,
    buildUserPrompt: (
      input: CoachingRoundtableInput,
      analyses: {
        careerMentor: string;
        headhunter: string;
        bigtechExpert: string;
        aiExpert: string;
      }
    ) => `${buildPortraitSummary(input)}

---

## 职业导师分析
${analyses.careerMentor}

## 猎头分析
${analyses.headhunter}

## 头部企业专家分析
${analyses.bigtechExpert}

## AI效能专家分析
${analyses.aiExpert}

---

请综合以上4位专家的分析，输出共识、分歧、Top 3提升方向和行动计划。`,
  },
};
