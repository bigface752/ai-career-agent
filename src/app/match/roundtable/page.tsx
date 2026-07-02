"use client";

/**
 * 岗位匹配圆桌讨论页面
 *
 * 基于 SPEC.md §3.13 验收标准：
 * - 3 角色并发展示
 * - 共识 + 分歧 + 投递建议
 * - 可收起辩论过程
 */
import { useState } from "react";

interface Participant {
  role: string;
  analysis: string;
  key_point: string;
}

interface RoundtableResult {
  roundtable_id: string;
  participants: Participant[];
  consensus: string[];
  disagreements: string[];
  recommendation: {
    decision: string;
    reason: string;
    next_step: string;
  };
  risk_level: string;
}

export default function MatchRoundtablePage() {
  const [matchId, setMatchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RoundtableResult | null>(null);
  const [showDebate, setShowDebate] = useState(true);

  async function handleStart() {
    if (!matchId.trim()) {
      setError("请输入 match_id");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/match/roundtable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "请求失败");
      }

      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  const decisionColor: Record<string, string> = {
    值得投: "text-green-600",
    谨慎考虑: "text-yellow-600",
    不建议: "text-red-600",
  };

  const riskColor: Record<string, string> = {
    低: "text-green-600",
    中: "text-yellow-600",
    高: "text-red-600",
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">岗位匹配圆桌讨论</h1>
        <p className="text-gray-500 mt-1">
          岗位洞察 + 行业总监 + 猎头，3 角色讨论匹配结论与投递建议
        </p>
      </div>

      {/* 输入区 */}
      <div className="flex gap-3">
        <input
          type="text"
          value={matchId}
          onChange={(e) => setMatchId(e.target.value)}
          placeholder="输入 match_id（来自匹配分析结果）"
          className="flex-1 border rounded px-3 py-2"
          disabled={loading}
        />
        <button
          onClick={handleStart}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? "讨论中..." : "开始圆桌讨论"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>
      )}

      {/* 结果区 */}
      {result && (
        <div className="space-y-6">
          {/* 投递建议（顶部高亮） */}
          <div className="border rounded p-4 bg-gray-50">
            <h2 className="text-lg font-semibold mb-2">投递建议</h2>
            <div className="flex items-center gap-4 mb-2">
              <span
                className={`text-xl font-bold ${decisionColor[result.recommendation.decision] || ""}`}
              >
                {result.recommendation.decision}
              </span>
              <span className={`text-sm ${riskColor[result.risk_level] || ""}`}>
                风险等级：{result.risk_level}
              </span>
            </div>
            <p className="text-gray-700">{result.recommendation.reason}</p>
            <p className="text-gray-500 mt-2 text-sm">
              下一步：{result.recommendation.next_step}
            </p>
          </div>

          {/* 共识 */}
          <div>
            <h2 className="text-lg font-semibold mb-2">共识结论</h2>
            <ul className="list-disc list-inside space-y-1">
              {result.consensus.map((c, i) => (
                <li key={i} className="text-gray-700">
                  {c}
                </li>
              ))}
            </ul>
          </div>

          {/* 分歧 */}
          {result.disagreements.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-2">分歧点</h2>
              <ul className="list-disc list-inside space-y-1">
                {result.disagreements.map((d, i) => (
                  <li key={i} className="text-gray-700">
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 辩论过程（可收起） */}
          <div>
            <button
              onClick={() => setShowDebate(!showDebate)}
              className="text-blue-600 text-sm mb-2"
            >
              {showDebate ? "收起辩论，只看结论" : "展开辩论过程"}
            </button>

            {showDebate && (
              <div className="space-y-4">
                {result.participants.map((p, i) => (
                  <div key={i} className="border rounded p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{p.role}</h3>
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {p.key_point}
                      </span>
                    </div>
                    <div className="text-gray-700 text-sm whitespace-pre-line">
                      {p.analysis}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
