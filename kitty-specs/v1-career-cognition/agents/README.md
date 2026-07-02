# Agent 角色索引

> 本文件是 Agent 文件的索引，不重复定义架构。
> Agent 架构、动态占比模型、V1支持岗位 → 见 PRD.md §5
> 多段经历支持 → 见 PRD.md §5（知识体系）

---

## Agent 列表（12个）

### 0% 动态（纯静态）

| 角色 | 文件 | 模块 | 说明 |
|------|------|------|------|
| 圆桌主持 | [moderator.md](moderator.md) | 全模块圆桌 | 综合观点，提炼共识和分歧，冲突解决5步逻辑 |
| 心理学家 | [psychologist.md](psychologist.md) | 全模块圆桌 | AI时代职业心理，接受/适应/信心框架 |

### 10-30% 动态（框架+少量定制）

| 角色 | 文件 | 动态占比 | 模块 | 说明 |
|------|------|---------|------|------|
| 职业导师 | [career-mentor.md](career-mentor.md) | 10% | 模块一圆桌 + 模块零 | Schein职业锚+4C+GROW教练，双模式（圆桌快判/模块零深度） |
| 画像构建 | [portrait-builder.md](portrait-builder.md) | 20% | 模块一 | 三层模板+质量门控(60%阈值)，两阶段构建 |
| 对话引导 | [dialogue-guide.md](dialogue-guide.md) | 30% | 模块一 | 6维度slot filling，Turn-by-Turn提取，基于简历生成个性化问题 |

### 50-60% 动态（框架+岗位知识）

| 角色 | 文件 | 动态占比 | 模块 | 说明 |
|------|------|---------|------|------|
| 猎头 | [headhunter.md](headhunter.md) | 50% | 模块一圆桌 + 模块零圆桌 | 6维度分析(稀缺性30%/薪资20%/简历20%/可迁移15%/卖点10%/时机5%) |
| 市场对标 | [market-benchmark.md](market-benchmark.md) | 50% | 模块一 | 5固定维度+动态维度，薪资百分位(P25/P50/P75/P90) |
| AI效能专家 | [ai-efficiency-expert.md](ai-efficiency-expert.md) | 60% | 全模块圆桌 | 增强>替代原则，7岗位分析数据（需迁移到positions/） |

### 100% 动态（完全按用户生成）

| 角色 | 文件 | 模块 | 说明 |
|------|------|------|------|
| 行业总监 | [industry-director-data-analyst.md](industry-director-data-analyst.md) 等 | 模块一/二圆桌 | 按用户岗位+行业生成，V1有2个岗位模板（数分/销售），PMM为V2+预定义 |
| 头部企业专家 | 动态生成 | 模块零圆桌 | 按用户意向公司+岗位生成 |
| 岗位洞察 | 动态生成 | 模块二 | 行业+岗位综合洞察（原行业专家+岗位洞察合并） |
| 面试辅导 | [interview-coach.md](interview-coach.md) | 模块三 + 模块一圆桌 | 面试官视角+答案优化（原面试官+答案优化合并），参与圆桌 |

---

## Agent 合并记录（2026-06-12）

| 原 Agent | 合并为 | 原因 |
|---------|--------|------|
| 面试官 + 答案优化 | **面试辅导** | 工作流串行（先模拟面试，再优化答案），拆开体验差 |
| 行业专家 + 岗位洞察 | **岗位洞察** | 分析JD离不开行业上下文，拆开后行业专家输出太泛 |

---

## 多段经历支持

→ 见 PRD.md §5（知识体系）和各 Agent prompt 文件中的多段经历处理逻辑

---

## 岗位知识库

```
positions/
├── data-analyst.json       # 数据分析师岗位知识（V1）
├── b2b-sales.json          # B2B销售岗位知识（V1）
└── pmm.json                # PMM岗位知识（V2+，已预定义）
```

**初始化策略：** 冷启动靠 LLM 通用知识 → 用户交互后沉淀 → 岗位知识逐步完善
**更新策略：** 90天过期，下次有用户触发时自动刷新

---

## 搜索策略

```
search-strategies/
├── data-analyst.json       # 数据分析师的各Agent搜索词
├── b2b-sales.json          # B2B销售的各Agent搜索词
└── pmm.json                # PMM的各Agent搜索词
```

**触发条件：** 新岗位首次出现 / 用户提到目标公司 / 岗位认知超90天 / 简历中有未知公司
**分级存储：** 可复用的（岗位级）→ positions/，不可复用的（公司/用户级）→ sessions/

---

## 归档文件

| 文件 | 说明 |
|------|------|
| [archive/career-mentor-roundtable.md](archive/career-mentor-roundtable.md) | 职业导师圆桌讨论记录（设计过程文档） |
| [archive/psychologist-roundtable.md](archive/psychologist-roundtable.md) | 心理学家圆桌讨论记录（设计过程文档） |

---

## 文件结构

每个 Agent 模板文件包含：
1. **角色定位** — 角色名、核心定位
2. **核心理念** — 这个角色的核心价值观
3. **工作方式** — 这个角色怎么工作
4. **分析框架** — 这个角色分析什么
5. **输入** — 这个角色需要什么信息（含 {knowledge_card} 等占位符）
6. **输出格式** — 这个角色输出什么
7. **规则** — 这个角色的约束
8. **与其他角色的配合** — 这个角色怎么和其他角色协作
9. **System Prompt** — 完整的System Prompt（含占位符）

---

## 生成流程

- 通用 Agent 生成流程：见 [AGENT-GENERATION-PROCESS.md](AGENT-GENERATION-PROCESS.md)
- 动态岗位 Agent 生成流程：见 [DYNAMIC-ROLE-GENERATION-PROCESS.md](DYNAMIC-ROLE-GENERATION-PROCESS.md)

---

## 更新记录

| 时间 | 更新内容 |
|------|---------|
| 2026-06-12 | 架构重构：14→12 Agent，动态占比模型，岗位知识库，搜索增强 |
| 2026-06-09 | 删除候选文件，移动圆桌讨论记录到archive，更新索引 |
| 2026-06-08 | 创建文件结构，确认心理学家和职业导师 |
