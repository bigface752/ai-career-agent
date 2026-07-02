# 文档更新规则（唯一规则文件）

> **本文件是项目文档更新的唯一规则来源。**
> 任何人在修改 ai-career-agent 项目文档前，必须先读本文件。
> CLAUDE.md 中的文档规则部分通过引用本文件同步，不重复定义。

---

## 核心原则

**单一权威来源 + 引用不复制。**
每类信息只在一个文件中定义，其他文件用引用（"见 XX.md §Y"）。

---

## 权威来源矩阵

| 信息类型 | 权威文件 | 引用文件（只写引用，不写内容） |
|---------|---------|---------------------------|
| 产品决策/需求/用户故事/圆桌机制 | **PRD.md** | CLAUDE.md, SPEC.md, acceptance-criteria.md, report-templates.md |
| 技术架构/数据库Schema/API摘要 | **SPEC.md** | api-endpoints.md, PLAN.md |
| 开发计划/时间线/里程碑 | **PLAN.md** | PRD.md, SPEC.md |
| 任务清单/任务状态 | **TASKS.md** | PLAN.md |
| 验收标准(Given/When/Then) | **specs/acceptance-criteria.md** | PRD.md(只写"→见specs/acceptance-criteria.md") |
| 用户流程 | **specs/user-flows.md** | PRD.md(只写引用) |
| API端点详细定义 | **specs/api-endpoints.md** | SPEC.md(只写摘要引用) |
| 报告模板 | **specs/report-templates.md** | PRD.md(只写引用) |
| Agent定义(System Prompt/分析框架) | **agents/*.md** | agent-prompts.md(只做索引), PRD.md(只写列表引用) |
| 商业分析/定价/市场 | **BUSINESS-PLAN.md** | PRD.md(只写引用) |
| V1开发决策 | **PRD.md §11.1** | CLAUDE.md(只写引用) |

---

## 更新流程（每次改文档前必须执行）

### Step 1：确定信息类型
我要改的内容属于上面矩阵的哪一行？

### Step 2：找到权威文件
这一行的权威文件是哪个？我要改的是权威文件还是引用文件？

### Step 3：执行修改
- **如果是权威文件** → 直接改内容
- **如果是引用文件** → 不要在这里写内容，只更新引用指向（"见 XX.md §Y"），然后去权威文件改

### Step 4：同步检查
改完后，根据"变更影响矩阵"检查引用文件是否需要更新引用路径。

### Step 5：验证无重复
```bash
# 在项目根目录执行，搜索关键信息是否意外出现在其他文件
grep -rn "关键词" /home/dev/ai-career-agent/ --include="*.md"
```

---

## 变更影响矩阵

| 改了什么 | 必须检查的引用文件 |
|---------|-----------------|
| PRD.md（产品决策） | CLAUDE.md(摘要)、SPEC.md(引用)、acceptance-criteria.md(引用) |
| SPEC.md（技术架构） | PLAN.md(引用)、api-endpoints.md(引用) |
| PLAN.md（开发计划） | PRD.md(引用)、SPEC.md(引用) |
| TASKS.md（任务状态） | PLAN.md(引用) |
| agents/*.md（Agent定义） | agent-prompts.md(索引)、PRD.md(列表) |
| specs/acceptance-criteria.md | PRD.md(引用) |
| specs/user-flows.md | PRD.md(引用) |
| specs/api-endpoints.md | SPEC.md(引用) |
| specs/report-templates.md | PRD.md(引用) |

---

## 红线（绝对不允许）

1. ❌ 在 CLAUDE.md 里写详细的产品决策/技术方案（只写引用）
2. ❌ 在 PRD.md 里写详细的开发计划/任务分解（只写引用）
3. ❌ 在 SPEC.md 里写详细的用户故事/决策记录（只写引用）
4. ❌ 在引用文件里重复权威文件已经定义的内容
5. ❌ 改了权威文件后不检查引用文件是否需要同步
6. ❌ 在 CLAUDE.md、memory-project.md、agents/README.md 中内联定义架构/决策/技术栈

---

## 各文件索引规则（什么该写、什么不该写）

| 文件 | 该写什么 | 不该写什么 |
|------|---------|-----------|
| **CLAUDE.md** | 项目概述（1行）、思维原则、Skill规则、项目结构、开发规范、常用命令 | 产品决策、技术架构、Agent列表、动态占比表、技术栈 |
| **memory-project.md** | 当前状态、下一步、会话上下文 | 产品架构、技术决策、Agent定义、知识体系 |
| **PRD.md** | 产品决策、用户故事、Agent列表、圆桌机制、画像系统、决策记录 | 开发计划、任务分解、数据库Schema、API详细定义 |
| **SPEC.md** | 技术架构、数据库Schema、功能规格、非功能需求 | 用户故事详情、产品决策记录、Agent完整Prompt |
| **PLAN.md** | 时间线、里程碑、依赖关系 | 产品决策详情、技术架构详情 |
| **TASKS.md** | 任务分解、验收标准、状态 | 产品决策、技术架构 |
| **agents/README.md** | Agent文件索引（文件名+链接+状态） | 架构描述、动态占比表、知识体系、多段经历概念 |
| **agent-prompts.md** | Agent文件索引（文件名+链接+状态+模块） | 架构描述、动态占比表 |
| **BUSINESS-PLAN.md** | 商业分析、定价、市场、模块概述（给合伙人看，可自包含） | 技术实现细节 |

**BUSINESS-PLAN.md 特殊说明：** 这是给合伙人看的独立文档，需要自包含。模块描述和定价内容属于它的职责范围，不算重复。但技术架构细节应引用 SPEC.md。

---

## 引用格式规范

引用其他文件时，统一使用以下格式：
```
→ 见 [文件名] §[章节号]（[章节名]）
```

示例：
```
→ 见 PRD.md §11.1（已确认决策）
→ 见 specs/acceptance-criteria.md（验收标准）
→ 见 agents/moderator.md（System Prompt）
```

---

## 定期一致性检查

每周或每个开发阶段结束时，执行一次全量一致性检查：

```bash
# 检查"V1支持岗位"是否在所有文件中一致
grep -rn "V1.*支持.*岗位" /home/dev/ai-career-agent/ --include="*.md"

# 检查"评分"相关是否一致（应该全是定性，没有0-100）
grep -rn "评分.*0-100\|匹配度.*0-100" /home/dev/ai-career-agent/ --include="*.md" | grep -v "不给"

# 检查"跳槽风险评分"是否已全部清除
grep -rn "跳槽风险评分" /home/dev/ai-career-agent/ --include="*.md"

# 检查圆桌人数是否一致
grep -rn "5+1\|6+1\|4+1\|5角色\|6角色" /home/dev/ai-career-agent/ --include="*.md"
```

---

## 版本记录

| 日期 | 变更 |
|------|------|
| 2026-06-15 | 创建本文件，统一文档更新规则，修复10处历史矛盾，清理7个文件重复内容 |
| 2026-06-15 | 按规则更新：PRD.md（圆桌机制+搜索增强）、psychologist.md（质疑者角色）、ai-efficiency-expert.md（知识卡注入） |
