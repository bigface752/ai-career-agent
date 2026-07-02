/**
 * 通用流式对话 API
 * POST /api/chat
 * Body: { model: "mimo" | "deepseek" | "qwen" | "glm", messages: [...], system?: string }
 */
import { NextRequest } from "next/server";
import { streamText } from "ai";
import { models, type ModelKey } from "@/lib/ai";
import { getAuthUser } from "@/lib/middleware/auth";

export async function POST(req: NextRequest) {
  // 认证检查
  const user = await getAuthUser(req);
  if (!user) {
    return Response.json({ error: "未认证" }, { status: 401 });
  }

  const { model = "mimo", messages, system } = await req.json();

  if (!(model in models)) {
    return Response.json(
      { error: `Unknown model: ${model}. Available: ${Object.keys(models).join(", ")}` },
      { status: 400 }
    );
  }

  const result = streamText({
    model: models[model as ModelKey],
    system: system || "你是一个有帮助的 AI 助手。",
    messages,
  });

  return result.toTextStreamResponse();
}
