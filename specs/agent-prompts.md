# Agent Prompt 索引

> **文件职责**：Agent 索引。每个 Agent 的完整 Prompt 定义在各自独立文件中，本文件只做索引。
> Agent 架构、动态占比模型、V1支持岗位 → 见 PRD.md §5

---

## 0% 动态（纯静态）

| # | Agent | 文件 | 模块 | 状态 |
|---|-------|------|------|------|
| 1 | 圆桌主持 | [moderator.md](../kitty-specs/v1-career-cognition/agents/moderator.md) | 全模块圆桌 | ✅ 已完成 |
| 2 | 心理学家 | [psychologist.md](../kitty-specs/v1-career-cognition/agents/psychologist.md) | 全模块圆桌 | ✅ 已完成 |

## 10-30% 动态（框架+少量定制）

| # | Agent | 文件 | 动态占比 | 模块 | 状态 |
|---|-------|------|---------|------|------|
| 3 | 职业导师 | [career-mentor.md](../kitty-specs/v1-career-cognition/agents/career-mentor.md) | 10% | 模块一圆桌 + 模块零 | ✅ 已完成 |
| 4 | 画像构建 | [portrait-builder.md](../kitty-specs/v1-career-cognition/agents/portrait-builder.md) | 20% | 模块一 | ✅ 已完成 |
| 5 | 对话引导 | [dialogue-guide.md](../kitty-specs/v1-career-cognition/agents/dialogue-guide.md) | 30% | 模块一 | ✅ 已完成 |

## 50-60% 动态（框架+岗位知识）

| # | Agent | 文件 | 动态占比 | 模块 | 状态 |
|---|-------|------|---------|------|------|
| 6 | 猎头 | [headhunter.md](../kitty-specs/v1-career-cognition/agents/headhunter.md) | 50% | 模块一圆桌 + 模块零圆桌 | ✅ 已完成 |
| 7 | 市场对标 | [market-benchmark.md](../kitty-specs/v1-career-cognition/agents/market-benchmark.md) | 50% | 模块一 | ✅ 已完成 |
| 8 | AI效能专家 | [ai-efficiency-expert.md](../kitty-specs/v1-career-cognition/agents/ai-efficiency-expert.md) | 60% | 全模块圆桌 | ✅ 已完成 |

## 100% 动态（完全按用户生成）

| # | Agent | 文件 | 模块 | 状态 |
|---|-------|------|------|------|
| 9 | 行业总监 | [industry-director-data-analyst.md](../kitty-specs/v1-career-cognition/agents/industry-director-data-analyst.md) 等 | 模块一/二圆桌 | ✅ V1有2个岗位模板（数据分析师、B2B销售） |
| 10 | 头部企业专家 | 动态生成 | 模块零圆桌 | ⏳ 待开发（V1） |
| 11 | 岗位洞察 | 动态生成 | 模块二 | ⏳ 待开发（V1） |
| 12 | 面试辅导 | [interview-coach.md](../kitty-specs/v1-career-cognition/agents/interview-coach.md) | 模块三 + 模块一圆桌 | ✅ 已完成 |

> 注：HR Agent 已由猎头 Agent 覆盖（简历竞争力+市场价值评估）
> 注：面试官+答案优化 → 面试辅导（合并）；行业专家+岗位洞察 → 岗位洞察（合并）

---

## 行业总监预定义岗位（V1）

| 岗位 | 文件 | 状态 |
|------|------|------|
| 数据分析师 | [industry-director-data-analyst.md](../kitty-specs/v1-career-cognition/agents/industry-director-data-analyst.md) | ✅ 完整 |
| B2B销售 | [industry-director-b2b-sales.md](../kitty-specs/v1-career-cognition/agents/industry-director-b2b-sales.md) | ✅ 完整 |

> V1 只支持数据分析师和B2B销售两个岗位。PMM及其他岗位（产品运营、市场营销、售前、项目经理）归 V2+。
> 已预定义的 V2+ 行业总监模板：industry-director-pmm.md、industry-director-b2b-product-ops.md、industry-director-marketing.md、industry-director-pre-sales.md、industry-director-project-manager.md

---

## 岗位知识库

```
positions/
├── data-analyst.json       # 数据分析师岗位知识
├── b2b-sales.json          # B2B销售岗位知识
└── pmm.json                # PMM岗位知识
```

---

## 生成流程

- 通用 Agent 生成流程：[AGENT-GENERATION-PROCESS.md](../kitty-specs/v1-career-cognition/agents/AGENT-GENERATION-PROCESS.md)
- 动态岗位 Agent 生成流程：[DYNAMIC-ROLE-GENERATION-PROCESS.md](../kitty-specs/v1-career-cognition/agents/DYNAMIC-ROLE-GENERATION-PROCESS.md)
