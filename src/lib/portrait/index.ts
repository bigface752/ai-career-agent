/**
 * 画像模块
 *
 * 四层架构：
 * 1. schema.ts — 类型定义和验证
 * 2. generator.ts — 职业导师 Agent 生成逻辑
 * 3. merger.ts — 模板合并（通用+定制→最终）
 * 4. index.ts — 统一导出
 */

// Schema 类型
export type {
  PortraitTemplate,
  BasePortrait,
  BasicInfo,
  CareerSegment,
  CareerSummary,
  CareerNarrative,
  CompositeProfile,
  AiCapability,
  IndustrySpecific,
} from "./schema";

export {
  PortraitTemplateSchema,
  BasePortraitSchema,
  BasicInfoSchema,
  CareerSegmentSchema,
  CareerSummarySchema,
  CareerNarrativeSchema,
  CompositeProfileSchema,
  AiCapabilitySchema,
  IndustrySpecificSchema,
  createEmptyPortrait,
  calculateCompleteness,
  mergeIndustrySpecific,
} from "./schema";

// 生成器
export type {
  GeneratePortraitParams,
  GeneratePortraitResult,
} from "./generator";

export {
  generateBasePortrait,
  mapSlotsToBasicInfo,
  mapSlotsToCareerSummary,
} from "./generator";

// 合并器
export type {
  MergePortraitParams,
  MergePortraitResult,
} from "./merger";

export { mergePortrait, savePortrait } from "./merger";
