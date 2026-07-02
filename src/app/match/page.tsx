"use client";

import { useState, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { JdInputStep } from "@/components/match/JdInputStep";
import { MatchReportStep } from "@/components/match/MatchReportStep";
import { RoundtableStep } from "@/components/match/RoundtableStep";
import type { ParsedJd } from "@/lib/jd/schema";
import type { MatchAnalyzeResponse } from "@/lib/match/schema";
import type { MatchRoundtableResponse } from "@/lib/match-roundtable/schema";

// ============================================================
// Types
// ============================================================

type MatchStep = "input" | "report" | "roundtable";

// ============================================================
// Main Page
// ============================================================

export default function MatchPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <Navbar badge="模块二 · 岗位匹配" />
      <MatchFlow />
    </div>
  );
}

// ============================================================
// Match Flow (Client Component)
// ============================================================

function MatchFlow() {
  const [step, setStep] = useState<MatchStep>("input");

  // K1 数据
  const [jdId, setJdId] = useState<string | null>(null);
  const [parsedJd, setParsedJd] = useState<ParsedJd | null>(null);
  const [confidence, setConfidence] = useState<"high" | "low" | null>(null);
  const [jdNote, setJdNote] = useState<string | null>(null);

  // K2 数据
  const [analysis, setAnalysis] = useState<MatchAnalyzeResponse | null>(null);

  // K3 数据
  const [roundtable, setRoundtable] =
    useState<MatchRoundtableResponse | null>(null);

  // 状态（分阶段错误：K1 失败 → jdError，K2 失败 → analyzeError，K3 → roundtableError）
  const [jdLoading, setJdLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [roundtableLoading, setRoundtableLoading] = useState(false);
  const [jdError, setJdError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [roundtableError, setRoundtableError] = useState<string | null>(null);

  // ============================================================
  // K2: 匹配分析（K1 成功后自动触发，也可独立重试）
  // ============================================================

  const triggerAnalyze = useCallback(async (jdIdValue: string) => {
    setAnalyzeLoading(true);
    setAnalyzeError(null);

    try {
      const res = await fetch("/api/match/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd_id: jdIdValue }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "匹配分析失败");
      }

      const data: MatchAnalyzeResponse = await res.json();
      setAnalysis(data);
      setStep("report");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "匹配分析失败，请重试";
      setAnalyzeError(msg);
    } finally {
      setAnalyzeLoading(false);
    }
  }, []);

  // ============================================================
  // K1: 解析 JD
  // ============================================================

  const handleParseJd = useCallback(
    async (jdText: string, method: "text" | "position_name") => {
      setJdLoading(true);
      setJdError(null);
      setAnalyzeError(null);

      try {
        const res = await fetch("/api/match/parse-jd", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jd_text: jdText, input_method: method }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "JD 解析失败");
        }

        const data = await res.json();
        setJdId(data.jd_id);
        setParsedJd(data.parsed_jd);
        setConfidence(data.confidence);
        setJdNote(data.note);

        // K1 成功后自动触发 K2
        await triggerAnalyze(data.jd_id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "JD 解析失败，请重试";
        setJdError(msg);
      } finally {
        setJdLoading(false);
      }
    },
    [triggerAnalyze]
  );

  // ============================================================
  // K3: 圆桌讨论
  // ============================================================

  const handleViewRoundtable = useCallback(async () => {
    if (!analysis?.match_id) return;

    setRoundtableLoading(true);
    setRoundtableError(null);

    try {
      const res = await fetch("/api/match/roundtable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: analysis.match_id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "圆桌讨论生成失败");
      }

      const data: MatchRoundtableResponse = await res.json();
      setRoundtable(data);
      setStep("roundtable");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "圆桌讨论生成失败，请重试";
      setRoundtableError(msg);
    } finally {
      setRoundtableLoading(false);
    }
  }, [analysis?.match_id]);

  // ============================================================
  // 重新匹配
  // ============================================================

  const handleRestart = useCallback(() => {
    setStep("input");
    setJdId(null);
    setParsedJd(null);
    setConfidence(null);
    setJdNote(null);
    setAnalysis(null);
    setRoundtable(null);
    setJdError(null);
    setAnalyzeError(null);
    setRoundtableError(null);
  }, []);

  // ============================================================
  // 重试 K2（K1 已成功，K2 失败时使用）
  // ============================================================

  const handleRetryAnalyze = useCallback(() => {
    if (jdId) {
      triggerAnalyze(jdId);
    }
  }, [jdId, triggerAnalyze]);

  // ============================================================
  // Render
  // ============================================================

  // 加载状态（K1+K2 同时进行）
  if (jdLoading || analyzeLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {jdLoading ? "正在解析 JD..." : "正在生成匹配分析..."}
          </p>
        </div>
      </main>
    );
  }

  // K1 失败 → 全屏错误
  if (jdError && step === "input") {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="text-red-600 dark:text-red-400 mb-4">{jdError}</p>
          <button
            onClick={() => setJdError(null)}
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            重试
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      {step === "input" && (
        <JdInputStep
          onSubmit={handleParseJd}
          loading={jdLoading || analyzeLoading}
          error={jdError}
          analyzeError={analyzeError}
          onRetryAnalyze={handleRetryAnalyze}
          hasJdParsed={!!jdId}
        />
      )}

      {step === "report" && parsedJd && confidence && analysis && (
        <MatchReportStep
          parsedJd={parsedJd}
          confidence={confidence}
          note={jdNote}
          analysis={analysis}
          onViewRoundtable={handleViewRoundtable}
          roundtableLoading={roundtableLoading}
          roundtableError={roundtableError}
        />
      )}

      {step === "roundtable" && roundtable && (
        <RoundtableStep roundtable={roundtable} onRestart={handleRestart} />
      )}
    </>
  );
}
