"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

// ============================================================
// 类型
// ============================================================

interface PendingUpdate {
  id: string;
  field: string;
  currentValue: unknown;
  proposedValue: unknown;
  source: string;
  sessionId: string | null;
  createdAt: string;
}

interface PendingUpdateCardProps {
  update: PendingUpdate;
  onResolved: (id: string) => void;
}

// ============================================================
// 字段名映射（field 路径 → 中文标签）
// ============================================================

const FIELD_LABELS: Record<string, string> = {
  // career_summary
  "career_summary.motivation": "职业动机",
  "career_summary.direction": "发展方向",
  "career_summary.industry_preference": "行业偏好",
  "career_summary.role_preference": "岗位偏好",
  "career_summary.location_preference": "地点偏好",
  "career_summary.salary_expectation": "薪资期望",
  "career_summary.other_expectations": "其他期望",
  // strengths
  strengths: "核心优势",
  // weaknesses
  weaknesses: "待提升短板",
  // ai_capability
  "ai_capability.ai_literacy": "AI素养",
  "ai_capability.ai_tools": "AI工具使用",
  "ai_capability.ai_attitude": "AI态度",
  "ai_capability.ai_impact_on_role": "AI对岗位影响",
  // market_value
  "market_value.scarcity": "市场稀缺性",
  "market_value.recommended_directions": "推荐方向",
  "market_value.transferable_skills": "可迁移技能",
  // personality
  "personality.work_style": "工作风格",
  "personality.communication": "沟通方式",
  "personality.decision_making": "决策风格",
  "personality.stress_response": "压力应对",
  "personality.leadership": "领导风格",
  "personality.team_role": "团队角色",
  // development
  "development.short_term_goals": "短期目标",
  "development.long_term_vision": "长期愿景",
  "development.skill_gaps": "技能缺口",
  "development.learning_plan": "学习计划",
};

function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

// ============================================================
// 值显示组件
// ============================================================

function ValueDisplay({
  label,
  value,
  variant,
}: {
  label: string;
  value: unknown;
  variant: "current" | "proposed";
}) {
  const bgColor =
    variant === "current"
      ? "bg-neutral-50 dark:bg-neutral-900"
      : "bg-blue-50 dark:bg-blue-950/30";
  const borderColor =
    variant === "current"
      ? "border-neutral-200 dark:border-neutral-800"
      : "border-blue-200 dark:border-blue-800";

  return (
    <div className={`flex-1 p-3 rounded-lg border ${bgColor} ${borderColor}`}>
      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">
        {label}
      </p>
      <div className="text-sm text-neutral-800 dark:text-neutral-200">
        {renderValue(value)}
      </div>
    </div>
  );
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-neutral-400 italic">无</span>;
  }
  if (typeof value === "string") {
    return <span className="whitespace-pre-wrap">{value}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1">
        {value.map((item, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="text-neutral-400">·</span>
            <span>{typeof item === "string" ? item : JSON.stringify(item)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <pre className="text-xs font-mono text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return String(value);
}

// ============================================================
// 来源标签
// ============================================================

function SourceBadge({ source }: { source: string }) {
  const label = source === "neat_freak" ? "对话提炼" : source;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
      {label}
    </span>
  );
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "刚刚";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  return `${Math.floor(seconds / 86400)} 天前`;
}

// ============================================================
// 主组件
// ============================================================

export function PendingUpdateCard({
  update,
  onResolved,
}: PendingUpdateCardProps) {
  const [loading, setLoading] = useState<"accept" | "reject" | "merge" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [showMerge, setShowMerge] = useState(false);
  const [mergeValue, setMergeValue] = useState(() =>
    typeof update.proposedValue === "string"
      ? update.proposedValue
      : JSON.stringify(update.proposedValue ?? "", null, 2)
  );

  async function handleAction(
    action: "accept" | "reject" | "merge"
  ) {
    setLoading(action);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        updateId: update.id,
        action,
      };
      if (action === "merge") {
        if (!mergeValue.trim()) {
          setError("合并值不能为空");
          setLoading(null);
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(mergeValue);
        } catch {
          // 原值是对象/数组时，要求有效 JSON
          if (
            typeof update.proposedValue === "object" &&
            update.proposedValue !== null
          ) {
            setError("请输入有效的 JSON 格式");
            setLoading(null);
            return;
          }
          parsed = mergeValue;
        }
        body.mergedValue = parsed;
      }

      const res = await fetch("/api/portrait/pending", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "操作失败");
      }

      onResolved(update.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card padding="none">
      <CardContent className="p-4 space-y-3">
        {/* 头部：字段名 + 来源 + 时间 */}
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {getFieldLabel(update.field)}
          </h4>
          <div className="flex items-center gap-2">
            <SourceBadge source={update.source} />
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              {formatTimeAgo(update.createdAt)}
            </span>
          </div>
        </div>

        {/* 对比展示 */}
        <div className="flex gap-3">
          <ValueDisplay
            label="当前值"
            value={update.currentValue}
            variant="current"
          />
          <div className="flex items-center text-neutral-300 dark:text-neutral-600">
            →
          </div>
          <ValueDisplay
            label="AI 提议"
            value={update.proposedValue}
            variant="proposed"
          />
        </div>

        {/* 合并编辑区 */}
        {showMerge && (
          <div className="space-y-2">
            <textarea
              value={mergeValue}
              onChange={(e) => setMergeValue(e.target.value)}
              rows={3}
              className="block w-full rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="输入合并后的值..."
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                loading={loading === "merge"}
                onClick={() => handleAction("merge")}
              >
                确认合并
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowMerge(false)}
                disabled={loading !== null}
              >
                取消
              </Button>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* 操作按钮 */}
        {!showMerge && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="primary"
              loading={loading === "accept"}
              disabled={loading !== null}
              onClick={() => handleAction("accept")}
            >
              ✓ 接受
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={loading === "reject"}
              disabled={loading !== null}
              onClick={() => handleAction("reject")}
            >
              ✗ 拒绝
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={loading !== null}
              onClick={() => setShowMerge(true)}
            >
              ✏️ 合并
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
