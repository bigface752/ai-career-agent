# AI Career Agent 项目配置

## 项目概述

AI 职业智囊：基于多Agent系统的Web端职业决策产品，面向"还没辞职但在想"的B2B企业软件从业者。

→ 产品需求：见 PRD.md
→ 技术架构：见 SPEC.md
→ 开发计划：见 PLAN.md
→ Agent定义：见 kitty-specs/v1-career-cognition/agents/
→ **会话状态（当前进度+下一步）：见 SESSION.md** ← 每次新对话先读这个

## 思维原则

**核心要求：每次任务都要深度思考，不要为了完成任务而完成任务。**

- 主动思考文件组织、代码架构、最佳实践、可维护性、可扩展性
- 每次任务开始前：这是最好的方案吗？有什么缺点？能复用吗？
- 每次任务完成后：质量怎么样？有没有遗漏？下次怎么做得更好？
- 每个角色/功能设计标准：角色定位、核心理念、工作方式、分析框架、输入输出、规则约束、配合方式

## V1 开发决策

→ 见 PRD.md §11.1（已确认决策，21条）
→ 见 PRD.md §10（Open Questions）

### 已记录待后续处理

| # | 功能 | 说明 |
|---|------|------|
| 1 | Token成本监控 | V1暂不设上限，记录在案 |
| 2 | 报告导出/分享 | V1不开发，用户可用电脑截图 |

---

## Skill 调用规则

当用户说出以下关键词时，读取对应的 SKILL.md 并按照其指导工作：

### 产品管理
- **触发词**：用户故事、PRD、优先级、需求分析、产品定位、路线图
- **Skill 路径**：~/.claude/claude-skills/skills/pm-skills/README.md

### 规格驱动开发
- **触发词**：规格开发、任务分解、spec、plan、tasks
- **Skill 路径**：~/.claude/claude-skills/skills/spec-kitty/README.md

### 多 Agent 协作开发
- **触发词**：完整功能、多 agent 协作、开发功能、构建功能
- **Skill 路径**：~/.claude/claude-skills/skills/vibe-team/README.md

### 多模型讨论
- **触发词**：圆桌讨论、多模型讨论、观点碰撞、深度分析
- **Skill 路径**：~/.claude/claude-skills/skills/round/README.md

### 投票决策
- **触发词**：投票决策、共识、多模型决策
- **Skill 路径**：~/.claude/claude-skills/skills/council/README.md

### 正反辩论
- **触发词**：辩论、正反方、权衡利弊
- **Skill 路径**：~/.claude/claude-skills/skills/debate/README.md

### 需求分析和设计
- **触发词**：需求分析、设计、实现、bug 修复
- **Skill 路径**：~/.claude/claude-skills/skills/spec-workflow/README.md

### 对抗性审查
- **触发条件**：任务完成后自动触发（3+ 文件改动 / 架构安全决策 / 反复 bug 修复）
- **Skill 路径**：~/.claude/claude-skills/skills/adversarial-review/README.md

## 项目结构

```
ai-career-agent/
├── CLAUDE.md                      # 项目配置（本文件）
├── DOC-RULES.md                   # 文档更新规则（唯一规则文件）
├── BUSINESS-PLAN.md               # 商业计划书
├── PRD.md                         # 产品需求文档（产品决策权威）
├── module-0-career-coaching.md    # 模块零设计
├── src/
│   ├── app/                       # Next.js App Router 页面
│   │   ├── api/                   # API 路由
│   │   └── [page]/                # 前端页面（21个路由）
│   ├── components/ui/             # 基础 UI 组件（Button/Input/Card/ProgressBar）
│   └── lib/
│       ├── ai.ts                  # AI 模型配置（MiMo/DeepSeek/千问/GLM）
│       ├── db.ts                  # Prisma + Turso 数据库客户端
│       ├── knowledge/             # 知识卡三层加载系统
│       │   ├── schema.ts          # Zod 类型定义
│       │   ├── loader.ts          # 统一加载 + placeholder 注入
│       │   ├── fallback.ts        # nearest-position 匹配
│       │   └── index.ts
│       └── search/                # 搜索策略
│           ├── schema.ts          # 搜索策略类型
│           ├── router.ts          # 条件路由
│           └── index.ts
├── prisma/
│   ├── schema.prisma              # 13 张表定义
│   └── init.sql                   # 初始化 SQL
├── scripts/
│   └── validate-knowledge.ts      # 知识卡验证脚本
├── specs/                         # 可执行规格
│   ├── acceptance-criteria.md     # 用户故事验收标准
│   ├── user-flows.md              # 用户流程图
│   ├── agent-prompts.md           # Agent Prompt 索引
│   ├── report-templates.md        # 报告模板结构
│   └── api-endpoints.md           # API 端点规格
└── kitty-specs/                   # 开发规格
    └── v1-career-cognition/
        ├── SPEC.md                # V1开发规格（技术架构权威）
        ├── PLAN.md                # 开发计划
        ├── TASKS.md               # 任务清单
        └── agents/                # Agent角色定义
            ├── *.md               # 各Agent模板文件
            ├── knowledge-base/    # 三层知识库
            │   ├── global_knowledge.json    # 第一层：跨行业通用
            │   ├── industry_context.json    # 第二层：B2B行业
            │   └── positions/               # 第三层：岗位特定
            └── search-strategies/ # 搜索策略
```

## 12-Agent 动态占比架构

| 动态占比 | Agent | 占位符注入 |
|---------|-------|-----------|
| 0% | 圆桌主持、心理学家 | 纯静态 prompt |
| 10-30% | 对话引导、职业导师、画像构建 | `{knowledge_card}` |
| 50-60% | 猎头、市场对标、AI效能专家 | `{knowledge_card}` + `{global_knowledge}` + `{industry_context}` |
| 100% | 行业总监、头部企业专家、岗位洞察、面试辅导 | 运行时完全生成 |

**知识卡三层体系：**
- 第一层 `global_knowledge.json`：宏观 AI 数据、标志性案例、工具目录
- 第二层 `industry_context.json`：B2B vs 互联网对比
- 第三层 `positions/{position}.json`：岗位特定 AI 影响、薪资、转型路径

**占位符注入：** `src/lib/knowledge/loader.ts` 统一处理，支持多段经历（最多 3 张卡）

## 文档更新规则

> **⚠️ 修改任何项目文档前，必须先读 [DOC-RULES.md](DOC-RULES.md)。**
> 本文件不重复定义规则，只引用。

## 开发规范

1. **规格先行**：任何功能开发前，先用 spec-kitty 写规格
2. **任务分解**：用 spec-kitty 的 plan 和 tasks 分解任务
3. **多 agent 协作**：用 vibe-team 的专业 agent 执行任务
4. **代码审查**：用 vibe-team 的 code-reviewer 审查代码
5. **测试验证**：用 vibe-team 的 test-architect 设计测试用例

### 知识卡开发规范

- 新增岗位：创建 `positions/{id}.json`，通过 Zod schema 验证
- 数据来源：每个字段必须有 `source` 和 `confidence_level`
- 过期机制：`meta.last_updated` 超过 90 天自动触发搜索更新
- Agent 模板：用 `{knowledge_card}` 占位符，不要硬编码岗位数据
- 验证命令：`npx tsx scripts/validate-knowledge.ts`

## 执行命令规则（强制）

**⚠️ 禁止裸命令！** CWD 会漂移，必须通过以下两种方式之一执行：

### 方式一：npm run（推荐，用于固定命令）

```bash
cd /home/dev/ai-career-agent && npm run <命令>
```

可用的命令：
| 命令 | 用途 |
|------|------|
| `npm run build` | 构建（自动清理 .next，跳过 lint） |
| `npm run dev` | 本地开发 |
| `npm run validate` | 验证知识卡 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:push` | 推送数据库 schema |
| `npm run db:studio` | 打开 Prisma Studio |
| `npm run clean` | 清理缓存 |

### 方式二：run.sh（用于临时/杂项命令）

```bash
bash /home/dev/ai-career-agent/run.sh <任意命令>
```

run.sh 会自动定位到项目根目录，不需要手动 cd。

### 为什么？

Claude Code 的 Bash 工具会在某些情况下把 cwd 从 `/home/dev/ai-career-agent` 漂移到 `/home/dev`。一旦漂移，所有相对路径命令静默失败。`npm run` 和 `run.sh` 内部自动定位目录，不受 cwd 漂移影响。

## 常用命令

```bash
# 规格驱动开发
/spec-kitty.specify 构建画像构建 Agent
/spec-kitty.plan
/spec-kitty.tasks

# 多 agent 协作开发
"让 backend-dev 实现对话状态机"
"让 frontend-dev 实现对话 UI"
"让 test-architect 设计测试用例"

# 多模型讨论
"用 round 讨论画像构建 Agent 应该包含哪些维度"
"用 council 投票决定先做模块一还是模块零"
"用 debate 辩论付费模式按次 vs 订阅"
```
