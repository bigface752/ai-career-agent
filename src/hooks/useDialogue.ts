"use client";

import { useState, useCallback, useEffect, useRef } from "react";

// ============================================================
// Types
// ============================================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface SessionState {
  sessionId: string;
  status: "active" | "paused" | "completed";
  roundNumber: number;
  filledCount: number;
  requiredCount: number;
  pendingSlots: string[];
}

export interface UseDialogueReturn {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  session: SessionState | null;
  setSession: React.Dispatch<React.SetStateAction<SessionState | null>>;
  sendMessage: (content: string) => Promise<void>;
  pauseSession: () => Promise<void>;
  isLoading: boolean;
  isStreaming: boolean;
  streamedText: string;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

// ============================================================
// Hook
// ============================================================

let _idCounter = 0;
function nextId(): string {
  return `msg-${Date.now()}-${++_idCounter}`;
}

export function useDialogue(): UseDialogueReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [session, setSession] = useState<SessionState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionRef = useRef<SessionState | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;

  // Keep refs in sync with state
  useEffect(() => {
    sessionIdRef.current = session?.sessionId ?? null;
    sessionRef.current = session;
  }, [session]);

  // ============================================================
  // Send Message (with streaming)
  // ============================================================

  const sendMessage = useCallback(async (content: string) => {
    const sid = sessionIdRef.current;
    if (!sid) {
      setError("没有活跃会话");
      return;
    }

    setError(null);
    setIsLoading(true);
    setIsStreaming(true);
    setStreamedText("");

    // Add user message immediately
    const userMsg: ChatMessage = {
      id: nextId(),
      role: "user",
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 重试循环（while 循环，避免递归 finally 状态竞争）
    let attempt = 0;

    try {
      while (attempt <= MAX_RETRIES) {
        // Abort previous request if still running
        if (abortRef.current) {
          abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;

        try {
          const res = await fetch("/api/dialogue/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: sid, content }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `请求失败 (${res.status})`);
          }

          // Read X-Dialogue-State header for session state update
          let shouldExtract = false;
          const stateHeader = res.headers.get("X-Dialogue-State");
          if (stateHeader) {
            try {
              const stateUpdate = JSON.parse(stateHeader);
              shouldExtract = !!stateUpdate.shouldExtract;
              setSession((prev) => {
                if (!prev) return prev;
                // Derive filledCount from slotState
                const filled = stateUpdate.slotState?.filled;
                const filledCount = filled
                  ? Object.values(filled).filter(
                      (v: unknown) =>
                        typeof v === "object" &&
                        v !== null &&
                        "confirmed" in v &&
                        (v as { confirmed: boolean }).confirmed
                    ).length
                  : prev.filledCount;
                return {
                  ...prev,
                  roundNumber: stateUpdate.roundNumber ?? prev.roundNumber,
                  filledCount,
                };
              });
            } catch {
              // Non-critical: header parse failed
            }
          }

          // Stream the response body
          const reader = res.body?.getReader();
          if (!reader) throw new Error("无法读取响应流");

          const decoder = new TextDecoder();
          let accumulated = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            accumulated += chunk;
            setStreamedText(accumulated);
          }

          // Flush remaining bytes from TextDecoder
          const finalChunk = decoder.decode();
          if (finalChunk) {
            accumulated += finalChunk;
            setStreamedText(accumulated);
          }

          // Promote streamed text to a proper message
          if (accumulated) {
            const assistantMsg: ChatMessage = {
              id: nextId(),
              role: "assistant",
              content: accumulated,
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
          }

          setStreamedText("");
          retryCountRef.current = 0; // 发送成功，重置重试计数

          // 每 10 轮异步触发画像提炼（fire-and-forget，不阻塞 UI）
          if (shouldExtract && sessionIdRef.current) {
            fetch("/api/portrait/extract", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: sessionIdRef.current,
                trigger: "dialogue_round",
              }),
            }).catch(() => {
              // 静默失败，通知会通过 Bell 展示
            });
          }

          return; // 成功，直接返回
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === "AbortError") {
            // 用户主动取消，不重试
            return;
          }

          // 网络错误且还有重试次数
          const isNetworkError =
            err instanceof TypeError && err.message.includes("fetch");
          if (isNetworkError && attempt < MAX_RETRIES) {
            attempt++;
            const delay = 1000 * attempt;
            await new Promise((r) => setTimeout(r, delay));
            continue; // 重试
          }

          // 非网络错误或重试耗尽，抛出错误到外层
          throw err;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "发送失败";
      setError(msg);
      // 回滚乐观更新：移除未成功发送的用户消息
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, []);

  // ============================================================
  // Pause Session
  // ============================================================

  const pauseSession = useCallback(async () => {
    const sid = sessionIdRef.current;
    const current = sessionRef.current;
    if (!sid || !current || current.status !== "active") return;

    try {
      await fetch("/api/dialogue/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid }),
        keepalive: true,
      });
      setSession((prev) => (prev ? { ...prev, status: "paused" } : prev));
    } catch {
      // Best-effort: may fail during page unload
    }
  }, []);

  // ============================================================
  // Cleanup: beforeunload (sendBeacon) + unmount (fetch)
  // ============================================================

  useEffect(() => {
    const handleBeforeUnload = () => {
      const sid = sessionIdRef.current;
      const current = sessionRef.current;
      if (!sid || !current || current.status !== "active") return;

      // sendBeacon is the most reliable way during page unload
      const blob = new Blob(
        [JSON.stringify({ sessionId: sid })],
        { type: "application/json" }
      );
      navigator.sendBeacon("/api/dialogue/pause", blob);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Also pause on React unmount (client-side navigation)
      pauseSession();
    };
  }, [pauseSession]);

  return {
    messages,
    setMessages,
    session,
    setSession,
    sendMessage,
    pauseSession,
    isLoading,
    isStreaming,
    streamedText,
    error,
    setError,
  };
}
