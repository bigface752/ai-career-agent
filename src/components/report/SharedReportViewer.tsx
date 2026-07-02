"use client";

/**
 * 公开分享报告渲染器
 * 根据 module 类型渲染不同报告内容
 */

interface SharedReportViewerProps {
  module: string;
  reportType: string;
  content: unknown;
}

export function SharedReportViewer({
  module,
  reportType,
  content,
}: SharedReportViewerProps) {
  return (
    <div className="space-y-6">
      {/* 报告标题 */}
      <ReportHeader module={module} reportType={reportType} />

      {/* 报告内容 */}
      {module === "match" && typeof content === "object" && content !== null ? (
        <MatchReportContent content={content as MatchContent} />
      ) : module === "interview" &&
        typeof content === "object" &&
        content !== null ? (
        <InterviewReportContent content={content as InterviewContent} />
      ) : typeof content === "string" ? (
        <div
          className="prose prose-neutral dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        <GenericJsonContent content={content} />
      )}

      {/* 免责声明 */}
      <p className="text-center text-xs text-neutral-400 dark:text-neutral-500 pt-4">
        本报告基于 AI 分析，仅供参考
      </p>
    </div>
  );
}

// ============================================================
// 报告标题
// ============================================================

function ReportHeader({
  module,
  reportType,
}: {
  module: string;
  reportType: string;
}) {
  const titles: Record<string, { icon: string; title: string }> = {
    career: { icon: "🧠", title: "职业认知报告" },
    match: { icon: "🎯", title: "岗位匹配分析" },
    interview: { icon: "🎤", title: "面试评估报告" },
  };

  const info = titles[module] || { icon: "📊", title: "分析报告" };

  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
        {info.icon} {info.title}
      </h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {reportType}
      </p>
    </div>
  );
}

// ============================================================
// 匹配报告内容
// ============================================================

interface MatchContent {
  overall_rating?: string;
  dimensions?: Record<string, { score: number; detail: string; rating: string }>;
  strengths?: Array<{ strength: string; market_value: string }>;
  gaps?: Array<{ gap: string; severity: string; how_to_close: string }>;
  resume_optimization?: Array<{
    priority: number;
    section: string;
    what: string;
    how: string;
    why: string;
  }>;
}

function MatchReportContent({ content }: { content: MatchContent }) {
  return (
    <div className="space-y-6">
      {/* 整体评级 */}
      {content.overall_rating && (
        <div className="text-center p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-900">
          <span className="text-4xl font-bold text-primary-600 dark:text-primary-400">
            {content.overall_rating}
          </span>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            综合匹配度
          </p>
        </div>
      )}

      {/* 4 维度 */}
      {content.dimensions && (
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(content.dimensions).map(([key, data]) => (
            <div
              key={key}
              className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {key}
                </span>
                <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
                  {data.rating}
                </span>
              </div>
              <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-primary-500 rounded-full"
                  style={{ width: `${(data.score / 5) * 100}%` }}
                />
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {data.detail}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 优势 / 差距 */}
      {(content.strengths?.length || content.gaps?.length) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {content.strengths && content.strengths.length > 0 && (
            <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <h3 className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-3">
                ▲ 优势
              </h3>
              <ul className="space-y-2">
                {content.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-neutral-700 dark:text-neutral-300">
                    {s.strength}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {content.gaps && content.gaps.length > 0 && (
            <div className="p-4 rounded-lg border border-red-200 dark:border-red-800">
              <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-3">
                ▼ 差距
              </h3>
              <ul className="space-y-2">
                {content.gaps.map((g, i) => (
                  <li key={i} className="text-sm text-neutral-700 dark:text-neutral-300">
                    {g.gap}
                    <span className="text-xs text-neutral-400 ml-1">({g.severity})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 面试报告内容
// ============================================================

interface InterviewContent {
  overall_rating?: string;
  dimensions?: Record<string, { score: number; comment: string }>;
  per_question?: Array<{
    question_id: string;
    rating: number;
    strength: string;
    weakness: string;
    optimized_answer: string;
    key_improvement: string;
  }>;
  top_3_improvements?: Array<{
    priority: number;
    what: string;
    how: string;
  }>;
}

function InterviewReportContent({ content }: { content: InterviewContent }) {
  return (
    <div className="space-y-6">
      {/* 整体评分 */}
      {content.overall_rating && (
        <div className="text-center p-6 rounded-2xl bg-neutral-50 dark:bg-neutral-900">
          <span className="text-4xl font-bold text-primary-600 dark:text-primary-400">
            {content.overall_rating}
          </span>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            整体评分
          </p>
        </div>
      )}

      {/* 维度评分 */}
      {content.dimensions && (
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(content.dimensions).map(([key, data]) => (
            <div
              key={key}
              className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {key}
                </span>
                <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                  {data.score}/5
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {data.comment}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 改进建议 */}
      {content.top_3_improvements && content.top_3_improvements.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            🚀 Top 改进建议
          </h3>
          {content.top_3_improvements.map((item) => (
            <div
              key={item.priority}
              className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900"
            >
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-1">
                {item.what}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {item.how}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 通用 JSON 渲染（兜底）
// ============================================================

function GenericJsonContent({ content }: { content: unknown }) {
  if (typeof content === "string") {
    return (
      <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900">
        <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
          {content}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900">
      <pre className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap overflow-x-auto">
        {JSON.stringify(content, null, 2)}
      </pre>
    </div>
  );
}
