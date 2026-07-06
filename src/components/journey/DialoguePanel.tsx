"use client";

/**
 * DialoguePanel — 嵌入式对话面板
 *
 * 从 /dialogue/page.tsx 提取，作为 /journey 页面的 intake 步骤内容。
 * 复用 useDialogue hook，不改变对话引擎逻辑。
 */

import { useState, useEffect, useRef, FormEvent, KeyboardEvent, useCallback } from "react";
import { useDialogue } from "@/hooks/useDialogue";
import type { ChatMessage } from "@/hooks/useDialogue";

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
}

interface DialoguePanelProps {
  /** 对话完成回调（slot 填充率 100% 时触发） */
  onComplete?: (sessionId: string) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
}

type PanelState = "loading" | "resume-prompt" | "active" | "error";

// ============================================================
// Component
// ============================================================

export function DialoguePanel({ onComplete, onError }: DialoguePanelProps) {
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

  const [panelState, setPanelState] = useState<PanelState>("loading");
  const [existingSession, setExistingSession] = useState<ExistingSession | null>(null);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const onCompleteCalledRef = useRef(false);

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
          setPanelState("resume-prompt");
        } else {
          setPanelState("resume-prompt");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("检查会话失败:", err);
          setError("无法检查会话状态，请刷新重试");
          setPanelState("error");
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
  // Check slot completion → trigger onComplete
  // ============================================================

  useEffect(() => {
    if (
      session &&
      session.filledCount >= session.requiredCount &&
      session.requiredCount > 0 &&
      !onCompleteCalledRef.current
    ) {
      onCompleteCalledRef.current = true;
      onComplete?.(session.sessionId);
    }
  }, [session, onComplete]);

  // ============================================================
  // Start new session
  // ============================================================

  const handleStartNew = useCallback(async () => {
    setPanelState("loading");
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
          setExistingSession(data.session);
          setPanelState("resume-prompt");
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
      setPanelState("active");

      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "创建会话失败";
      setError(msg);
      setPanelState("error");
      onError?.(msg);
    }
  }, [setSession, setMessages, setError, onError]);

  // ============================================================
  // Resume existing session
  // ============================================================

  const handleResume = useCallback(async () => {
    if (!existingSession) return;

    setPanelState("loading");
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
      setPanelState("active");

      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "恢复会话失败";
      setError(msg);
      setPanelState("error");
      onError?.(msg);
    }
  }, [existingSession, setSession, setMessages, setError, onError]);

  // ============================================================
  // Send message
  // ============================================================

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    await sendMessage(trimmed);

    setTimeout(() => inputRef.current?.focus(), 50);
  }, [input, isLoading, sendMessage]);

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

  if (panelState === "loading") {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {session ? "正在恢复对话..." : "正在检查会话..."}
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // Render: Error
  // ============================================================

  if (panelState === "error") {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center max-w-md">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setPanelState("loading");
              window.location.reload();
            }}
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // Render: Resume Prompt
  // ============================================================

  if (panelState === "resume-prompt") {
    return (
      <div className="max-w-md mx-auto">
        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 mb-3">
          步骤一 · 信息采集
        </span>

        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          引导式对话
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          AI 引导 4-6 轮深度问答，逐步构建你的职业画像。
        </p>

        {existingSession ? (
          <div className="p-5 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/50 mb-4">
            <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-1">
              你上次聊到第{" "}
              <span className="font-semibold">{existingSession.roundNumber}</span>{" "}
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
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  // ============================================================
  // Render: Active Chat
  // ============================================================

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[400px]">
      {/* Slot 进度条 */}
      {session && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              信息采集进度
            </span>
            <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 rounded-full transition-all duration-500"
                style={{
                  width: `${session.requiredCount > 0 ? (session.filledCount / session.requiredCount) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
              {session.filledCount}/{session.requiredCount}
            </span>
          </div>
        </div>
      )}

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

          {/* Loading indicator */}
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
    </div>
  );
}

// ============================================================
// Message Bubble (内部组件)
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
