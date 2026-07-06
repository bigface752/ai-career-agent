# 会话历史归档

> 本文件归档 SESSION.md 的历史内容，仅供回溯查阅。当前状态见 SESSION.md。

---

## 2026-06-15：文档对齐 + 规则体系

### 文档矛盾修复（10处）
- 评分体系：US-03/US-14 改为定性评级（强/中/弱）
- 圆桌人数：模块一6+1，模块零4+1
- Phase 0.5状态：TASKS.md 改为"设计完成，待编码"
- 对话状态Schema：dialogue_sessions 补全字段
- 用户故事数：26→36
- Module 0角色：架构图对齐
- 排期：PLAN.md header 改34天
- V1支持岗位：3个→2个（移除PMM）
- Agent-Prompts索引：更新V1岗位列表
- 60秒诊断：移除，改为5 Agent×3次并行

### 重复内容清理（7个文件）
- CLAUDE.md：删除8处内联重复，改为引用
- memory-project.md：删除10处内联重复，改为引用
- SPEC.md：Agent列表表头、API端点表改为引用
- agents/README.md：架构描述、动态占比表改为引用
- agent-prompts.md：架构描述改为引用
- PLAN.md：V1岗位改为引用
- PRD.md：搜索增强合并为1处

### 规则体系建立
- DOC-RULES.md：权威来源矩阵、更新流程、变更影响矩阵、红线、各文件索引规则
- CLAUDE.md：精简为引用+独有内容

### 第二类架构问题（全部确认）
- 2.1 圆桌框架：Vercel AI SDK 自研（Promise.allSettled）
- 2.2 多模型并发：MiMo + DeepSeek V4 + 千问 Max，3个国内API Key
- 2.3 成本监控：V1数据库记录token数，V2接入Langfuse
- 2.4 搜索增强：模型内置搜索

### 第三类设计缺口（全部确认）
- 3.1 头部企业专家：合并"大厂同岗位专家"和"头部企业专家"为一个Agent
- 3.2 neat-freak冲突：方案B（标记待确认，下次对话确认）
- 3.3 多段职业：不限数量，按实际经历处理，已测试验证（75-80分）
- 3.4 面试辅导：V1做6+1，写完善版Agent

### 测试结论已更新到文档
- PRD.md：强制分歧机制、搜索增强使用场景
- psychologist.md：质疑者角色
- ai-efficiency-expert.md：岗位知识卡注入

---

## 2026-06-16：文档一致性修复（17处）

**问题1：技术栈不一致（10处）**
- PRD.md §9 技术栈表（第369行）
- PRD.md §9 风险表（第356行）
- BUSINESS-PLAN.md（第126行、第364行）
- PLAN.md（第47行）
- SPEC.md（第83行、第348-353行、第359行、第373行、第812行）
- TASKS.md（第53-57行）
- acceptance-criteria.md（第272行）

**问题2：圆桌人数不一致（8处）**
- SPEC.md（第344行、第359行、第373行）
- TASKS.md（第441行）
- user-flows.md（第76行）
- headhunter.md（第4行）
- moderator.md（第4行、第16行、第267行）
- report-templates.md（第43行）

**问题3：V1支持岗位不一致（1处）**
- agents/README.md（第38行）

**问题4：Agent总数不一致（1处）**
- ai-career-agent-README.md（第36行）

### 教训：为什么规则没起作用？

**根本原因：**
1. SESSION.md记录技术栈决策后，只更新了PRD.md §9的"技术依赖表"，漏了同文件的"技术栈表"
2. 改完PRD.md后，没按DOC-RULES.md的"变更影响矩阵"检查SPEC.md、PLAN.md等引用文件
3. 没执行"Step 5：grep验证"

**改进措施：**
1. 每次改文档后，必须执行完整的5步流程（特别是Step 4同步检查和Step 5 grep验证）
2. 同一文件内可能有多处相关内容，改一处后要grep同文件其他位置
3. 改权威文件后，必须按"变更影响矩阵"检查所有引用文件

---

## 2026-06-17：深度质量审计 + 开发规范补全

### 评分体系0-100残留修复（5处）
- report-templates.md: 竞争力评分78/100 → 定性评级
- report-templates.md: 面试辅导5个维度0-100 → BARS 1-5分
- report-templates.md: 模块二匹配度72/100 → 定性评级
- api-endpoints.md: competitiveness_score:78 → competitiveness_rating
- api-endpoints.md: risk_score:35 → risk_level

### 其他修复
- pending_updates表补全（SPEC.md）
- questions_asked字段核实（TASKS.md）
- 模块零圆桌角色统一为4个（PRD/module-0/acceptance-criteria/user-flows）
- 模块三Agent合并后描述更新（PRD.md）
- 构建路线图V2/V3消除（PRD/BUSINESS-PLAN）
- Agent V2标注修复（agent-prompts.md）
- 100%动态Agent方案设计（DYNAMIC-ROLE-GENERATION-PROCESS.md）
- 搜索增强存储设计（search-strategies/_schema.md、knowledge-base/_schema.md）
- V1全模块开发规范补全（SPEC/api-endpoints/TASKS/PLAN）

### 深度质量审计结果

**致命级（7个，全部已修复）：**
1. 模块二缺少评分算法定义 → SPEC.md §3.12
2. `{all_roles_analysis}`无JSON schema → moderator.md
3. 评级体系三级/五级冲突 → 统一为五级制
4. 知识库缺少"会话数据层" → knowledge-base/_schema.md
5. 模块二圆桌缺少轮次/流程定义 → SPEC.md §3.13
6. 模块三模拟面试缺少状态机 → SPEC.md §3.15
7. 搜索增强"最近岗位匹配"算法缺失 → ai-efficiency-expert.md

**严重级（15个，10已修复/5未修复）：**
- 已修复：#8占位符、#9中文输入、#10输出格式、#11参与者数、#12质疑者通道、#13职责重叠、#14简历优化建议、#15总分字段、#1评分算法、#3五级制
- 未修复：#16 API缺字段、#17超期清理矛盾、#18初步发现轮次、#19流程分支、#20面试辅导分类、#21动态生成角色

**改进级（22个，未处理）：** #23-#45，详见原SESSION.md

### 模块二圆桌轮次/流程定义补全
- 辩论式2轮、150-250字/角色、无独立主持、MiMo综合层
- 跨文件同步：user-flows.md、moderator.md

### 模块三模拟面试状态机补全
- 独立interview_sessions表、5状态状态机、暂停/恢复、部分评估（≥3题）

### 搜索增强"最近岗位匹配"算法补全
- 映射表+LLM兜底+默认data-analyst
- C2查询模板改用`{position}`变量

---

## 2026-06-22：严重级审计问题核实

**已修复（10个）：** #1、#3、#8、#9、#10、#11、#12、#13、#14、#15

**未修复（6个）：** #16、#17、#18、#19、#20、#21

---

---

## 2026-06-29：对话状态流转 - 数据库设计（Task B1）

**新增文件：** types.ts、slot-state.ts、slots/career-cognition.ts、slots/index.ts、index.ts

**SlotState 结构（基于 MultiWOZ + Rasa）：**
- `schema_version`：版本控制，支持未来迁移
- `filled`：Record<string, SlotEntry>，增量提取，不覆盖已确认值
- `asked`：AskedQuestion[]，记录 question_variants 支持换方式提问
- `current_focus`：引导 Agent 聚焦当前 Slot
- `phase`：warmup/core/validation/wrapup 四阶段

**对抗式审查修复：**
- C-1: fillSlot 增量提取：已确认且值相同跳过，值不同标记待确认
- M-1: AskedQuestion 增加 question_variants 字段
- M-2: 增加 addFinding/shouldShowFindings 函数
- M-3: 向前兼容版本迁移：补充缺失字段默认值
- M-4: asked 数组清理：每个 slot 最多保留 5 条记录
- m-2: getNextSlotToAsk 使用 MAX_FOLLOWUP_COUNT 限制追问

**模块一 Slot 定义：** 13 个 Slot，8 个维度（basic/motivation/value/risk/constraint/goal/ability/ai）

---

## 2026-06-29：对话状态管理 API（Task B2）

**新增文件：** session-manager.ts、start/route.ts、pause/route.ts、resume/route.ts、status/route.ts、message/route.ts

**API 端点：**
- POST /api/dialogue/start — 启动新会话（检查同模块冲突，409 返回现有 session）
- POST /api/dialogue/pause — 暂停 active 会话
- POST /api/dialogue/resume — 恢复 paused 会话，刷新过期时间
- GET /api/dialogue/status — 按 sessionId 或 module 查询状态+进度
- POST /api/dialogue/message — 发消息+流式AI回复+增量提取 Slot

**设计决策：**
- 增量提取：独立 LLM 调用（generateObject + Zod），先提取 Slot 再生成回复
- 流式响应：streamText + onFinish 回调保存消息和更新状态
- 单模块单会话：同一用户同一模块只能有一个 active/paused session
- X-Dialogue-State header 传递状态更新给客户端
- 提取的 Slot 默认未确认，需用户明确确认

**附带修复：** B1 遗留的 11 个 ESLint 错误（any → unknown、unused imports、_ 变量）

*归档自 SESSION.md，2026-06-29*

---

## 2026-06-29：前端集成 — 对话页面（Task B3）

**新增文件：** src/hooks/useDialogue.ts、src/app/dialogue/page.tsx（替换原 PagePlaceholder）

**核心功能：**
- 进入页面 → GET `/api/dialogue/status?module=career` 检查未完成会话
- 有未完成会话 → 显示"你上次聊到第 X 轮，已收集 Y/8 个维度"，提供「继续上次对话」/「重新开始」
- 无未完成会话 → 「开始对话」按钮
- 确认继续 → POST `/api/dialogue/resume`，从 recentWindow 恢复消息列表
- 发消息 → POST `/api/dialogue/message`，流式读取响应（ReadableStream）
- 页面关闭 → `beforeunload` + `navigator.sendBeacon()` 调 POST `/api/dialogue/pause`
- 组件卸载（客户端路由跳转）→ useEffect cleanup 调 pauseSession()
- 进度条 → header 右侧显示 filledCount/requiredCount

**技术细节：**
- useDialogue hook：封装 messages/session/sendMessage/pauseSession/isStreaming/streamedText/error
- 流式处理：fetch + ReadableStream reader + TextDecoder，逐块更新 streamedText，完成后提升为正式 message
- X-Dialogue-State header：流结束后读取，更新 roundNumber 和 filledCount
- sessionId 通过 useRef 闭包捕获，避免 stale closure
- 自动滚动：messagesEndRef + scrollIntoView
- textarea 自动调整高度 + Enter 发送 / Shift+Enter 换行

**构建状态：** ✅ 通过（dialogue 页面 4.15 kB，TypeScript 无错误）

*归档自 SESSION.md，2026-06-29*

---

## 2026-06-30：模板合并（Task D3）

**新增文件：**
- src/lib/portrait/merger.ts — 模板合并器
- src/app/api/portrait/build/route.ts — 画像构建 API（POST）
- src/app/api/portrait/route.ts — 画像查询 API（GET）

**修改文件：**
- src/lib/portrait/index.ts — 新增 merger 导出

**核心设计：**
- `mergePortrait()` 主函数：BasePortrait + RoundtableResult → PortraitTemplate
- AI 生成组合稀缺度评估（千问 Max，temperature 0.3）
- 规则计算职业清晰度评分（完成度 40% + 叙事清晰度 30% + 定制维度丰富度 30%）
- `savePortrait()` 持久化到 Portrait 表（upsert，自动计算 completion）
- 并发控制：session 状态原子更新为 `building`（updateMany 条件更新），防止重复构建
- 失败恢复：任何步骤失败自动恢复 session 原始状态

**对抗性审查修复（3 项）：**
- compositeProfile 失败不再静默降级 → 改为抛错，不保存半成品画像
- 并发控制：session 状态原子锁（building）
- 移除未使用的 roundtableInput 参数

**构建状态：** ✅ 通过

*归档自 SESSION.md，2026-06-30*

---

## 2026-06-30：工具建设 — Skill 注册 + Hook 自动化

**背景：** 探讨质量门禁自动化方案，决定分层策略：hooks 硬门禁 + Skill 中等约束 + CLAUDE.md 软约束。

**新增文件：**
- `~/.claude/claude-skills/skills/adversarial-review/SKILL.md` — 对抗性审查 Skill（带 frontmatter，可被 Claude Code 调用）
- `~/.claude/hooks/post-edit-typecheck.sh` — PostToolUse hook 脚本

**修改文件：**
- `~/.claude/settings.json` — 添加 hooks.PostToolUse 配置

**核心设计：**
- 对抗性审查从 README.md 升级为 SKILL.md，加 name/description/触发词 frontmatter
- PostToolUse hook：每次 Write/Edit `.ts`/`.tsx` 后自动 `tsc --noEmit`
- 类型错误时 exit 非零传播错误，stderr 写入 `/tmp/hook-debug.log`
- grep 正则匹配 `ai-career-agent/src/` 下的 ts/tsx 文件

**对抗性审查修复（2 项）：**
- 🟡 exit 0 吞掉类型错误 → 捕获 tsc 退出码，失败时传播非零 exit
- 🟡 stderr 被 /dev/null 吞掉 → 改为写入 /tmp/hook-debug.log

**CLAUDE.md 零改动：** 全局 CLAUDE.md 保持 ~60 行不变，详细流程在 Skill 和 docs/ 里。

*归档自 SESSION.md，2026-06-30*

---

## 2026-06-30：Task E2 圆桌讨论综合

**新增文件：**
- `src/lib/evaluation/synthesis.ts` — E2 核心编排（交叉质疑 + 综合共识）

**修改文件：**
- `src/lib/evaluation/schema.ts` — 新增 CrossExaminationItemSchema、AgentCrossExaminationSchema、SynthesisConsensusSchema、SynthesisResult
- `src/lib/evaluation/prompts.ts` — 新增交叉质疑 prompt + 综合共识 prompt + buildCrossExaminationUserPrompt + buildSynthesisUserPrompt + synthesisAgentConfig
- `src/lib/evaluation/generator.ts` — runEvaluation 追加 E2 阶段（enableSynthesis 参数，失败降级为 E1）
- `src/lib/evaluation/index.ts` — 新增 synthesis 相关导出
- `src/app/api/evaluation/route.ts` — 从 Portrait 表读取 industrySpecific 传入评估（含运行时验证）

**核心设计：**
- E2-1 交叉质疑：5 Agent 并发，各看其他 4 个评估结果后提出质疑（5 次 LLM）
- E2-2 综合共识：圆桌主持人 Agent 读取全部评估 + 全部质疑，输出最终裁决（1 次 LLM）
- E2 失败不阻塞：降级为 E1 结果（加权平均）
- E2 综合共识覆盖 E1 聚合结果：overall_rating/score/confidence/one_sentence/strengths/weaknesses
- 保留 E1 原始 agents 数据供前端展示对比
- 圆桌主持人使用 qwen 模型、temperature 0.2（稳定裁决）

**对抗性审查修复（4 项，subAgent 冷审）：**
- 🟡 token 统计遗漏交叉质疑 5 次调用 → runSingleCrossExamination 返回 usage，runAllCrossExaminations 累加
- 🟡 综合共识 prompt 丢失 revised_perspective → 参数类型加字段 + 输出时追加修正视角
- 🟡 revised_perspective 强制必填 + agreement=true 语义矛盾 → 改为 .optional()
- 🟡 JSON.parse 无运行时验证 → 逐字段结构校验，失败降级为 undefined
- 🟢 catch 块无日志 → 加 console.warn
- 🟢 as unknown as 双重断言 → 提取 toEvaluationMap 工具函数
- 🟢 evaluationMap 构建逻辑重复 → 合并到 toEvaluationMap

**构建状态：** ✅ 通过

### Task E3：前端展示 ✅

**新增文件：** src/app/evaluation/page.tsx
**修改文件：** prisma/schema.prisma、src/app/api/evaluation/route.ts、src/app/dialogue/page.tsx、src/app/page.tsx
**核心功能：** 评估结果持久化 + GET API + 前端展示页（评级/共识/5 Agent Tab/交叉质疑/CoT展开）
**审查修复（4项）：** API路径不匹配、幂等保护、按钮防重复、复合索引

### Task F1：薪资数据收集 ✅

**新增文件：** src/lib/salary/（types/market-data/index）、src/app/api/salary/user-input/route.ts
**修改文件：** prisma/schema.prisma、knowledge/schema.ts、evaluation/schema.ts、evaluation/prompts.ts、evaluation/route.ts、3个positions JSON
**核心设计：** 薪资模块（分位计算+城市标准化+岗位推断）+ 用户输入API + 评估集成
**审查修复（8项）：** 岗位不匹配、除零防护、数据去重、标签矛盾、缓存感知、整数校验、字段选择、城市标准化

*归档自 SESSION.md，2026-06-30*

---

## 2026-06-30：Task G1 权重配置化 ✅

**目标：** 将 BARS 评估系统的权重配置从硬编码改为可配置，支持按岗位差异化配置。

**新增文件：**
- `src/lib/evaluation/config/weights.json` — 权重配置文件（default + 按岗位覆盖）
- `src/lib/evaluation/config/loader.ts` — 配置加载函数（缓存 + 校验）

**修改文件：**
- `src/lib/evaluation/bars.ts` — 常量 → 函数（buildBarsRubric / getAllRubrics / getAgentWeightsForAggregation）
- `src/lib/evaluation/prompts.ts` — 5 个 System Prompt 从常量 → buildXxxSystemPrompt(positionId?) 函数
- `src/lib/evaluation/generator.ts` — aggregateOverallRating 支持 positionId 参数
- `src/lib/evaluation/schema.ts` — EvaluationInput 新增 positionId 字段
- `src/lib/evaluation/index.ts` — 更新导出
- `src/app/api/evaluation/route.ts` — 传入 positionId 到评估输入

**核心设计：**
- 权重配置从硬编码常量改为 JSON 配置文件
- 支持按岗位（data-analyst / b2b-sales）差异化配置 Agent 间权重和维度权重
- 配置加载带缓存，避免重复读取
- validateWeightsConfig() 校验所有配置（含岗位覆盖）
- 权重缺失时硬校验（throw Error），不静默回退

**对抗性审查修复（4 项，subAgent 冷审）：**
- 🔴 positionId 从未传入 evaluationInput → route.ts 补上 positionId: inferPositionId(...) ?? undefined
- 🟡 维度名不匹配静默回退 0.2 → bars.ts 改为硬校验，throw Error
- 🟡 Agent 权重缺失静默回退 0.2 → generator.ts 改为 console.warn + skip
- 🟢 validateWeightsConfig 不校验岗位 → loader.ts 扩展校验所有 positions

**构建状态：** ✅ 通过

*归档自 SESSION.md，2026-06-30*

---

## 2026-06-30：Task G2 展示优化 ✅

**目标：** 优化评估结果页面的视觉展示效果。

**修改文件：**
- `src/app/evaluation/page.tsx`（唯一改动）

**核心改动：**

| 组件 | 改动 | 效果 |
|------|------|------|
| OverallRatingCard | 新增 `ScoreArc` 半环形 SVG 指示器 + `ratingDescription` 含义说明 | 评级视觉层次清晰，分数可视化 |
| SynthesisCard | 共识叙述加左侧竖线装饰 + 分歧改为编号 badge | 信息层级分明 |
| AgentEvaluationsCard | Tab 按钮改为评级概览条（5格卡片：图标+评级+名称） | 一眼看到整体评级分布 |
| AgentDetail | 移除维度评分折叠层，维度默认展开；优势/短板改编号 badge | 减少一次点击，排版统一 |
| DimensionRow | 推理链用左侧竖线装饰 + 按钮带方向箭头 ▼▲ + 证据用引号样式 | 推理链视觉区分度提升 |

**对抗性审查修复（2 项，subAgent 冷审）：**
- 🟢 ScoreArc 边界防护（NaN/越界）→ `Math.max(0, Math.min(100, ...))`
- 🟡 AGENT_META 空值防护（未知 agent key 不白屏）→ fallback 对象

**验收标准：**
- [x] 定性评级视觉设计清晰（半环形分数 + 含义说明）
- [x] 各Agent评语排版易读（评级概览条 + 编号列表）
- [x] 推理链可展开/收起（维度默认展开，推理一键切换）
- [x] 薪资分位展示（F2 已完成）

**构建状态：** ✅ 通过

*归档自 SESSION.md，2026-06-30*

---

## H2：neat-freak 提醒机制（2026-06-30）

### 改动文件（7个）
| 文件 | 改动 |
|------|------|
| src/lib/notification.ts | NotificationType 扩展 + notifyPortraitUpdated/notifyPortraitConflict |
| src/contexts/NotificationContext.tsx | 前端类型同步 |
| src/components/NotificationBell.tsx | typeConfig 新增 portrait_updated/portrait_conflict 图标 |
| src/app/api/portrait/extract/route.ts | trigger 参数 + 按类型幂等 + 通知创建 |
| src/app/api/dialogue/message/route.ts | X-Dialogue-State 增加 shouldExtract |
| src/hooks/useDialogue.ts | 客户端异步触发 extract（fire-and-forget） |
| src/app/api/dialogue/cleanup/route.ts | Step 3 删除前尝试画像提炼 |
| src/lib/portrait/extractor.ts | ExtractTrigger 类型 + savePortraitUpdateLog 接受 trigger |

### 核心逻辑
- 每 10 轮对话 → message 路由在 header 返回 `shouldExtract: true` → 客户端异步调 `/api/portrait/extract`
- extract 完成 → `portrait_updated`（自动应用）/ `portrait_conflict`（待审查）通知
- 清理 cron 删除 expired session 前 → 直接调用提取 lib，失败不阻塞清理
- 幂等策略：manual/session_end 严格一次，dialogue_round 5 分钟冷却期

### 对抗性审查修复（4 项，subAgent 冷审）：
- 🔴 dialogue_round 幂等导致只触发一次 → 改为 5 分钟冷却期
- 🟡 并发竞态 → 冷却期缓解 + 外层 try-catch
- 🟡 cleanup 缺 await → 确认实际代码有 await（误报）
- 🟢 trigger 参数未校验 → 白名单校验

### 验收标准：
- [x] 每 10 轮自动触发 extract
- [x] Bell 展示 portrait_updated/portrait_conflict 通知
- [x] 清理 cron 删除前提取
- [x] npm run build 通过

*归档自 SESSION.md，2026-06-30*

---

## H3：pending 更新列表 + accept/reject UI（2026-06-30）

### 改动文件（3个）
| 文件 | 改动 |
|------|------|
| src/components/PendingUpdateCard.tsx | **新建** — 单条 pending 更新卡片（字段映射+对比+accept/reject/merge） |
| src/app/portrait/page.tsx | **重写** — 替换占位符为 pending 列表页 |
| src/components/NotificationBell.tsx | **小改** — portrait_conflict 通知点击跳转 /portrait |

### 核心逻辑
- PendingUpdateCard：字段路径→中文映射、currentValue vs proposedValue 对比、accept/reject/merge 三种操作
- merge 编辑区：textarea + JSON 校验（对象/数组类型要求有效 JSON）
- portrait/page.tsx：GET /api/portrait/pending 获取列表，PendingUpdateCard 列表渲染
- NotificationBell：portrait_conflict 通知点击→标记已读→跳转 /portrait

### 对抗性审查修复（3 项采纳 / 3 项跳过，subAgent 冷审）：
- 🟡 merge 空值验证 → 增加 trim() 检查
- 🟡 merge 类型转换 → 对象/数组类型 JSON 解析失败时提示用户
- 🟢 count 不同步 → 删除 count 状态，用 updates.length 派生
- ⏭️ reject 无确认 → 跳过（V1 矛突量少，误操作概率低）
- ⏭️ 错误信息泄露 → 跳过（后端 API 已做错误控制）
- ⏭️ 可访问性 → 跳过（V1 不处理，后续统一优化）

### 验收标准：
- [x] pending 更新列表展示（字段名+对比+来源+时间）
- [x] accept/reject/merge 三种操作可用
- [x] merge 输入验证（空值+JSON格式）
- [x] portrait_conflict 通知点击跳转 /portrait
- [x] npm run build 通过

*归档自 SESSION.md，2026-06-30*

---

## 2026-06-30：Task I1-I2 流式输出 + 打字机效果 ✅

**分析结论：** 当前实现已达成 I1-I2 目标，无需迁移 useChat。

**现状：**
| 任务 | 实现 | 状态 |
|------|------|------|
| I1 流式输出 | `streamText` + `toTextStreamResponse()` + ReadableStream | ✅ |
| I2 打字机效果 | 流式逐字显示 + 光标闪烁 `animate-pulse` | ✅ |

**技术细节：**
- 后端：Vercel AI SDK `streamText` 生成流式响应
- 前端：手动 `fetch` + `ReadableStream` reader + `setStreamedText`
- 体验：AI 回复逐字出现 + 光标闪烁动画

**不迁移 useChat 的理由：**
1. 当前实现已工作，流式效果符合 SPEC（100ms/字由 LLM 响应速度决定）
2. `useChat` 不支持自定义 session 管理（pause/resume），需额外适配
3. 后端已用 `streamText`（Vercel AI SDK），符合"用 Vercel AI SDK"精神
4. 迁移成本 > 收益

**待做：**
- I3 对话恢复（从 DB 加载历史 + 自动保存 + 断线重连）
- roundtable 页面打字机效果（当前是 placeholder，实现圆桌讨论时一起做）

*归档自 SESSION.md，2026-06-30*

---

## 2026-06-30：Task I1-I2 对抗性审查修复 ✅

**触发条件：** 架构决策（不迁移 useChat）+ 代码审查发现 5 个问题

**修复清单：**

| # | 严重程度 | 问题 | 修复方案 | 文件 |
|---|----------|------|----------|------|
| 1 | 🔴 | onFinish 保存失败静默丢失 | 预保存关键状态 + onFinish 带重试 | message/route.ts |
| 2 | 🟡 | 快速连续发送读到过时状态 | 拆分保存时机：预保存 slotState/roundNumber | message/route.ts |
| 3 | 🟡 | 乐观更新失败不回滚 | catch 中回滚用户消息 | useDialogue.ts |
| 4 | 🟢 | TextDecoder 未 flush | 循环结束后调用 decoder.decode() | useDialogue.ts |
| 5 | 🟢 | Header 大小上限风险 | 记录，V2 优化 | - |

**架构改进：**
- 将状态持久化拆分为两步：
  1. **预保存**（流式响应返回前）：slotState、initialFindings、roundNumber
  2. **后保存**（onFinish 中）：AI 回复、recentWindow
- 这样即使 onFinish 失败，关键状态也不会丢失
- onFinish 中只保存 AI 回复和 recentWindow，减少失败影响范围

**重试机制：**
- onFinish 中保存失败时重试 2 次（共 3 次尝试）
- 每次重试间隔 500ms
- 最终失败时记录详细日志（sessionId、round、error）

**构建状态：** ✅ 通过

*归档自 SESSION.md，2026-06-30*

---

## 2026-07-01：Task I3 对话恢复 ✅

**目标：** 从 DB 加载完整历史消息 + 断线重连

### 改动文件（8个）
| 文件 | 改动 |
|------|------|
| src/app/api/dialogue/resume/route.ts | 返回完整历史消息（调用 getMessages） |
| src/app/dialogue/page.tsx | 恢复时使用 data.messages 替代 data.recentWindow |
| src/hooks/useDialogue.ts | 断线重连：while 循环重试替代递归 |
| src/lib/dialogue/session-manager.ts | getMessages 去掉 limit；resume 幂等处理 |
| src/app/api/dialogue/cleanup/route.ts | 适配 getMessages 签名变更 |
| src/app/api/evaluation/route.ts | 适配 getMessages 签名变更 |
| src/app/api/portrait/extract/route.ts | 适配 getMessages 签名变更 |
| src/app/api/portrait/build/route.ts | 适配 getMessages 签名变更 |

### 核心设计
- resume API 返回 `messages` 字段（完整历史），前端用 DB 消息替代 recentWindow 恢复
- getMessages 去掉 limit=50 限制，会话消息量有限不需要分页
- resume 幂等处理：对 active 状态的会话也返回成功，避免后续查询失败时会话卡死
- sendMessage 重试：while 循环替代递归，避免 finally 块破坏 isLoading/isStreaming 状态

### 对抗性审查修复（3项，subAgent 冷审）
- 🔴 sendMessage 递归重试 finally 状态竞争 → while 循环重试
- 🔴 resume 非原子导致会话卡死 → 幂等处理（active 也返回成功）
- 🟡 getMessages limit=50 截断消息 → 去掉 limit

### 验收标准
- [x] 刷新页面后完整历史消息恢复
- [x] 断网后自动重试（最多3次）
- [x] resume 幂等（active 状态也返回成功）
- [x] npm run build 通过

*归档自 SESSION.md，2026-07-01*

---

## 2026-07-01：Task K1 — JD解析

### 任务
实现模块二 JD 解析功能：用户粘贴 JD 文字或输入岗位名，AI 解析提取结构化岗位要求。

### 改动文件（5个）
| 文件 | 改动 |
|------|------|
| prisma/schema.prisma | 新增 JobDescription model + User relations |
| src/lib/jd/schema.ts | 新建：ParsedJdSchema Zod 类型定义 |
| src/lib/jd/parser.ts | 新建：JD 解析核心逻辑（system prompt + generateObject + 知识卡匹配） |
| src/lib/jd/index.ts | 新建：统一导出 |
| src/app/api/match/parse-jd/route.ts | 新建：POST /api/match/parse-jd API 路由 |

### 核心设计
- 复用 generateObject + Zod 模式（dialogue/message 已验证）
- 两种输入模式：text（完整JD，confidence=high）/ position_name（岗位名，confidence=low）
- 模糊输入时通过中文关键词→position_id 映射加载知识卡补充行业常识
- 不存原始 JD 文本（安全要求），只存结构化结果
- JobDescription model：parsedJson（JSON blob）+ positionName/confidence（标量查询字段）

### 对抗性审查修复（3项，subAgent 冷审）
- 🔴 DB 写入无 try-catch → 加 try-catch 返回 DB_ERROR
- 🟡 jd_text 无长度上限 → 加 10000 字上限校验
- 🟡 loadPositionKnowledge 异常未捕获 → 包裹 try-catch，失败不阻塞核心解析

### 验收标准
- [x] POST /api/match/parse-jd 完整 JD → confidence=high
- [x] POST /api/match/parse-jd 岗位名 → confidence=low + note
- [x] 未登录 → 401
- [x] 空输入 → 400
- [x] 过短文本 → 400 (UNRECOGNIZABLE)
- [x] 过长文本 → 400 (TEXT_TOO_LONG)
- [x] npm run build 通过

*归档自 SESSION.md，2026-07-01*

---

## 2026-07-01：Task K4 — 前端页面（岗位匹配流程）

### 任务
K1-K3 三个 API 已完成，需要前端页面串联完整流程：JD 输入 → 匹配报告 → 圆桌讨论。

### 新增文件（3个）
| 文件 | 说明 |
|------|------|
| src/components/match/JdInputStep.tsx | Step 1: JD 输入组件（text/position_name 双模式） |
| src/components/match/MatchReportStep.tsx | Step 2: 匹配报告展示（岗位概览+4维度+优势差距+简历优化） |
| src/components/match/RoundtableStep.tsx | Step 3: 圆桌讨论展示（3角色tab+投递建议+共识分歧） |

### 修改文件（2个）
| 文件 | 说明 |
|------|------|
| src/app/match/page.tsx | 替换 placeholder 为 3 步流程主页面 |
| src/lib/match/schema.ts | dimensions[].rating 类型收紧为 "强"|"中"|"弱" |

### 核心设计
- 单页 3 步流程（input → report → roundtable），不引入路由跳转
- K1 成功后自动触发 K2，无需用户手动操作
- 错误状态分阶段管理：jdError / analyzeError / roundtableError
- K2 失败时留在输入页，显示内联错误 + "重新分析"按钮（不丢 K1 结果）
- 复用 Card/Navbar/ratingStyle 等现有 UI 模式

### 对抗性审查修复（6项，subAgent 冷审）
| # | 严重程度 | 问题 | 修复 |
|---|----------|------|------|
| 1 | 🔴 | dimensions[].rating 类型是 string 而非枚举 | schema.ts 收紧为字面量联合 |
| 2 | 🔴 | K1 成功 K2 失败时全屏错误覆盖表单 | 拆分 jdError/analyzeError，K2 失败显示内联重试 |
| 3 | 🟢 | handleParseJd 缺 triggerAnalyze 依赖 | useCallback 依赖数组补上 |
| 4 | 🟡 | participants 空数组渲染空白卡片 | 加空数组守卫 + fallback 文案 |
| 5 | 🟡 | splitRounds 正则耦合后端格式 | fallback 展示加"完整发言"标签 |
| 6 | 🟢 | consensus 空数组缺少 fallback | 加空数组 fallback（与 disagreements 对称） |

### 验收标准
- [x] JD 输入 → 解析 → 匹配分析自动触发
- [x] 匹配报告展示（4维度+优势差距+简历优化）
- [x] 圆桌讨论展示（3角色+投递建议+共识分歧）
- [x] K2 失败可重试（不丢 K1 结果）
- [x] npm run build 通过（7.94 kB）

*归档自 SESSION.md，2026-07-01*

---

## 2026-07-01：L1 面试题生成

### 任务
Task L1 — POST /api/interview/generate-questions（模块三第一步）

### 新建文件（5个）
| 文件 | 说明 |
|------|------|
| src/lib/interview/schema.ts | Zod 类型：题目/输入/输出/响应 |
| src/lib/interview/prompts.ts | System Prompt（出题模式）+ User Prompt 模板 |
| src/lib/interview/generator.ts | generateQuestions + buildInterviewInput |
| src/lib/interview/index.ts | 公开导出 |
| src/app/api/interview/generate-questions/route.ts | POST API 路由 |

### 修改文件（1个）
| 文件 | 说明 |
|------|------|
| prisma/schema.prisma | InterviewSession 加 round 字段（一面/二面/终面/HR面） |

### 核心设计
- 复用 match 模块模式：schema.ts + generator.ts + prompts.ts + index.ts + route.ts
- generateObject + MiMo + Zod 结构化输出
- 题型分布：专业题 3-5 + 行为题 2-3 + 非标准题 1-2（共 6-10 道）
- 按面试轮次调整侧重（一面偏专业，终面偏战略/动机）
- 可选注入岗位知识卡（失败不阻塞）
- 幂等检查：同 jd_id + round + 未过期 + 未完成 → 返回已有题目

### 对抗性审查修复（8项，subAgent 冷审）
| # | 严重程度 | 问题 | 修复 |
|---|----------|------|------|
| 1 | 🔴 | 幂等检查缺 round 字段 | Prisma 加 round 字段 + 查询过滤 |
| 2 | 🟡 | 未过滤过期 session | 加 expiresAt: { gt: new Date() } |
| 3 | 🟡 | findFirst+create 并发竞态 | 二次检查 before create |
| 4 | 🟡 | JSON.parse 无异常处理 | try-catch，损坏时跳过重新生成 |
| 5 | 🟢 | 错误处理依赖字符串匹配 | 记录，与 match 模块一致暂不改 |
| 6 | 🟢 | \|\| 做默认值 0 值被误判 | 改为 ?? |
| 7 | 🟢 | inferPositionId 重复代码 | 记录，后续统一抽取 |
| 8 | 🟢 | loadPositionKnowledge 同步读文件 | 记录，现有模式暂不改 |

### 验收标准
- [x] POST /api/interview/generate-questions 可调用
- [x] 基于 JD + 画像 + 轮次生成 6-10 道定制化面试题
- [x] InterviewSession 持久化（含 round 字段）
- [x] 幂等检查（同 jd+round 返回已有）
- [x] npm run build 通过

*归档自 SESSION.md，2026-07-01*

---

## 2026-07-01：L2 模拟面试多轮对话

### 任务
Task L2 — POST /api/interview/answer（模块三核心难点）

### 新建文件（3个）
| 文件 | 说明 |
|------|------|
| src/lib/interview/answer.ts | 核心 answer handler（processAnswer + evaluateAnswer + makeDecision） |
| src/app/api/interview/answer/route.ts | POST API 路由 |
| src/app/api/interview/pause/route.ts | 暂停 API |
| src/app/api/interview/resume/route.ts | 恢复 API |

### 修改文件（4个）
| 文件 | 说明 |
|------|------|
| prisma/schema.prisma | InterviewSession 新增 conversationHistory/followUpCount/lastActivityAt/paused 状态 |
| src/lib/interview/schema.ts | 新增 AnswerInput/AiAnswerEvaluation/AnswerResponse 等类型 |
| src/lib/interview/prompts.ts | 新增 ANSWER_EVALUATION_SYSTEM_PROMPT + buildAnswerEvaluationPrompt |
| src/lib/interview/index.ts | 新增 processAnswer 等导出 |

### 核心设计
- 状态机：not_started → in_progress → paused → completed / abandoned / expired
- 追问决策由服务端控制（参考模块一 MAX_FOLLOWUP_COUNT 模式）
- 每题最多 3 次追问，过于简短/跑题→重新提问（不计次数）
- 最后一题答完自动标记 completed（makeDecision 传入 isLastQuestion）
- 暂停/恢复：保留对话历史，恢复后延长过期时间
- 单次 DB update 合并 answeredQuestions + 状态更新（避免两次写入不一致）
- tokenUsage 从 generateObject 返回值取真实 usage（非字符长度估算）

### 对抗性审查修复（8项，subAgent 冷审）
| # | 严重程度 | 问题 | 修复 |
|---|----------|------|------|
| 1 | 🔴 | makeDecision 永远不返回"完成" | 传入 isLastQuestion，最后一题返回"完成" |
| 2 | 🔴 | "转下一题"不检查是否还有题目 | 递增后检查 nextQuestion，无则 completed |
| 3 | 🟡 | paused/not_started 状态未拦截 | 入口只允许 in_progress，其他抛特定错误 |
| 4 | 🟡 | 两次 DB update 无事务保护 | 合并为单次 update |
| 5 | 🟡 | 无并发保护（TOCTOU） | 记录，V2 加 CAS 锁（#22） |
| 6 | 🟢 | tokenUsage 字符长度误导 | 改用 result.usage |
| 7 | 🟢 | resume 无条件覆盖 expiresAt | 提取 RESUME_EXPIRY_DAYS 常量 |
| 8 | 🟢 | pause 错误信息泄露内部状态 | 改为固定文案 |

### 验收标准
- [x] POST /api/interview/answer 可调用
- [x] 追问逻辑：好回答→追问，简短/跑题→重新提问（不计数），3次后→转题
- [x] 最后一题答完→completed
- [x] POST /api/interview/pause 暂停
- [x] POST /api/interview/resume 恢复（含对话历史）
- [x] npm run build 通过

*归档自 SESSION.md，2026-07-01*

---

## 2026-07-01：L3 面试评估 + 答案优化

### 任务
Task L3 — POST /api/interview/evaluate（模块三最后一步）

### 新建文件（3个）
| 文件 | 说明 |
|------|------|
| src/lib/interview/evaluate-prompts.ts | 评估 System Prompt（BARS 1-5 分锚定）+ User Prompt 构建 |
| src/lib/interview/evaluator.ts | 核心评估逻辑（evaluateInterview + buildEvaluationInput + buildQuestionThreads） |
| src/app/api/interview/evaluate/route.ts | POST API 路由 |

### 修改文件（3个）
| 文件 | 说明 |
|------|------|
| src/lib/interview/schema.ts | 新增 EvaluateOutputSchema / PerQuestionEvaluationSchema / EvaluateInput / QuestionThread 等类型 |
| src/lib/interview/index.ts | 新增 evaluateInterview / buildEvaluationInput 等导出 |
| prisma/schema.prisma | InterviewSession 新增 evaluation JSON 字段 |

### 核心设计
- 单次 generateObject 完成全部评估（4 维度 BARS + 逐题评估 + 答案优化 + Top 3 改进建议）
- 评估维度：专业深度 / 表达清晰度 / STAR结构运用 / 抗压表现（1-5 分，每维度有锚定描述）
- 答案优化原则：STAR 法则 + 量化结果 + 展示价值
- L2 追问处理：从 conversationHistory 按 questionId 分组，构建每题完整对话线索程（含追问轮次）
- 幂等：已有 evaluation 直接返回（不重复消耗 token）
- temperature 0.2（评估需要稳定）

### 对抗性审查修复（6项，subAgent 冷审）
| # | 严重程度 | 问题 | 修复 |
|---|----------|------|------|
| 1 | 🟡 | 幂等检查二次查询存在 TOCTOU 竞态 | 去掉二次查询，用 buildEvaluationInput 返回的 session.evaluation 做幂等 |
| 2 | 🟡 | update 缺 userId 条件，越权风险 | where 加 userId |
| 3 | 🟡 | 对话历史解析失败静默丢弃，AI 基于空数据评估 | 改为抛 INVALID_CONVERSATION_DATA 错误 |
| 4 | 🟢 | dimensions schema 不约束 key | z.record(z.string()) → z.record(z.enum(EVAL_DIMENSIONS)) |
| 5 | 🟢 | per_question 无 min(1) 约束 | 加 .min(1) |
| 6 | 🟢 | evaluate-prompts.ts 死代码 | 删除未使用的 question 变量 |

### 验收标准
- [x] POST /api/interview/evaluate 可调用
- [x] 4 维度 BARS 评分（1-5 分，锚定描述）
- [x] 逐题评估（评分 + 优势 + 不足 + STAR 优化答案 + 关键改进）
- [x] top_3_improvements 优先级排序
- [x] 答案优化遵循 STAR 法则
- [x] 幂等（重复调用返回已有评估）
- [x] npm run build 通过

*归档自 SESSION.md，2026-07-01*

---

## 2026-07-01：L4 面试前端页面

### 任务
Task L4 — 面试辅导前端页面（模块三最后一步）

### 新建文件（3个）
| 文件 | 说明 |
|------|------|
| src/components/interview/InterviewSetupStep.tsx | Step 1: 面试入口（选 JD + 轮次 → 生成题目） |
| src/components/interview/InterviewSessionStep.tsx | Step 2: 模拟面试（逐题回答 + 追问 + 暂停/恢复） |
| src/components/interview/InterviewReportStep.tsx | Step 3: 评估报告（4 维度 + 逐题 + Top 3 改进） |

### 修改文件（6个）
| 文件 | 说明 |
|------|------|
| src/app/interview/page.tsx | 重写：面试入口页面（InterviewSetupStep） |
| src/app/interview/session/page.tsx | 重写：模拟面试页面（Suspense + sessionStorage 传递数据） |
| src/app/interview/evaluation/page.tsx | 重写：评估报告页面（自动调用 evaluate API） |
| src/app/api/match/parse-jd/route.ts | 新增 GET 方法：列出用户的 JD 列表 |
| src/app/api/interview/resume/route.ts | 响应新增 questions 字段 + 支持 in_progress 状态恢复 |
| src/app/api/interview/evaluate/route.ts | 响应新增 questions 字段 |

### 核心设计
- 复用 K4 match/page.tsx 的 3 步流程模式
- 数据传递：sessionStorage 缓存 GenerateQuestionsResponse → session 页面读取
- 页面刷新恢复：resume API 返回完整 questions 列表（含 in_progress 状态）
- 评估页面自动调用 evaluate API（幂等，已有评估直接返回）
- 评估 API 响应新增 questions 字段（供逐题评估展示）

### 数据流
```
/interview → 选 JD+轮次 → POST /api/interview/generate-questions
  → sessionStorage 缓存 → 跳转 /interview/session?interview_id=xxx

/interview/session → 逐题回答 → POST /api/interview/answer
  → 追问/转下一题/完成 → 面试完成 → 跳转 /interview/evaluation

/interview/evaluation → POST /api/interview/evaluate
  → 显示评估报告（整体评分 + 4 维度 + 逐题 + Top 3）
```

### 对抗性审查修复（9项，subAgent 冷审）
| # | 严重程度 | 问题 | 修复 |
|---|----------|------|------|
| 1 | 🔴 | dimensions 为 null 时 Object.entries 崩溃 | 加 null/undefined 守卫 |
| 2 | 🟡 | 定时器未清理导致内存泄漏 | timerRefs + useEffect cleanup |
| 3 | 🟡 | JD 加载失败静默显示"无 JD" | catch 中设置 error 状态 |
| 4 | 🟡 | 评分解析正则假设特定格式 | 改进正则 + Math.min(5, ...) |
| 5 | 🟡 | sessionStatus 刷新后状态不一致 | resume API 支持 in_progress 状态 |
| 6 | 🟢 | useCallback 依赖 questions 数组 | 记录，当前可接受 |
| 7 | 🟢 | handlePause 错误静默吞掉 | 加 setError 提示 |
| 8 | 🟢 | API 响应结构假设脆弱 | 记录，当前 API 已稳定 |
| 9 | 🟢 | priorityIcons 数组越界 | 加边界检查 |

### 验收标准
- [x] 面试入口：选择 JD + 轮次 → 生成面试题
- [x] 模拟面试：逐题回答 + 追问 + 暂停/恢复
- [x] 评估报告：整体评分 + 4 维度 + 逐题评估 + Top 3 改进
- [x] 页面刷新可恢复（resume API）
- [x] npm run build 通过

*归档自 SESSION.md，2026-07-01*

---

## 2026-07-01：对抗性审查修复 + 上线规划

### 对抗性审查修复（7项 + 2项审查追加）

| 编号 | 问题 | 文件 | 修复内容 |
|------|------|------|----------|
| P0-1 | 认证机制断裂 | `src/lib/middleware/auth.ts` | `getAuthUser` 增加 cookie 回退，兼容 middleware 和 API 路由 |
| P0-2 | /api/chat 无认证 | `src/app/api/chat/route.ts` | 添加 `getAuthUser` 认证检查，401 拦截未认证请求 |
| P1-1 | message 无长度限制 | `src/app/api/dialogue/message/route.ts` | 添加 5000 字长度校验，超出返回 400 |
| P1-2 | 错误信息泄露内部细节 | `evaluation/route.ts`、`portrait/extract/route.ts` | catch 块只返回通用错误信息，详细错误仅 console.error |
| P1-3 | roundtable JSON.parse 无保护 | `coaching/roundtable/route.ts` | 幂等检查分支的 JSON.parse 包裹 try-catch，返回明确错误 |
| P1-4 | complete JSON.parse 无保护 | `coaching/complete/route.ts` | `portraitJson` 解析失败返回"画像数据异常，请重新进入职业认知" |
| P2-3 | StepIndicator bug | `coaching/page.tsx` | `steps.indexOf({...})` 改为 `steps.findIndex(step => step.key === current)` |

### 对抗性审查追加修复（2项）

| 问题 | 文件 | 修复内容 |
|------|------|----------|
| portrait/extract 第89行 JSON.parse catch 静默吞错误 | `portrait/extract/route.ts` | 补充 `console.error("画像JSON解析失败:", user.id)` |
| coaching/complete `meta.sources.includes()` 可能在非数组数据上崩溃 | `coaching/complete/route.ts` | 添加 `Array.isArray(portraitData.meta.sources)` 防御性检查 |

### 对抗性审查结论

- 7 项修复全部通过审查，无阻断性回归
- cookie fallback 安全性确认：cookie 名称一致（`token`），无认证绕过路径
- `/api/chat` 认证与 middleware 形成双重保护（defense-in-depth）
- StepIndicator `findIndex` 逻辑正确，类型安全
- 5000 字限制合理（与面试回答限制一致），前端 textarea 建议后续加 `maxLength`

### 上线规划（Phase 0-7）

| Phase | 内容 | 预估时间 |
|-------|------|----------|
| 0 | 基础设施就绪（Git、.env.example、JWT_SECRET） | 1-2 天 |
| 1 | 安全加固（速率限制、安全 Headers、CORS） | 2-3 天 |
| 2 | 可观测性（Sentry、结构化日志、健康检查） | 2-3 天 |
| 3 | 测试体系（Vitest、P0/P1/P2 测试用例） | 3-5 天 |
| 4 | CI/CD（GitHub Actions + Vercel） | 1-2 天 |
| 5 | 数据库迁移（Turso 生产库初始化） | 1 天 |
| 6 | 灰度发布（Alpha → Beta → 全量） | 1-2 天 |
| 7 | 上线 Checklist | — |

### 验收标准
- [x] P0-1 认证机制修复：cookie + Bearer 双路径
- [x] P0-2 /api/chat 认证保护
- [x] P1-1 消息长度限制（5000字）
- [x] P1-2 错误信息不泄露内部细节
- [x] P1-3/P1-4 JSON.parse 独立保护
- [x] P2-3 StepIndicator bug 修复
- [x] 对抗性审查通过（3路并行审查）
- [x] 追加修复：meta.sources 防御性检查
- [x] 追加修复：portrait/extract JSON.parse 日志
- [x] npm run build 通过
- [x] 上线规划完成（Phase 0-7）

*归档自 SESSION.md，2026-07-01*

---

## 会话 2026-07-02：Phase 3 测试体系

### 完成任务
- [x] 3.1 安装 Vitest + 配置（vitest.config.ts + package.json scripts）
- [x] 3.2 P0 测试用例（认证、对话核心流程）— auth.ts + slot-state.ts
- [x] 3.3 P1 测试用例（面试、匹配、评估）— consensus.ts + interview/schema.ts
- [x] 3.4 P2 测试用例（边界情况、错误处理）— edge-cases.test.ts
- [x] 3.5 验证 npm run build 通过（62 页面全部生成）
- [x] 3.6 对抗性审查（12 项发现，修复 6 项，记录 4 项已知限制）

### 测试覆盖

| 测试文件 | 测试数 | 覆盖范围 |
|----------|--------|----------|
| tests/lib/auth.test.ts | 31 | 密码哈希、JWT、验证码、密码强度、Cookie |
| tests/lib/dialogue/slot-state.test.ts | 74 | Slot 创建/填充/查询、问题追踪、进度计算、流程控制 |
| tests/lib/evaluation/consensus.test.ts | 11 | majorityVote 共识算法 |
| tests/lib/interview/schema.test.ts | 16 | Zod Schema 验证（轮次、题目、输入输出） |
| tests/lib/edge-cases.test.ts | 18 | 边界情况（特殊字符、Unicode、不可变性等） |
| **合计** | **150** | |

### 对抗性审查结果

| # | 严重度 | 问题 | 处理 |
|---|--------|------|------|
| 1 | 🔴 | addTurnToWindow 断言阈值错误（RECENT_WINDOW_SIZE=3，测试写 6） | ✅ 已修 |
| 2 | 🔴 | fillSlot 不可变性测试不充分 | ✅ 已修 |
| 3 | 🔴 | TEST_SLOTS 缺少 type/default_question 必填字段 | ✅ 已修 |
| 4 | 🟡 | consensus.test.ts 未测试 runWithConsensus 主函数 | 已知限制 |
| 5 | 🟡 | edge-cases 测试名与行为不匹配 | ✅ 已修 |
| 6 | 🟡 | majorityVote 依赖 Object.entries 排序稳定性 | 已知限制 |
| 7 | 🟡 | 不同测试文件使用不同 JWT_SECRET | ✅ 已修：pool: 'forks' |
| 8 | 🟡 | 缺少 sendVerificationEmail 测试 | 已知限制 |
| 9 | 🟡 | getUsedQuestionVariants 无测试覆盖 | ✅ 已修 |
| 10 | 🟢 | validatePasswordStrength 错误消息用中文硬编码 | 已知限制 |
| 11 | 🟢 | fillSlot 改口场景未验证旧值保留 | ✅ 已修 |
| 12 | 🟢 | 覆盖率配置未排除 types.ts | ✅ 已修 |

### 新增文件
- vitest.config.ts
- tests/lib/auth.test.ts
- tests/lib/dialogue/slot-state.test.ts
- tests/lib/evaluation/consensus.test.ts
- tests/lib/interview/schema.test.ts
- tests/lib/edge-cases.test.ts

*归档自 SESSION.md，2026-07-02*

---

## 会话 2026-07-02~07-06：Phase 0-6 完整上线流程

### Phase 0 基础设施 ✅
- Git 仓库初始化 + .env.example + JWT_SECRET + build 验证

### Phase 1 安全加固 ✅
- 速率限制（滑动窗口 100次/分钟/IP）+ 安全 Headers + CORS + 对抗性审查（6项）

### Phase 2 可观测性 ✅
- Sentry 三端集成 + 结构化日志（pino）+ 健康检查 + 对抗性审查（7项）

### Phase 3 测试体系 ✅
- Vitest 配置 + 150 测试用例（P0/P1/P2）+ 对抗性审查（12项）

### Phase 4 CI/CD ✅
- GitHub Actions PR 检查 + Vercel 部署配置 + Sentry dryRun guard

### Phase 5 数据库迁移 ✅
- Turso 生产库 + Prisma schema push + 4 个索引 + 对抗性审查（8项）

### Phase 6 灰度发布（6.2 部署完成）
- 6.1 邀请码机制（Schema + API + 注册集成）+ 对抗性审查（10项）
- 6.2 阿里云 ECS 部署（nginx + pm2 + 开机自启）
- 6.6 监控告警验证 + 6.7 回滚方案确认
- 待做：6.3 Alpha 测试 → 6.4 Beta → 6.5 全量

### Phase 6.1.1 对抗性审查（10项）
| # | 严重度 | 问题 | 处理 |
|---|--------|------|------|
| 1 | 🔴 P0 | 用户创建+邀请码消耗无事务保护 | ✅ db.$transaction |
| 2 | 🔴 P0 | 邀请码 TOCTOU 竞态 | ✅ WHERE use_count < max_uses |
| 3 | 🟡 P1 | 已注册未验证用户重复消耗邀请码 | ✅ 检查已有使用记录 |
| 4 | 🟡 P1 | maxUses/expiresInDays 无输入验证 | ✅ 范围校验 |
| 5 | 🟡 P1 | 单条插入性能 | ✅ 批量事务插入 |
| 6 | 🟢 P2 | 信息泄露 remainingUses | ✅ 不返回 |
| 7 | 🟢 P2 | 邀请码模偏差 | 记录：8位码空间足够 |
| 8 | 🟢 P2 | 错误响应格式不一致 | 记录：可接受 |
| 9 | 🟢 P2 | 前端重复处理 | 记录：防御性设计 |
| 10 | 🟢 P2 | 日志记录邀请码明文 | ✅ 只记录userId |

### 部署信息
| 项目 | 详情 |
|------|------|
| 服务器 | 阿里云 ECS（Ubuntu 22.04.5 LTS） |
| IP | 116.62.149.221 |
| 进程管理 | pm2（开机自启已配置） |
| 反代 | nginx → port 3000 |
| 公网地址 | http://116.62.149.221 |
| 数据库 | Turso 生产库 |
| 健康检查 | http://116.62.149.221/api/health |

*归档自 SESSION.md，2026-07-06*
