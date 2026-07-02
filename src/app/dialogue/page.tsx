"use client";

import { useState, useEffect, useRef, FormEvent, KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDialogue } from "@/hooks/useDialogue";
import type { ChatMessage } from "@/hooks/useDialogue";
import { Navbar } from "@/components/Navbar";

// ============================================================
// Types
// ============================================================

interface ExistingSession {
  sessionId: string;
  status: string;
  roundNumber: number;
  filledCount: number;
  requiredCount: number;
  pendingSlots: string[];
  recentWindow: { role: string; content: string; turn: number }[];
}

type PageState = "loading" | "resume-prompt" | "active" | "error";

// ============================================================
// Main Page
// ============================================================

export default function DialoguePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <DialogueView />
    </div>
  );
}

// ============================================================
// Dialogue View (Client Component)
// ============================================================

function DialogueView() {
  const {
    messages,
    setMessages,
    session,
    setSession,
    sendMessage,
    isLoading,
    isStreaming,
    streamedText,
    error,
    setError,
  } = useDialogue();

  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [existingSession, setExistingSession] =
    useState<ExistingSession | null>(null);
  const [input, setInput] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const evaluatingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ============================================================
  // Check for existing session on mount
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const res = await fetch("/api/dialogue/status?module=career");
        if (cancelled) return;

        if (!res.ok) {
          throw new Error("检查会话状态失败");
        }

        const data = await res.json();

        if (data.session && data.session.status !== "expired") {
          setExistingSession(data.session);
          setPageState("resume-prompt");
        } else {
          setPageState("resume-prompt"); // No existing session, show start option
        }
      } catch (err) {
        if (!cancelled) {
          console.error("检查会话失败:", err);
          setError("无法检查会话状态，请刷新重试");
          setPageState("error");
        }
      }
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [setError]);

  // ============================================================
  // Auto-scroll to latest message
  // ============================================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamedText]);

  // ============================================================
  // Trigger evaluation
  // ============================================================

  async function handleEvaluate() {
    if (!session?.sessionId || evaluatingRef.current) return;

    // 同步锁，防止快速双击
    evaluatingRef.current = true;
    setIsEvaluating(true);
    setError(null);

    try {
      const res = await fetch("/api/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "评估失败");
      }

      router.push(`/evaluation?sessionId=${session.sessionId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "评估失败，请重试";
      setError(msg);
      evaluatingRef.current = false;
      setIsEvaluating(false);
    }
  }

  // ============================================================
  // Start new session
  // ============================================================

  async function handleStartNew() {
    setPageState("loading");
    setError(null);

    try {
      const res = await fetch("/api/dialogue/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: "career" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.code === "SESSION_EXISTS" && data.session) {
          // Race condition: session was created between our check and start
          setExistingSession(data.session);
          setPageState("resume-prompt");
          return;
        }
        throw new Error(data.error || "创建会话失败");
      }

      const data = await res.json();
      setSession({
        sessionId: data.sessionId,
        status: data.status,
        roundNumber: data.roundNumber,
        filledCount: data.filledCount,
        requiredCount: data.requiredCount,
        pendingSlots: data.pendingSlots,
      });
      setMessages([]);
      setPageState("active");

      // Focus input after entering active state
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "创建会话失败";
      setError(msg);
      setPageState("error");
    }
  }

  // ============================================================
  // Resume existing session
  // ============================================================

  async function handleResume() {
    if (!existingSession) return;

    setPageState("loading");
    setError(null);

    try {
      const res = await fetch("/api/dialogue/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: existingSession.sessionId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "恢复会话失败");
      }

      const data = await res.json();

      // Restore messages from DB (complete history)
      const restoredMessages: ChatMessage[] = (data.messages || []).map(
        (msg: { role: string; content: string; createdAt: string }, i: number) => ({
          id: `restored-${i}`,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          timestamp: new Date(msg.createdAt).getTime(),
        })
      );

      setSession({
        sessionId: data.sessionId,
        status: data.status,
        roundNumber: data.roundNumber,
        filledCount: data.filledCount,
        requiredCount: data.requiredCount,
        pendingSlots: data.pendingSlots,
      });
      setMessages(restoredMessages);
      setPageState("active");

      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "恢复会话失败";
      setError(msg);
      setPageState("error");
    }
  }

  // ============================================================
  // Send message
  // ============================================================

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    await sendMessage(trimmed);

    // Re-focus input after sending
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    handleSend();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ============================================================
  // Render: Loading
  // ============================================================

  if (pageState === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {session ? "正在恢复对话..." : "正在检查会话..."}
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // Render: Error
  // ============================================================

  if (pageState === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setPageState("loading");
              window.location.reload();
            }}
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            重试
          </button>
        </div>
      </main>
    );
  }

  // ============================================================
  // Render: Resume Prompt
  // ============================================================

  if (pageState === "resume-prompt") {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <nav className="mb-6">
            <Link
              href="/"
              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              ← 返回首页
            </Link>
          </nav>

          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 mb-3">
            模块一 · 职业认知
          </span>

          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            引导式对话
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            AI 引导 4-6 轮深度问答，逐步构建你的职业画像。
          </p>

          {existingSession ? (
            <div className="p-5 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/50 mb-4">
              <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-1">
                你上次聊到第{" "}
                <span className="font-semibold">
                  {existingSession.roundNumber}
                </span>{" "}
                轮，已收集{" "}
                <span className="font-semibold">
                  {existingSession.filledCount}/{existingSession.requiredCount}
                </span>{" "}
                个维度。
              </p>
              {existingSession.pendingSlots.length > 0 && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  待收集：{existingSession.pendingSlots.join("、")}
                </p>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleResume}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  继续上次对话
                </button>
                <button
                  onClick={handleStartNew}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  重新开始
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleStartNew}
              className="w-full px-4 py-3 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              开始对话
            </button>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      </main>
    );
  }

  // ============================================================
  // Render: Active Chat
  // ============================================================

  return (
    <main className="h-screen flex flex-col">
      {/* Header */}
      <Navbar
        badge="模块一 · 职业认知"
        rightContent={
          session && (
            <div className="flex items-center gap-3">
              <ProgressBar
                filledCount={session.filledCount}
                requiredCount={session.requiredCount}
              />
              {session.filledCount >= session.requiredCount && (
                <button
                  onClick={handleEvaluate}
                  disabled={isEvaluating}
                  className="px-3 py-1.5 text-xs font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isEvaluating ? "评估中..." : "开始评估"}
                </button>
              )}
            </div>
          )
        }
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-12">
              <p className="text-neutral-400 dark:text-neutral-500 text-sm">
                对话已开始，发送消息开始交流吧
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Streaming message */}
          {isStreaming && streamedText && (
            <MessageBubble
              message={{
                id: "streaming",
                role: "assistant",
                content: streamedText,
                timestamp: Date.now(),
              }}
              isStreaming
            />
          )}

          {/* Loading indicator (waiting for first token) */}
          {isStreaming && !streamedText && (
            <div className="flex gap-3 max-w-[80%]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                <span className="text-xs">🤖</span>
              </div>
              <div className="px-4 py-3 rounded-2xl bg-neutral-100 dark:bg-neutral-800">
                <div className="flex gap-1">
                  <span
                    className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex-shrink-0 px-4 py-2 bg-red-50 dark:bg-red-950/50 border-t border-red-200 dark:border-red-800">
          <p className="max-w-3xl mx-auto text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-neutral-200 dark:border-neutral-800 px-4 py-3">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex gap-2 items-end"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的回答..."
            rows={1}
            className="flex-1 px-4 py-2.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            style={{ maxHeight: "120px" }}
            onInput={(e) => {
              // Auto-resize textarea
              const target = e.currentTarget;
              target.style.height = "auto";
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 px-4 py-2.5 text-sm font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            发送
          </button>
        </form>
      </div>
    </main>
  );
}

// ============================================================
// Message Bubble
// ============================================================

function MessageBubble({
  message,
  isStreaming = false,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs ${
          isUser
            ? "bg-primary-600 text-white"
            : "bg-primary-100 dark:bg-primary-900"
        }`}
      >
        {isUser ? "👤" : "🤖"}
      </div>
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-primary-600 text-white rounded-tr-md"
            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-tl-md"
        }`}
      >
        {message.content}
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 ml-0.5 bg-current animate-pulse align-text-bottom" />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Progress Bar
// ============================================================

function ProgressBar({
  filledCount,
  requiredCount,
}: {
  filledCount: number;
  requiredCount: number;
}) {
  const pct = requiredCount > 0 ? (filledCount / requiredCount) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-600 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
        {filledCount}/{requiredCount}
      </span>
    </div>
  );
}
