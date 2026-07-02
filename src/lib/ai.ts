/**
 * AI 模型配置
 * 所有模型均使用 OpenAI 兼容 API
 */
import { createOpenAI } from "@ai-sdk/openai";

// 模型提供商配置
export const providers = {
  mimo: createOpenAI({
    baseURL: "https://api.xiaomimimo.com/v1",
    apiKey: process.env.MIMO_API_KEY!,
  }),
  deepseek: createOpenAI({
    baseURL: "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY!,
  }),
  dashscope: createOpenAI({
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: process.env.DASHSCOPE_API_KEY!,
  }),
  glm: createOpenAI({
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    apiKey: process.env.GLM_API_KEY!,
  }),
};

// 具体模型实例
export const models = {
  mimo: providers.mimo("mimo-v2.5-pro"),
  deepseek: providers.deepseek("deepseek-v4-pro"),
  qwen: providers.dashscope("qwen3.7-max"),
  glm: providers.glm("GLM-5.1"),
};

// 模型信息（用于 UI 展示和日志）
export const modelInfo = {
  mimo: { name: "MiMo v2.5 Pro", provider: "小米" },
  deepseek: { name: "DeepSeek V4 Pro", provider: "DeepSeek" },
  qwen: { name: "千问 3.7 Max", provider: "阿里云" },
  glm: { name: "GLM-5.1", provider: "智谱" },
} as const;

export type ModelKey = keyof typeof models;
