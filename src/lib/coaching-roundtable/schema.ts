/**
 * 模块零圆桌讨论 Schema
 *
 * 4 Agent 并发 + 1 主持 Agent 综合
 * 基于 module-0-career-coaching.md 设计
 */

import { z } from "zod";

// ============================================================
// 评估等级
// ============================================================

const AssessmentLevel = z.enum(["强", "中", "弱"]);
const RiskLevel = z.enum(["低", "中", "高"]);

// ============================================================
// Agent A：职业导师输出
// ============================================================

export const CareerMentorOutputSchema = z.object({
  ceiling_analysis: z.object({
    salary_ceiling: z.string().describe("薪资天花板"),
    level_ceiling: z.string().describe("职级天花板"),
    current_position: z.string().describe("用户目前在天花板的什么位置（如60%）"),
  }).describe("天花板分析"),
  breakthrough_path: z.string().describe("突破路径：从当前位置到天花板需要经历哪些阶段"),
  key_blocker: z.string().describe("关键卡点：最难突破的是什么"),
  time_window: z.string().describe("时间窗口：哪些提升有时间敏感性"),
  team_position: z.enum(["核心骨干", "普通成员", "边缘角色"]).describe("用户在团队中的位置"),
});

export type CareerMentorOutput = z.infer<typeof CareerMentorOutputSchema>;

// ============================================================
// Agent B：猎头输出（动态生成）
// ============================================================

export const HeadhunterOutputSchema = z.object({
  market_demand: z.string().describe("该岗位在市场上的供需情况"),
  ideal_profile: z.string().describe("市场上最受欢迎的同岗位人才具备什么特质"),
  user_market_value: AssessmentLevel.describe("用户当前市场价值评估"),
  value_trend: z.enum(["上升", "平稳", "下降"]).describe("如果再做1年，市场价值趋势"),
  new_requirements: z.array(z.string()).describe("市场对该岗位的新趋势/新要求"),
});

export type HeadhunterOutput = z.infer<typeof HeadhunterOutputSchema>;

// ============================================================
// Agent C：头部企业专家输出（动态生成）
// ============================================================

export const BigTechExpertOutputSchema = z.object({
  capability_model: z.string().describe("头部企业同岗位的能力模型"),
  gap_analysis: z.string().describe("用户与头部企业同级别的差距"),
  transferable_methods: z.array(z.string()).describe("头部企业的工作方法论/思维框架，哪些可以迁移"),
  daily_rhythm: z.string().describe("头部企业同岗位的日常工作节奏和思维方式"),
});

export type BigTechExpertOutput = z.infer<typeof BigTechExpertOutputSchema>;

// ============================================================
// Agent D：AI效能专家输出
// ============================================================

export const AiExpertOutputSchema = z.object({
  ai_risk_level: RiskLevel.describe("该岗位被AI替代的风险等级"),
  ai_impact_detail: z.string().describe("该岗位正在被AI如何改变，哪些能力会被替代"),
  ai_enhancement: z.string().describe("如何利用AI提效，哪些工作流可以用AI重构"),
  recommended_tools: z.array(z.string()).min(1).max(5).describe("推荐学习的AI工具/技能"),
  future_shape: z.string().describe("未来2-3年，该岗位+AI会演变成什么形态"),
});

export type AiExpertOutput = z.infer<typeof AiExpertOutputSchema>;

// ============================================================
// 主持 Agent 综合输出
// ============================================================

export const HostSynthesisSchema = z.object({
  consensus: z.array(z.string()).min(1).describe("所有角色一致同意的提升方向"),
  disagreements: z.array(z.string()).describe("不同角色看法不一致的地方"),
  top_3_directions: z.array(z.object({
    priority: z.number().min(1).max(3),
    direction: z.string().describe("提升方向"),
    specific_actions: z.array(z.string()).min(1).describe("具体行动"),
    timeline: z.string().describe("时间线"),
    expected_outcome: z.string().describe("预期效果"),
  })).min(1).max(3).describe("Top 3 提升方向"),
  action_plan: z.object({
    month_1_3: z.string().describe("第1-3个月行动计划"),
    month_4_6: z.string().describe("第4-6个月行动计划"),
    month_7_12: z.string().describe("第7-12个月行动计划"),
  }).describe("3/6/12月行动计划"),
});

export type HostSynthesis = z.infer<typeof HostSynthesisSchema>;

// ============================================================
// 圆桌讨论完整结果
// ============================================================

export interface AgentContribution<T> {
  agent_id: string;
  output: T;
  usage: { inputTokens?: number; outputTokens?: number };
  duration_ms: number;
  success: boolean;
  error?: string;
}

export interface CoachingRoundtableResult {
  career_mentor: AgentContribution<CareerMentorOutput>;
  headhunter: AgentContribution<HeadhunterOutput>;
  bigtech_expert: AgentContribution<BigTechExpertOutput>;
  ai_expert: AgentContribution<AiExpertOutput>;
  host_synthesis: AgentContribution<HostSynthesis>;
  total_usage: { inputTokens: number; outputTokens: number };
  total_duration_ms: number;
}

// ============================================================
// 输入参数
// ============================================================

export interface CoachingRoundtableInput {
  basicInfo: {
    current_role: string;
    industry: string;
    years_of_experience: number;
    city: string;
    company?: string;
  };
  careerSummary: {
    motivation: string;
    value_ranking: string[];
    risk_tolerance: "低" | "中" | "高";
    development_goal: string;
  };
  currentWork: {
    leader_style: string;
    team_size: string;
    biggest_bottleneck: string;
    pain_point: string;
    unrealized_goal: string;
  };
  strengths: string[];
  gaps: string[];
}
