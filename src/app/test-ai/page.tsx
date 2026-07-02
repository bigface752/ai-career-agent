"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const modelOptions = [
  { key: "mimo", label: "MiMo v2.5 Pro", provider: "小米" },
  { key: "deepseek", label: "DeepSeek V4 Pro", provider: "DeepSeek" },
  { key: "qwen", label: "千问 3.7 Max", provider: "阿里云" },
  { key: "glm", label: "GLM-5.1", provider: "智谱" },
] as const;

export default function TestAIPage() {
  const [selectedModel, setSelectedModel] = useState<string>("mimo");
  const [input, setInput] = useState("你好，请用一句话介绍自己。");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTest = async () => {
    setLoading(true);
    setOutput("");
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: "user", content: input }],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setOutput((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-neutral-900 dark:text-neutral-100">
        AI 模型测试
      </h1>

      {/* 模型选择 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          选择模型
        </label>
        <div className="flex flex-wrap gap-2">
          {modelOptions.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedModel(m.key)}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                selectedModel === m.key
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700 hover:border-primary-400"
              }`}
            >
              {m.label}
              <span className="ml-1 text-xs opacity-60">({m.provider})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 输入 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          测试 Prompt
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <Button onClick={handleTest} loading={loading} disabled={!input.trim()}>
        发送测试
      </Button>

      {/* 输出 */}
      {(output || error) && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              {error ? "❌ 错误" : "✅ 流式输出"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-sm text-error">{error}</p>
            ) : (
              <pre className="text-sm whitespace-pre-wrap text-neutral-800 dark:text-neutral-200 font-mono">
                {output}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
