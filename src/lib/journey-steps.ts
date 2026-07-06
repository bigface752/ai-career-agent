/**
 * 旅程步骤常量
 *
 * 前后端共享的步骤定义，避免硬编码漂移
 */

/** 步骤顺序 */
export const JOURNEY_STEP_ORDER = ["intake", "diagnosis", "coaching", "complete"] as const;

/** 步骤类型 */
export type JourneyStepName = (typeof JOURNEY_STEP_ORDER)[number];

/** 步骤元数据 */
export interface StepMeta {
  name: JourneyStepName;
  label: string;
  description: string;
}

/** 步骤元数据映射 */
export const STEP_META: Record<JourneyStepName, StepMeta> = {
  intake: {
    name: "intake",
    label: "信息采集",
    description: "了解你的职业背景和现状",
  },
  diagnosis: {
    name: "diagnosis",
    label: "职业诊断",
    description: "分析你的职业画像和竞争力",
  },
  coaching: {
    name: "coaching",
    label: "行动建议",
    description: "制定具体的职业发展方案",
  },
  complete: {
    name: "complete",
    label: "完成",
    description: "查看你的职业决策报告",
  },
};

/** 获取步骤在列表中的索引 */
export function getStepIndex(step: JourneyStepName): number {
  return JOURNEY_STEP_ORDER.indexOf(step);
}

/** 判断是否是第一步 */
export function isFirstStep(step: JourneyStepName): boolean {
  return step === JOURNEY_STEP_ORDER[0];
}
