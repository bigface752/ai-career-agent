"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { useDialogue } from "@/hooks/useDialogue";
import type { ChatMessage } from "@/hooks/useDialogue";

// ============================================================
// Types
// ============================================================

type CoachingStep = "dialogue" | "roundtable" | "report";

interface RoundtableResult {
  participants: Array<{
    role: string;
    [key: string]: unknown;
  }>;
  consensus: string[];
  disagreements: string[];
  recommendation: {
    top_3_directions: Array<{
      priority: number;
      direction: string;
      specific_actions: string[];
      timeline: string;
      expected_outcome: string;
    }>;
    action_plan: {
      month_1_3: string;
      month_4_6: string;
      month_7_12: string;
    };
  };
}

// ============================================================
// Main Page
// ============================================================

export default function CoachingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <Navbar badge="模块零 · 当前工作辅导" />
      <CoachingFlow />
    </div>
  );
}

// ============================================================
// Coaching Flow
// ============================================================

function CoachingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<CoachingStep>("dialogue");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);

  // 圆桌数据
  const [roundtable, setRoundtable] = useState<RoundtableResult | null>(null);
  const [roundtableLoading, setRoundtableLoading] = useState(false);
  const [roundtableError, setRoundtableError] = useState<string | null>(null);

  // ============================================================
  // Step 1: 启动 coaching 会话
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    async function startCoaching() {
      try {
        const res = await fetch("/api/coaching/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (cancelled) return;

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "启动失败");
        }

        const data = await res.json();
        setSessionId(data.sessionId);
      } catch (err) {
        if (!cancelled) {
          setStartError(err instanceof Error ? err.message : "启动失败");
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    startCoaching();
    return () => { cancelled = true; };
  }, []);

  // ============================================================
  // Step 2: 对话完成 → 触发圆桌
  // ============================================================

  const handleDialogueComplete = useCallback(async () => {
    if (!sessionId) return;
    setRoundtableLoading(true);
    setRoundtableError(null);

    try {
      // 先完成对话，更新 portrait
      await fetch("/api/coaching/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      // 触发圆桌讨论
      const res = await fetch("/api/coaching/roundtable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "圆桌讨论失败");
      }

      const data = await res.json();
      setRoundtable(data.result);
      setStep("roundtable");
    } catch (err) {
      setRoundtableError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setRoundtableLoading(false);
    }
  }, [sessionId]);

  // ============================================================
  // Render
  // ============================================================

  if (starting) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-neutral-500 dark:text-neutral-400">正在准备对话...</p>
      </div>
    );
  }

  if (startError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-red-500 mb-4">{startError}</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg"
        >
          返回首页
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* 步骤指示器 */}
      <StepIndicator current={step} />

      {step === "dialogue" && sessionId && (
        <DialogueStep
          sessionId={sessionId}
          onComplete={handleDialogueComplete}
          loading={roundtableLoading}
          error={roundtableError}
        />
      )}

      {step === "roundtable" && roundtable && (
        <RoundtableStep
          result={roundtable}
          onViewReport={() => setStep("report")}
        />
      )}

      {step === "report" && roundtable && (
        <ReportStep result={roundtable} />
      )}
    </div>
  );
}

// ============================================================
// Step Indicator
// ============================================================

function StepIndicator({ current }: { current: CoachingStep }) {
  const steps: Array<{ key: CoachingStep; label: string }> = [
    { key: "dialogue", label: "补充信息" },
    { key: "roundtable", label: "圆桌讨论" },
    { key: "report", label: "提升方案" },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              current === s.key
                ? "bg-primary-600 text-white"
                : steps.findIndex((step) => step.key === current) > i
                  ? "bg-emerald-500 text-white"
                  : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"
            }`}
          >
            {steps.findIndex((step) => step.key === current) > i ? "✓" : i + 1}
          </div>
          <span
            className={`text-sm ${
              current === s.key
                ? "font-medium text-neutral-900 dark:text-neutral-100"
                : "text-neutral-400"
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div className="w-8 h-px bg-neutral-200 dark:bg-neutral-800" />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Step 1: Dialogue
// ============================================================

function DialogueStep({
  sessionId,
  onComplete,
  loading,
  error,
}: {
  sessionId: string;
  onComplete: () => void;
  loading: boolean;
  error: string | null;
}) {
  const {
    messages,
    setMessages,
    session,
    setSession,
    sendMessage,
    isLoading,
    isStreaming,
    streamedText,
    error: dialogueError,
    setError,
  } = useDialogue();

  const [input, setInput] = useState("");
  const [initialized, setInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 初始化会话
  useEffect(() => {
    if (initialized) return;

    async function init() {
      try {
        const res = await fetch(`/api/dialogue/status?coaching=true&sessionId=${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.session) {
            setSession({
              sessionId: data.session.id,
              status: data.session.status,
              roundNumber: data.session.roundNumber,
              filledCount: data.session.filledCount || 0,
              requiredCount: data.session.requiredCount || 5,
              pendingSlots: data.session.pendingSlots || [],
            });
            if (data.messages) {
              setMessages(data.messages.map((m: { role: string; content: string; createdAt: string }, i: number) => ({
                id: `msg-${i}`,
                role: m.role as "user" | "assistant",
                content: m.content,
                timestamp: new Date(m.createdAt).getTime(),
              })));
            }
          }
        }
      } catch {
        // 新会话，无历史消息
      }
      setInitialized(true);
    }

    init();
  }, [sessionId, initialized, setSession, setMessages]);

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamedText]);

  // 发送消息
  const handleSend = async () => {
    const content = input.trim();
    if (!content || isLoading || isStreaming) return;

    setInput("");
    setError(null);

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    await sendMessage(content);
  };

  // 判断对话是否可以结束（至少 3 轮）
  const canComplete = (session?.roundNumber || 0) >= 3;

  return (
    <div className="space-y-4">
      {/* 对话区域 */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="h-[400px] overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-4xl mb-4">💬</p>
              <p className="text-neutral-500 dark:text-neutral-400">
                我需要了解你当前的工作情况，帮你梳理提升方向。
              </p>
              <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-2">
                3-5 轮对话即可完成
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary-600 text-white rounded-br-md"
                    : "bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isStreaming && streamedText && (
            <div className="flex justify-start">
              <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-neutral-100 dark:bg-neutral-900 text-sm text-neutral-800 dark:text-neutral-200">
                {streamedText}
                <span className="inline-block w-1.5 h-4 bg-neutral-400 animate-pulse ml-0.5" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 p-3">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入你的回答..."
              rows={1}
              className="flex-1 resize-none rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={isLoading || isStreaming}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isStreaming}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              发送
            </button>
          </div>
        </div>
      </div>

      {/* 进度 */}
      {session && (
        <div className="text-center text-xs text-neutral-400 dark:text-neutral-500">
          第 {session.roundNumber} 轮 · 已收集 {session.filledCount}/{session.requiredCount} 项信息
        </div>
      )}

      {/* 错误 */}
      {(dialogueError || error) && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">
            {dialogueError || error}
          </p>
        </div>
      )}

      {/* 完成按钮 */}
      <div className="flex justify-center">
        <button
          onClick={onComplete}
          disabled={!canComplete || loading}
          className="px-6 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              圆桌讨论生成中...
            </span>
          ) : canComplete ? (
            "完成对话，进入圆桌讨论 →"
          ) : (
            `至少需要 3 轮对话（当前第 ${session?.roundNumber || 0} 轮）`
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Step 2: Roundtable
// ============================================================

function RoundtableStep({
  result,
  onViewReport,
}: {
  result: RoundtableResult;
  onViewReport: () => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-center text-neutral-900 dark:text-neutral-100">
        🎯 圆桌讨论结果
      </h2>

      {/* 各角色分析 */}
      {result.participants.map((p, i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800"
        >
          <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-3">
            {p.role}
          </h3>
          <div className="space-y-2">
            {Object.entries(p)
              .filter(([k]) => k !== "role")
              .map(([key, value]) => (
                <div key={key} className="text-sm">
                  <span className="text-neutral-500 dark:text-neutral-400">{key}: </span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {Array.isArray(value) ? value.join(", ") : String(value)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ))}

      {/* 共识 */}
      {result.consensus.length > 0 && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
          <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-2">
            ✅ 共识
          </h3>
          <ul className="space-y-1">
            {result.consensus.map((c, i) => (
              <li key={i} className="text-sm text-emerald-800 dark:text-emerald-200">
                • {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 分歧 */}
      {result.disagreements.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <h3 className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-2">
            ⚡ 分歧
          </h3>
          <ul className="space-y-1">
            {result.disagreements.map((d, i) => (
              <li key={i} className="text-sm text-amber-800 dark:text-amber-200">
                • {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={onViewReport}
          className="px-6 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
        >
          查看提升方案 →
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Step 3: Report
// ============================================================

function ReportStep({ result }: { result: RoundtableResult }) {
  const { recommendation } = result;
  const priorityIcons = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-center text-neutral-900 dark:text-neutral-100">
        📋 你的当前工作提升方案
      </h2>

      {/* Top 3 提升方向 */}
      {recommendation.top_3_directions.map((dir) => (
        <div
          key={dir.priority}
          className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">
              {dir.priority >= 1 && dir.priority <= 3
                ? priorityIcons[dir.priority - 1]
                : `${dir.priority}.`}
            </span>
            <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200">
              {dir.direction}
            </h3>
          </div>

          <div className="space-y-2 pl-8">
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">具体行动</p>
              <ul className="space-y-1">
                {dir.specific_actions.map((a, i) => (
                  <li key={i} className="text-sm text-neutral-700 dark:text-neutral-300">
                    • {a}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-4 text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">
                ⏱ {dir.timeline}
              </span>
              <span className="text-neutral-500 dark:text-neutral-400">
                🎯 {dir.expected_outcome}
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* 行动计划 */}
      <div className="p-5 rounded-xl bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800">
        <h3 className="text-sm font-bold text-primary-700 dark:text-primary-300 mb-3">
          📅 行动计划
        </h3>
        <div className="space-y-3">
          {[
            { label: "第 1-3 个月", value: recommendation.action_plan.month_1_3 },
            { label: "第 4-6 个月", value: recommendation.action_plan.month_4_6 },
            { label: "第 7-12 个月", value: recommendation.action_plan.month_7_12 },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">
                {item.label}
              </p>
              <p className="text-sm text-primary-800 dark:text-primary-200">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 后续 */}
      <div className="text-center text-xs text-neutral-400 dark:text-neutral-500 space-y-2">
        <p>3 个月后我们会提醒你回顾这份方案</p>
        <p>如果情况变化，随时重新评估</p>
      </div>
    </div>
  );
}
