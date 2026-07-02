# V1 开发规格：全功能（模块一+模块零+模块二+模块三）+ 画像系统 + 反馈收集

> 版本：v3.0
> 日期：2026-06-17
> 状态：方案确认，准备开发

---

## 1. 概述

### 1.1 目标

构建 AI 职业智囊的 V1 全功能版本，包含：
- **模块一：职业认知** — 用户上传简历，通过AI引导对话建立职业画像，获得市场定位和跳槽建议
- **模块零：当前工作辅导** — 当结论为"不该跳"时，获得当前岗位提升方案
- **模块二：岗位匹配** — 输入目标JD，获得匹配评级和差距分析
- **模块三：面试辅导** — 模拟面试+答案评估，获得优化建议和示范回答
- **画像系统** — 动态模板生成 + 三层定制化架构 + 长记忆更新机制
- **反馈收集** — 飞书 Webhook 实时推送

### 1.2 用户价值

用户在 45-60 分钟内完成全链路：
- 模块一（15分钟）：竞争力定性评级+薪资定位+职业画像+圆桌讨论+跳/观望/不跳结论
- 模块零（20分钟，如需）：当前岗位提升方案+行动计划
- 模块二（5分钟）：JD匹配评级+差距分析+投递建议
- 模块三（20分钟）：模拟面试+答案评估+示范回答

### 1.3 成功标准

| 指标 | 目标 |
|------|------|
| 诊断完成率 | ≥70%（上传简历→拿到报告） |
| 报告满意度 | ≥4.0/5 |
| 全链路完成率 | ≥40%（完成模块一+二+三） |
| 平均对话轮数 | ≥4轮（模块一） |

---

## 2. 用户故事

> **权威来源：** PRD.md §7（User Stories & Requirements）
> 详细验收标准见 → specs/acceptance-criteria.md

**V1 核心用户故事（摘要）：**
- US-01~05：简历上传→解析确认→快速诊断→引导对话→圆桌讨论（P0）
- US-06~07：暂停对话、画像进度（P1）
- US-08~09：结论判断、用户选择权（P0）
- US-21~23：画像查看、异议、进度（P0/P1）
- US-24：创始人查看反馈（P0）

→ 完整用户故事列表：PRD.md §7
→ 验收标准：specs/acceptance-criteria.md

---

## 3. 功能规格

### 3.1 简历上传

**功能描述：** 用户上传 PDF 格式的简历，系统解析并提取结构化信息。

**输入：**
- PDF 文件（≤10MB）— V1仅支持PDF格式

**输出：**
- 解析结果：姓名、当前职位、行业、工作年限、技能列表、项目经历、学历

**验收标准：**
```
Given 用户在上传页面
When 选择 PDF 文件（≤10MB）并点击上传
Then 系统开始解析，显示"正在分析你的简历..."

Given 用户上传了一个非 PDF 格式的文件
When 点击上传
Then 提示"请上传 PDF 格式的文件"

Given 用户上传了超过 10MB 的文件
When 点击上传
Then 提示"文件大小不能超过 10MB"
```

**技术要点：**
- 使用 pdf-parse 库解析 PDF
- 使用 MiMo 提取结构化信息
- 不存原始简历文件，解析后立即丢弃

---

### 3.2 解析确认

**功能描述：** 用户确认AI解析的信息，可修正错误。

**输入：**
- AI解析结果

**输出：**
- 用户确认/修正后的信息

**验收标准：**
```
Given AI完成简历解析
When 展示解析结果（职位、行业、年限、技能、项目）
Then 用户可以看到所有解析字段，每个字段可编辑

Given 用户修正了某个字段
When 点击确认
Then 更新后的信息保存到画像系统
```

---

### 3.3 画像模板生成

**功能描述：** 基于用户的岗位/行业/职级，动态生成定制化的画像模板。

**输入：**
- 简历解析结果（职位、行业、年限、技能）

**输出：**
- 定制化画像模板 JSON

**三层结构：**
```
Layer 1: 基础通用层（固定）
  · 身份信息（姓名、职位、行业、年限、城市）
  · 职业动机（为什么想跳槽）
  · 价值排序（薪资/成长/平衡/稳定）
  · 风险偏好、生活约束、发展诉求

Layer 2: 岗位动态定制层（按岗位生成）
  · 该岗位的核心能力维度
  · 该岗位的行业特定维度
  · 该岗位的市场供需维度

Layer 3: AI 能力层（固定+动态）
  · AI素养自评（固定问题）
  · 岗位AI替代风险（动态）
  · 岗位AI增效机会（动态）
  · AI技能缺口（动态）
  · AI时代竞争力模型（动态）
```

**实现方式：**
- 圆桌会议生成（2轮辩论）
- 参与角色：行业总监(动态) + 职业导师 + 心理学家 + AI效能专家

---

### 3.4 快速诊断（2026-06-12 重构）

**功能描述：** 基于简历信息生成市场定性定位。

**输入：**
- 简历解析结果
- 画像模板
- 知识卡（positions/{position}.json）

**输出（定性评估 + 有限量化）：**
- 竞争力评估：5/5优秀、4/5良好、3/5中等、2/5待提升、1/5需重点提升
- 一句话定位
- 各 Agent 评语（猎头/市场对标/职业导师/AI效能/心理学家，各 50-100 字）
- 薪资分位（P25/P50/P75/P90）← 有数据锚点的量化
- Top 2 优势 + Top 2 短板

**评估过程（内部严谨流程）：**
- 每个 Agent 独立评估，使用 BARS 风格 rubric（1-5 分锚定描述）
- 先输出 CoT 推理，再给分
- 加权聚合后映射到定性评级
- 运行 3 次取多数共识，保证一致性
- 输出完整推理链（用户可查看 WHY）

**验收标准：**
```
Given 用户确认了解析信息
When 等待诊断完成（5 Agent × 3次并行，流式输出）
Then 显示：竞争力定性评级（强/中/弱）+ 一句话定位 + 各Agent评语 + 薪资分位 + 优势/短板

Given 快速诊断完成
When 用户看到结果
Then 结果可截图分享（卡片格式，含产品水印）
```

**实现方式：**
- 市场对标 Agent（BARS 5维度评估）
- AI效能专家 Agent（BARS 3维度评估）
- 每个 Agent 运行 3 次取共识

---

### 3.5 引导式对话

**功能描述：** AI基于简历信息主动提问，逐层深入。

**输入：**
- 简历解析结果
- 画像模板
- 用户回答

**输出：**
- 结构化信息提取结果
- 下一个问题
- 初步发现（第2轮后）

**对话维度（基础通用）：**
1. 职业动机："让你最近开始考虑跳槽的直接原因是什么？"
2. 价值排序："薪资、成长空间、工作生活平衡，你怎么排？"
3. 风险偏好："如果跳槽后3个月没找到合适工作，你的财务状况如何？"
4. 生活约束："家庭、城市、通勤，有什么不能动的？"
5. 发展诉求："3年后你想成为什么样的职业状态？"
6. 能力自评："你做过的最有成就感的项目是什么？为什么？"

**对话维度（AI能力）：**
1. "你平时用AI工具吗？用过哪些？"
2. "你觉得AI会怎么影响你的岗位？"
3. "你有没有用AI来提效？效果如何？"

**对话维度（岗位动态）：**
- 根据画像模板中的岗位维度定制

**验收标准：**
```
Given 用户完成快速诊断
When 进入对话页面
Then AI基于简历信息提出第一个定制化问题

Given 用户回答了一个问题
When AI判断信息不充分
Then AI追问（最多追问3次）

Given 用户回答"不知道"或"随便"
When AI识别为无效回答
Then AI换一种方式重新提问，不写入画像

Given 对话进行到第4轮
When 用户回答完
Then 显示"初步发现"卡片（中间反馈）

Given 对话完成（4-6轮）
When 最后一轮结束
Then 生成职业画像，显示画像完成进度
```

**实现方式：**
- 对话引导 Agent
- 每轮输出结构化信息提取结果
- 第2轮后输出"初步发现"

---

### 3.6 画像生成

**功能描述：** 整合简历和对话信息，生成结构化职业画像。

**输入：**
- 简历解析结果
- 对话记录
- 画像模板

**输出：**
- 职业画像 JSON

**画像内容：**
```json
{
  "identity": {
    "name": "姓名",
    "current_role": "当前职位",
    "industry": "行业",
    "years": 工作年限,
    "city": "城市"
  },
  "career_summary": {
    "motivation": "想离开的核心原因",
    "value_ranking": ["成长空间", "薪资", "工作生活平衡"],
    "risk_tolerance": "低/中/高",
    "life_constraints": "关键约束",
    "development_goal": "3年发展目标"
  },
  "strengths": ["优势1", "优势2", "优势3"],
  "gaps": ["短板1", "短板2"],
  "career_segments": [
    {
      "position_id": "岗位ID",
      "industry": "行业",
      "company": "公司",
      "duration_years": 5,
      "key_skills": ["技能1", "技能2"],
      "key_achievements": ["成就1"],
      "departure_reason": "离开原因"
    }
  ],
  "career_narrative": {
    "main_theme": "贯穿多段经历的主线",
    "transition_rationale": "从前一段到这一段的核心转变",
    "composite_strength": "多段经历的组合优势"
  },
  "composite_profile": {
    "rare_combination": "稀有组合描述",
    "scarcity_level": "低/中/高/极高",
    "market_value_multiplier": 1.0,
    "core_narrative": "组合价值叙事"
  },
  "industry_specific": {
    "按模板动态生成的维度"
  },
  "ai_capability": {
    "ai_literacy": "AI素养自评",
    "replacement_risk": "AI替代风险",
    "enhancement_opportunity": "AI增效机会",
    "skill_gap": ["AI技能缺口"]
  },
  "career_clarity_score": 0.72
}
```

**验收标准：**
```
Given 对话完成
When 生成职业画像
Then 显示画像完成进度 + 已完成/未完成的维度列表
```

**实现方式：**
- 画像构建 Agent
- 按模板填充，不猜测

---

### 3.7 圆桌讨论

**功能描述：** 多AI角色并发讨论用户的职业方向。

**输入：**
- 职业画像
- 简历信息
- 对话记录

**输出：**
- 各角色分析
- 共识结论
- 分歧点
- 跳/观望/不跳结论
- 个性化理由

**角色配置（6+1，主持为+1）：**

| 角色 | 视角 | AI模型 | 核心问题 |
|------|------|--------|---------|
| 心理学家 | 决策心理 | MiMo | "你的焦虑是真实的还是被放大的？" |
| 行业总监（100%动态） | 行业趋势 | DeepSeek V4 | "你所在行业未来2年怎么变？" |
| 职业导师 | 职业发展 | 千问 Max | "基于你的画像，天花板在哪？突破点在哪？" |
| AI效能专家 | AI影响 | MiMo | "你的岗位被AI替代的风险？如何用AI提效？" |
| 猎头 | 市场价值 | DeepSeek V4 | "你在市场上值多少？什么样的人最受欢迎？" |
| 面试辅导 | 面试官视角 | 千问 Max | "候选人常犯什么错？什么回答能打动HR？" |
| 圆桌主持（+1） | 综合 | — | 综合观点，提炼共识和分歧 |

**讨论流程：**
```
Stage 1: 辩论式圆桌（AgentRound架构）
  · 6个角色+1个主持，多模型并发生成，每个角色200-400字
  · 3轮讨论（首轮亮明立场→交叉质疑→最终共识）
  · 打字机效果展示

Stage 2: 投票式结论（Council Decision架构）
  · 3个模型独立分析，各自给出"跳/观望/不跳"判断
  · 模型之间互相评议
  · 主持Agent综合生成最终结论+个性化理由
```

**验收标准：**
```
Given 职业画像生成完成
When 触发圆桌讨论
Then 6个角色并发生成发言（心理学家+行业总监+职业导师+AI效能专家+猎头+面试辅导）

Given 圆桌讨论完成
When 展示结果
Then 顶部显示共识结论 + 分歧点，下方显示完整辩论过程

Given 用户想快速查看结论
When 点击"收起辩论，只看结论"
Then 只显示共识和分歧，隐藏辩论过程

Given 模块一圆桌讨论完成
When 触发结论判断
Then 3个模型独立分析，互相评议，最终生成"跳/观望/不跳"结论+个性化理由
```

**实现方式：**
- AgentRound（多模型并发）
- Council Decision（投票式）
- 每个角色用不同AI模型，避免观点趋同

---

### 3.8 结论判断

**功能描述：** 基于圆桌讨论，生成跳/观望/不跳的结论。

**输入：**
- 圆桌讨论结果

**输出：**
- 结论（跳/观望/不跳）
- 理由
- 风险评分
- 分歧点
- 个性化建议

**验收标准：**
```
Given 圆桌讨论完成
When 系统生成结论
Then 显示三个选项之一："建议跳槽" / "建议观望" / "建议留下"
   + 每个选项附带理由

Given 结论为"建议留下"
When 显示结论
Then 同时显示"留任收益分析" + 提升方向概要

Given 用户看到结论
When 用户选择
Then 显示两个按钮："接受，进入工作辅导" / "不接受，我要看机会"

Given 用户点击"不接受，我要看机会"
When 系统收到选择
Then 直接进入模块二（岗位匹配），不阻拦
```

**实现方式：**
- 圆桌主持 Agent
- 不用固定分数线，由Agent综合判断

---

### 3.9 报告生成

**功能描述：** 生成完整的职业认知报告。

**输入：**
- 职业画像
- 圆桌讨论结果
- 结论

**输出：**
- 在线查看的报告页面

**报告内容：**
```
1. 市场定位
   · 竞争力评估（强/中/弱 + 一句话定位）
   · 各视角评语（猎头/市场对标/职业导师/AI效能/心理学家）
   · 薪资分位 + 薪资区间（有数据锚点的量化）
   · 评估推理链（可展开查看）
   · 留任收益分析（结论为"建议留下"时展示）

2. 职业画像
   · 核心标签
   · 价值排序
   · 风险偏好

3. 你的优势（Top 2）
4. 你的短板（Top 2）
5. AI适应力评估
6. 行动建议（Top 3）
7. 圆桌讨论结论
   · 共识
   · 分歧
   · 建议
8. 风险提示（心理学家质疑者角色的独立输出，如有）
   · 详细模板见 specs/report-templates.md
```

**验收标准：**
```
Given 报告生成完成
When 用户查看报告
Then 显示完整报告

Given 用户查看报告后
When 到达报告底部
Then 显示满意度评分（必填）+ 文字反馈（选填）
```

---

### 3.10 反馈收集

**功能描述：** 收集用户对报告的满意度评分和文字反馈。

**输入：**
- 满意度评分（1-5星，必填）
- 文字反馈（选填）
- 截图（选填）

**输出：**
- 存入数据库
- 飞书 Webhook 推送

**验收标准：**
```
Given 用户查看报告后
When 到达报告底部
Then 显示满意度评分（必填）+ 文字反馈输入框（选填）

Given 用户提交反馈
When 系统收到
Then 存入数据库 + 飞书Webhook推送

Given 用户评分1-2星
When 提交反馈
Then 额外弹出输入框："告诉我们哪里不满意"
```

**实现方式：**
- POST /api/feedback
- 飞书 Webhook 实时推送

---

### 3.11 岗位匹配：JD解析（模块二）

**功能描述：** 用户粘贴JD文字或输入岗位名，系统解析并提取结构化要求。

**输入：**
- JD文字（完整粘贴）或岗位名（如"某公司 销售总监"）

**输出：**
- 结构化的岗位要求（技能、经验、学历、薪资、地点）
- 置信度标注（high/low）

**验收标准：**
```
Given 用户在JD输入页面
When 粘贴完整的JD文字
Then AI解析JD，提取岗位要求，置信度=high

Given 用户只输入"某公司 销售总监"
When 点击分析
Then AI基于行业常识推断，置信度=low，提示"以下为推断结果，可能与实际JD有差异"
```

**技术要点：**
- 使用 MiMo 解析JD
- 不存原始JD，解析后丢弃
- 模糊输入时调用 positions/{position}.json 补充行业常识

---

### 3.12 岗位匹配：匹配分析（模块二）

**功能描述：** 基于用户画像和JD要求，生成多维度匹配分析。

**输入：**
- JD解析结果
- 用户画像（portrait_json）
- 岗位知识卡（positions/{position}.json）

**输出：**
- 总体匹配定性评级（强/中/弱）
- 4维度评级（技能/经验/薪资/发展）
- 差距清单（含严重程度和弥补建议）
- 优势清单
- 简历优化建议

**评估维度（BARS rubric，1-5 分锚定）：**

| 维度 | 权重范围 | 5分（高度匹配） | 3分（基本匹配） | 1分（严重不匹配） |
|------|----------|----------------|----------------|------------------|
| 技能匹配 | 30-50% | 核心技能全覆盖，且有额外稀缺技能 | 有1-2项可培养差距，基础技能满足 | 核心技能严重缺失，短期内无法弥补 |
| 经验匹配 | 20-35% | 年限/行业/岗位类型完全对口 | 有相关经验但需转型，或年限略不足 | 经验完全不相关，无迁移可能 |
| 薪资匹配 | 10-20% | 期望在JD范围内，且有谈判空间 | 期望略高（≤20%）但可谈 | 期望严重超出（>50%），无法达成 |
| 发展匹配 | 10-20% | 职级跨度合理，有明确成长空间 | 平级跳槽，发展预期中性 | 降级跳槽或天花板明显 |

**动态权重规则：**

| 岗位类型 | 技能匹配 | 经验匹配 | 薪资匹配 | 发展匹配 |
|----------|----------|----------|----------|----------|
| 技术岗（数据分析师） | 45% | 25% | 15% | 15% |
| 业务岗（B2B销售） | 30% | 35% | 20% | 15% |

**评估流程（五阶段流水线）：**
```
Step 1: 证据收集
  · 从用户画像 + JD解析 + 岗位知识卡中提取各维度相关证据

Step 2: 维度评分（BARS 锚定）
  · 每个维度独立评估，先 CoT 推理再给 1-5 分
  · 不允许直接输出数字
  · 必须引用具体证据支撑评分

Step 3: 加权聚合
  · 综合分 = Σ(维度分 × 权重) / 5，输出 0-1 连续值
  · 权重根据岗位类型动态调整

Step 4: 定性映射
  · 综合分 ≥ 0.75 → 强
  · 综合分 0.45-0.74 → 中
  · 综合分 < 0.45 → 弱

Step 5: 多次运行共识
  · 运行 3 次取多数评级
  · 若 3 次结果不一致，取中间值并标记 confidence=low
```

**验收标准：**
```
Given JD解析完成
When 生成匹配报告
Then 显示：总体匹配定性评级（强/中/弱）+ 4个维度评级 + 差距清单 + 优势清单

Given 匹配报告生成
When 展示优化建议
Then 每条建议包含：改什么、怎么改、为什么改 + 优先级排序

Given 匹配分析完成
When 用户查看评分详情
Then 可展开查看每个维度的BARS评分和推理链
```

**实现方式：**
- 岗位洞察 Agent（100%动态）：解析JD真实要求
- 行业总监 Agent：行业上下文分析
- 猎头 Agent：市场价值评估
- 3个Agent独立分析，综合生成报告
- 每个Agent使用相同BARS rubric，确保评分一致性

---

### 3.13 岗位匹配：圆桌讨论（模块二）

**功能描述：** 多角色讨论岗位适配度和投递建议。

**输入：**
- 匹配分析结果（§3.12 的 BARS 评分 + 差距清单 + 优势清单）
- 用户画像（portrait_json）
- 岗位知识卡（positions/{position}.json）

**输出：**
- 各角色分析
- 共识结论
- 分歧点
- 投递建议（值得投/谨慎考虑/不建议 + 个性化理由 + 下一步行动）

**角色配置（3角色，无独立主持）：**

| 角色 | AI模型 | 视角 | 核心问题 |
|------|--------|------|---------|
| 岗位洞察（100%动态） | DeepSeek V4 | JD解读 | "这个岗位的真实要求是什么？隐藏条件是什么？" |
| 行业总监（100%动态） | 千问 Max | 行业上下文 | "这个岗位在行业中的定位？未来2年趋势？" |
| 猎头 | MiMo | 市场价值 | "你去这个岗位值不值？你的竞争力如何？" |

**讨论流程（辩论式，2轮）：**
```
Stage 1: 辩论式圆桌（Promise.allSettled 并发）
  · 3个角色多模型并发生成
  · 每角色 150-250 字（比模块一的 200-400 字少，因为角色少、场景聚焦）
  · 2轮讨论：
    Round 1: 各自亮明立场（基于匹配分析结果，给出核心判断）
    Round 2: 交叉质疑 + 最终立场（引用其他角色观点，修正或坚持己见）
  · 不设独立主持，由 MiMo 综合层提取共识/分歧
  · 打字机效果展示（streamText 流式输出）

Stage 2: 综合结论（MiMo 综合层）
  · 读取 3 个角色的最终立场
  · 提取共识（多个角色都提到的观点）
  · 识别分歧（角色之间有冲突的观点）
  · 生成投递建议（值得投/谨慎考虑/不建议 + 个性化理由 + 下一步行动）
```

**与模块一圆桌的区别：**

| 维度 | 模块一（§3.7） | 模块二（§3.13） |
|------|---------------|----------------|
| 角色数 | 6+1（含主持） | 3（无独立主持） |
| 轮次 | 3轮 | 2轮 |
| 字数/角色/轮 | 200-400字 | 150-250字 |
| 类型 | 辩论式 + 投票式 | 仅辩论式 |
| 主持 | 独立主持Agent | MiMo综合层 |
| 结论 | 跳/观望/不跳 | 值得投/谨慎考虑/不建议 |
| 预估耗时 | 3-5分钟 | 1-2分钟 |

**验收标准：**
```
Given 匹配分析完成
When 触发圆桌讨论
Then 3个角色并发发言（岗位洞察+行业总监+猎头），每角色150-250字

Given Round 1 完成
When 进入 Round 2
Then 各角色交叉引用其他角色观点，修正或坚持己见

Given 2轮讨论完成
When MiMo 综合层处理
Then 显示：共识结论 + 分歧点 + 投递建议（值得投/谨慎考虑/不建议 + 个性化理由 + 下一步行动）

Given 用户想快速查看结论
When 点击"收起辩论，只看结论"
Then 只显示共识、分歧和投递建议，隐藏辩论过程
```

---

### 3.14 面试辅导：面试题生成（模块三）

**功能描述：** 基于JD和用户画像，生成定制化面试题。

**输入：**
- 目标岗位JD（复用模块二或新输入）
- 用户画像
- 面试轮次（一面/二面/终面/HR面）

**输出：**
- 专业题（3-5题）
- 行为题（2-3题）
- 非标准题（1-2题）

**验收标准：**
```
Given 用户选择目标岗位和面试轮次
When 生成面试题
Then 显示：专业题（3-5题）+ 行为题（2-3题）+ 非标准题（1-2题）
   每题标注类型和考察重点
```

**实现方式：**
- 面试辅导 Agent（100%动态）
- 基于JD定制，注入用户画像
- 非标准题考察AI认知和行业洞察

---

### 3.15 面试辅导：模拟面试（模块三）

**功能描述：** AI逐题提问，用户回答，AI追问（最多3次/题）。支持暂停/恢复/中途放弃。

**输入：**
- 面试题列表（§3.14 生成）
- 用户回答

**输出：**
- AI追问（基于用户回答内容）
- 转下一题信号
- 最终：所有题目的回答记录 + 追问记录（供 §3.16 评估使用）

**状态机：**
```
not_started
    ↓ （用户点击"开始面试"）
in_progress ←────────────────────┐
    ↓ （全部题目答完）          ↓ （用户点击"放弃"）     ↓ （5天无操作）
completed                    abandoned                expired
    ↓                           ↓                        ↓
进入 §3.16 完整评估      保留已答题目              提取已答题目到画像
                          可选择"继续"恢复 ────────┘   删除 session
                          可选择"查看部分评估"（需≥3题）
```

**状态定义：**

| 状态 | 说明 | 存储内容 |
|------|------|---------|
| not_started | 面试未开始 | 面试题列表 |
| in_progress | 面试进行中 | 当前题号 + 已答题目及回答 + 追问记录 + 各题追问次数 |
| completed | 面试完成 | 全部题目及回答 + 追问记录 |
| abandoned | 用户放弃 | 已答题目及回答 + 追问记录 + 放弃时的题号 |
| expired | 超期清理 | 同 abandoned，待清理 |

**存储：独立 `interview_sessions` 表（不复用 dialogue_sessions）**

> dialogue_sessions 的 slot_state 存的是"已填充 Slot + 置信度 + 填充时间"，是给对话系统的信息提取机制设计的。
> 模拟面试需要存的是"题号 + 已答记录 + 追问次数 + 追问历史"，数据结构完全不同。
> 两个模块的生命周期也不同（对话可以无限轮，面试有固定题数），用独立表避免耦合。

```sql
CREATE TABLE interview_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  jd_id TEXT,                          -- 关联的JD
  status TEXT DEFAULT 'not_started',   -- not_started / in_progress / completed / abandoned / expired
  questions TEXT NOT NULL,             -- JSON: 面试题列表 [{id, type, question, focus}]
  current_question_index INTEGER DEFAULT 0,
  answered_questions TEXT,             -- JSON: [{question_id, user_answer, followups[], followup_count}]
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME                  -- 5天超期
);
```

**暂停/恢复：**

```
暂停触发：
  · 用户关闭页面
  · 用户1小时无操作（自动暂停）
  · 用户点击"暂停面试"

暂停时保存：
  · 当前题号（current_question_index）
  · 已答题目及回答（answered_questions[]）
  · 各题追问次数（followup_counts{}）
  · 追问记录（followup_history[]）

恢复：
  · 用户重新进入模块三
  · 检测到 in_progress 或 abandoned 状态的 session
  · 显示"你上次答到第X题（共Y题），要继续吗？"
  · 选择"继续" → 状态改回 in_progress，从 current_question_index 继续
  · 选择"重新开始" → 状态改回 not_started，清空 current_question_index 和 answered_questions，从第一题开始
```

**中途放弃处理：**
```
用户点击"放弃面试"：
  → 弹窗确认："放弃后已答题目保留，你可以继续或查看部分评估"
  → 确认放弃：
    1. 状态改为 abandoned
    2. 已答题目及回答保留
    3. 显示两个选项：
       · "继续面试" → 状态改回 in_progress，从上次停下的题目继续
       · "查看部分评估" → 检查已答题目数：
         · < 3题 → 提示"至少需要答完3题才能生成评估，建议继续"，不生成评估
         · ≥ 3题 → 进入 §3.16 评估，标注"部分完成（X/Y题）"
  → 取消放弃：继续面试
```

**部分评估逻辑（参考 HireVue/Pymetrics 行业实践）：**

| 已答题目数 | 处理方式 |
|-----------|---------|
| < 3 题 | 不生成整体评级，只展示每题即时反馈（"这题回答偏短，建议用STAR结构"） |
| ≥ 3 题且 < 全部 | 生成评级，标注"部分完成（X/Y题）"，评级只基于已答题目 |
| 全部答完 | 生成完整评级，无标注 |

> 原则：只评已完成的题目，不惩罚未答题目。低于最低阈值不评分（避免基于2道题给出误导性评级）。

**结束条件：**

| 条件 | 触发 | 结果 |
|------|------|------|
| 正常完成 | 最后一题答完且无追问 | 状态 → completed，进入 §3.16 完整评估 |
| 用户放弃 | 用户点击"放弃"并确认 | 状态 → abandoned，≥3题可选部分评估 |
| 继续面试 | 用户在放弃后选择"继续" | 状态 → in_progress，从上次题目继续 |
| 重新开始 | 用户在恢复时选择"重新开始" | 状态 → not_started，清空进度 |
| 超期清理 | 5天无操作 | 状态 → expired，提取已答内容到画像，删除 session |
| 全部追问用完 | 每题追问3次后自动转下一题 | 正常流程，不触发状态变更 |

**追问逻辑：**
```
每题处理流程：
  1. AI展示题目 + 考察重点
  2. 用户提交回答
  3. AI评估回答质量：
     · 过于简短（<30字）或跑题 → 换一种方式重新提问（不计入追问次数）
     · 质量可追问 → 追问（追问类型：细节追问/数据追问/逻辑追问）
     · 质量足够 → 转下一题
  4. 追问次数限制：每题最多3次追问
  5. 3次追问用完 → 自动转下一题
  6. 用户连续3轮敷衍 → 提示"你的回答比较简短，面试官可能会追问更多细节，试试展开说说？"
  7. 每题答完 → 立即写入 interview_sessions.answered_questions（保证暂停不丢数据）
```

**验收标准：**
```
Given 用户提交了面试回答
When AI判断可以追问
Then 基于回答内容追问，最多追问3次

Given 用户回答过于简短或跑题
When AI判断
Then 换一种方式重新提问（不计入追问次数）

Given 用户中途关闭页面或1小时无操作
When 下次进入模块三
Then 显示"你上次答到第X题（共Y题），要继续吗？"
   选择"继续" → 从上次停下的题目继续
   选择"重新开始" → 清空进度，从第一题开始

Given 用户点击"放弃面试"
When 确认放弃
Then 已答题目保留，显示"继续面试"和"查看部分评估"选项

Given 用户放弃时已答题目 < 3题
When 选择"查看部分评估"
Then 提示"至少需要答完3题才能生成评估，建议继续"

Given 用户放弃时已答题目 ≥ 3题
When 选择"查看部分评估"
Then 进入答案评估，标注"部分完成（X/Y题）"，评级只基于已答题目

Given 面试session超过5天无操作
When 系统检测到
Then 提取已答内容到画像，删除session

Given 全部题目答完
When 最后一题无追问
Then 状态改为completed，自动进入答案评估（§3.16）
```

**实现方式：**
- 面试辅导 Agent（对话模式）
- 存储：独立 `interview_sessions` 表（见上方 DDL）
- 记录所有回答和追问，用于 §3.16 评估
- 每题最多追问3次
- 每题答完立即持久化（保证暂停不丢数据）
- 5天超期：定时任务检查 interview_sessions.expires_at < NOW()，提取已答内容到画像后删除

---

### 3.16 面试辅导：答案评估圆桌（模块三）

**功能描述：** 多角色评估面试表现，给出优化建议和示范回答。

**输入：**
- 所有面试题和用户回答
- 追问记录

**输出：**
- 整体评级（强/中/弱）
- 维度评分（BARS 1-5分）
- 逐题评估（评级+优缺点+优化建议+示范回答）
- Top 3 改进方向

**角色配置（2角色）：**

| 角色 | 视角 | 核心问题 |
|------|------|---------|
| 面试辅导 | 面试官视角 | "这个回答能打动HR吗？" |
| AI效能专家 | AI视角 | "这个岗位面试中AI相关问题怎么答？" |

**验收标准：**
```
Given 模拟面试完成
When 触发评估
Then 显示整体评级 + 维度评分 + 逐题评估 + Top 3改进方向

Given 用户查看评估
When 查看某题
Then 显示：你的回答摘要 + 评分 + 优缺点 + 优化建议 + 示范回答
```

**实现方式：**
- 面试辅导 Agent + AI效能 Agent 并发评估
- BARS rubric 1-5分评分
- 示范回答基于用户画像定制

---

### 3.17 对话状态管理（2026-06-12 重构）

**功能描述：** 管理对话的暂停、恢复、超期清理。

**核心设计原则：** 对话的核心目的是信息收集，服务于用户画像。Slot 数据 = 压缩后的对话。画像就是记忆。

**记忆架构：**
```
Layer 1: Slot 状态（核心，注入每次 prompt）
  · 存储：dialogue_sessions.slot_state (JSON)
  · 内容：已填充的 Slot + 置信度 + 填充时间 + 已问问题列表
  · 生命周期：会话内永久保留，对话结束后合并到画像

Layer 2: 对话窗口（辅助，保留对话流畅性）
  · 存储：dialogue_sessions.recent_window (JSON)
  · 内容：最近 3 轮原文（滑动窗口）
  · 生命周期：新轮次进入时丢弃最旧一轮

Layer 3: 初步发现（累积）
  · 存储：dialogue_sessions.initial_findings (JSON)
  · 内容：每轮对话后生成的洞察
  · 生命周期：会话内累积保留

Layer 4: 原始对话记录（归档）
  · 存储：dialogue_messages 表
  · 不注入 prompt，仅用于审计和回溯
```

**Prompt 注入内容（每次对话调用）：**
```
1. System Prompt（Agent 框架 + 规则）         ~300 tokens
2. Slot 状态（已收集的结构化信息）            ~200 tokens
3. 初步发现（累积的洞察）                    ~100 tokens
4. 最近 3 轮原文（对话流畅性）                ~200 tokens
5. 知识卡（岗位相关数据）                    ~200 tokens
总计：~1000 tokens
```

**增量提取（Delta Extraction）：**
```
每轮对话处理流程：
  1. 接收用户消息
  2. 增量提取：LLM 从消息中提取 NEW 信息（不重复处理已知信息）
  3. 合并到 Slot：只覆盖 None 字段，改口标记"待确认"
  4. 更新对话窗口：保留最近 3 轮，丢弃更早的
  5. 决定下一步：未填充 Slot → 问下一个 / 全部填充 → 结束对话
  6. 生成回复：基于 Slot + 窗口 + 初步发现 + 知识卡
```

**暂停/恢复：**
```
暂停（用户关闭页面/1小时无操作）：
  → 保存：slot_state + recent_window + initial_findings + round_number
  → 存入 dialogue_sessions 表

恢复（用户回来）：
  → 加载：slot_state + recent_window + initial_findings
  → 显示："你上次聊到第X轮，已收集了Y/8个维度，要继续吗？"
  → Agent 看到完整 Slot 状态，直接问未填充的 Slot，不重复提问
```

**超期清理：**
```
触发时机：5天超期
  → 提取 Slot 状态中的关键信息到画像
  → 删除 session
```

**验收标准：**
```
Given 用户在对话中途（第3轮）
When 关闭页面或退出
Then 对话进度保存，已回答的内容不丢失

Given 用户下次进入
When 系统检测到未完成的对话
Then 显示"你上次聊到第3轮，要继续吗？"

Given 对话超过10轮
When 用户回答完
Then 显示"我们已经聊了N轮了，要不要更新一下你的职业画像？"

Given 对话session超过5天
When 系统检测到
Then 提取关键信息到画像，删除session
```

---

## 4. Agent 系统

### 4.1 V1 Agent 列表（12个，动态占比模型）

| # | Agent | 动态占比 | 职责 |
|---|-------|---------|------|
| 1 | 对话引导 Agent | 30% | 主导引导式对话，基于简历生成个性化问题 |
| 2 | 画像构建 Agent | 20% | 整合信息为职业画像 |
| 3 | 市场对标 Agent | 50% | 市场定位（给出竞争力定性评级+薪资分位） |
| 4 | AI效能专家 Agent | 60% | 评估AI对职业的影响，注入岗位AI数据 |
| 5 | 心理学家 Agent | 0% | 决策心理视角（纯静态） |
| 6 | 职业导师 Agent | 10% | 职业发展视角，GROW教练模式 |
| 7 | 行业总监 Agent | 100% | 根据用户岗位+行业完全生成 |
| 8 | 猎头 Agent | 50% | 市场价值和人才视角 |
| 9 | 圆桌主持 Agent | 0% | 综合观点，提炼共识（纯静态） |
| 10 | 头部企业专家 | 100% | 根据用户意向公司+岗位完全生成 |
| 11 | 岗位洞察 Agent | 100% | 行业+岗位综合洞察（原行业专家+岗位洞察合并） |
| 12 | 面试辅导 Agent | 100% | 面试官视角+答案优化（原面试官+答案优化合并），参与圆桌 |

> Agent 架构详情见 PRD.md §5（Agent系统）
> V1 支持岗位见 PRD.md §11.1 决策#8

### 4.2 圆桌讨论机制

**辩论式圆桌（自研，基于 Vercel AI SDK）：**
- 多模型并发：MiMo + DeepSeek V4 + 千问 Max，Promise.allSettled 并行调用
- 3轮讨论：Round 1 各自发言 → Round 2 交叉注入上下文 → Round 3 最终立场
- 综合：MiMo 负责综合三个模型的最终输出
- 错误处理：Promise.allSettled 保证单个模型失败不阻塞讨论
- 打字机效果：streamText 流式输出

**投票式圆桌（自研，基于 Vercel AI SDK）：**
- 3阶段流水线
- 独立分析（3模型各自评估）→ 同行评议（互相打分）→ 主席综合（加权聚合）

---

## 5. 技术架构

### 5.1 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14 + Tailwind CSS |
| 后端 | Next.js API Routes |
| AI编排 | Vercel AI SDK + Promise.allSettled（自研圆桌编排） |
| AI模型 | MiMo（主力+对话+综合）+ DeepSeek V4 + 千问 Max（圆桌讨论并发） |
| 搜索增强 | 模型内置搜索（MiMo/DeepSeek/千问各自搜索能力） |
| 成本监控 | V1: 数据库记录每次会话token数；V2: Langfuse |
| 数据库 | Prisma + Turso（SQLite边缘部署） |
| 部署 | Vercel |
| 反馈收集 | 飞书 Webhook |

### 5.2 数据库 Schema

```sql
-- 用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME
);

-- 画像表
CREATE TABLE portraits (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(id),
  portrait_json TEXT NOT NULL,
  template_json TEXT,
  completion REAL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 对话会话表
CREATE TABLE dialogue_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  module TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  slot_state TEXT,           -- JSON: 已填充Slot+置信度+填充时间+已问问题列表
  recent_window TEXT,        -- JSON: 最近3轮原文（滑动窗口）
  initial_findings TEXT,     -- JSON: 每轮对话后生成的累积洞察
  round_number INTEGER DEFAULT 0,
  context_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

-- 对话消息表
CREATE TABLE dialogue_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES dialogue_sessions(id),
  role TEXT NOT NULL,
  agent_id TEXT,
  content TEXT NOT NULL,
  extracted_info TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 圆桌讨论表
CREATE TABLE roundtable_discussions (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES dialogue_sessions(id),
  module TEXT NOT NULL,
  participants TEXT NOT NULL,
  rounds TEXT NOT NULL,
  consensus TEXT,
  disagreements TEXT,
  risk_warning TEXT,  -- 心理学家质疑者输出（JSON），独立于共识
  recommendation TEXT,
  risk_rating TEXT,
  conclusion TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 报告表
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  session_id TEXT REFERENCES dialogue_sessions(id),
  module TEXT NOT NULL,
  report_type TEXT NOT NULL,
  content TEXT NOT NULL,
  satisfaction_score INTEGER,
  feedback_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agent 角色表
CREATE TABLE agent_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  module TEXT,
  system_prompt TEXT NOT NULL,
  analysis_dimensions TEXT,
  applicable_industries TEXT,
  version INTEGER DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 画像修正记录表
CREATE TABLE portrait_corrections (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 画像更新日志表
CREATE TABLE portrait_update_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  session_id TEXT REFERENCES dialogue_sessions(id),
  trigger TEXT NOT NULL,
  changes TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 待确认更新表（neat-freak冲突处理，决策#22）
CREATE TABLE pending_updates (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  field TEXT NOT NULL,               -- 冲突字段路径（如 career_summary.motivation）
  current_value TEXT,                -- 画像中的现有值
  proposed_value TEXT,               -- neat-freak提炼的新值
  source TEXT NOT NULL,              -- 来源：neat_freak / session_expiry
  session_id TEXT,                   -- 触发来源的session
  status TEXT DEFAULT 'pending',     -- pending / accepted / rejected / merged
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 模拟面试会话表（独立于 dialogue_sessions，见 §3.15）
CREATE TABLE interview_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  jd_id TEXT,                          -- 关联的JD
  status TEXT DEFAULT 'not_started',   -- not_started / in_progress / completed / abandoned / expired
  questions TEXT NOT NULL,             -- JSON: 面试题列表 [{id, type, question, focus}]
  current_question_index INTEGER DEFAULT 0,
  answered_questions TEXT,             -- JSON: [{question_id, user_answer, followups[], followup_count}]
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME                  -- 5天超期
);
```

### 5.3 API 端点

→ 详见 specs/api-endpoints.md（API端点权威来源）

---

## 6. 前端页面

| 页面 | 路由 | 说明 |
|------|------|------|
| Landing Page | / | 产品介绍 + 入口 |
| 简历上传页 | /upload | 拖拽上传 PDF |
| 解析确认页 | /parse | AI解析结果展示 |
| 快速诊断页 | /diagnosis | 竞争力评分 + 薪资分位 |
| 对话引导页 | /dialogue | 聊天界面 |
| 圆桌讨论页 | /roundtable | 打字机效果展示 |
| 职业认知报告页 | /report/career | 完整报告 + 反馈收集 |
| 职业仪表盘 | /dashboard | 画像进度 + 各模块结论 |
| 画像详情页 | /portrait | AI对你的理解 |

---

## 7. 非功能需求

| 需求 | 说明 |
|------|------|
| 性能 | 快速诊断≤3分钟（5 Agent × 3次并行），对话响应≤3秒 |
| 可用性 | Vercel部署，99.9%可用性 |
| 安全 | 不存原始简历，只存解析结果 |
| 成本 | 圆桌讨论token无上限，其他模块分层优化 |
| 兼容性 | V1只支持电脑端 |

---

## 8. 风险和缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| AI报告质量不稳定 | 高 | 致命 | Prompt工程+温度0.3+Few-shot+质量checklist |
| 中文PDF解析失败 | 中 | 中 | MiMo Vision fallback |
| 圆桌角色观点趋同 | 低 | 中 | 多模型并发+Prompt差异化 |
| Token成本过高 | 中 | 中 | 圆桌讨论token无上限，其他模块分层优化 |
| 用户网络断开 | 低 | 低 | 自动重连，继续对话 |

---

## 9. 遗留问题（V2及以后）

| 问题 | 阶段 | 说明 |
|------|------|------|
| 付费/免费用户记忆分层策略 | V2 | MVP全功能做，后续区分付费/免费的记忆深度 |
| 用户画像商业化策略 | V2 | 付费用户画像更深度、更持久 |
| 商业化策略整体思考 | V2 | 49元vs199元的功能差异 |
| 完整创始人后台 | V2 | V1用飞书Webhook |

---

## 10. 文档索引

| 文档 | 内容 |
|------|------|
| PRD.md | 产品需求全局 |
| specs/acceptance-criteria.md | 验收标准 |
| specs/user-flows.md | 用户流程图 |
| specs/agent-prompts.md | Agent Prompt规格 |
| specs/report-templates.md | 报告模板 |
| specs/api-endpoints.md | API端点规格 |
| module-0-career-coaching.md | 模块零专项 |
| BUSINESS-PLAN.md | 商业计划书 |

---

## 11. 开发计划

> **权威来源：**
> - 已确认决策 → PRD.md §11.1
> - 开发计划和时间线 → PLAN.md
> - 任务清单 → TASKS.md
> - 成功指标 → PRD.md §6
> - 风险和缓解 → PRD.md §9

**总工作量：44天（6周，副业节奏约7-8周）**

→ 详细开发计划：PLAN.md（阶段0→0.5→第一层→第二层→第三层→阶段9）
→ 详细任务清单：TASKS.md（41个任务）

### 11.2 第一层：基础架构（7天）

#### 用户认证系统（3天）

**功能描述：** 邮箱+密码注册/登录，单设备登录，密码重置。

**技术要点：**
- 邮箱+密码注册/登录
- 邮件验证码验证邮箱
- 单设备登录（踢掉旧设备）
- 密码重置（邮件验证码）
- JWT token认证

**数据库表：**
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME,
  login_attempts INTEGER DEFAULT 0,
  locked_until DATETIME
);

CREATE TABLE email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  code TEXT NOT NULL,
  type TEXT NOT NULL,
  expires_at DATETIME,
  used BOOLEAN DEFAULT FALSE
);

CREATE TABLE device_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  device_info TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME
);
```

#### 对话状态流转图（2天）

**功能描述：** 对话状态管理，支持暂停、恢复、超期清理。

**状态定义：**
| 状态 | 说明 | 存储内容 |
|------|------|---------|
| active | 对话进行中 | 完整对话上下文 |
| paused | 对话暂停 | 最近N轮对话（动态） |
| expired | 对话超期 | 最近N轮对话（待清理） |
| archived | 对话归档 | 已清理，关键信息已提取到画像 |

**动态上下文保留策略：**
```
对话轮数 ≤ 5轮：保留全部对话
对话轮数 6-10轮：保留最近5轮
对话轮数 11-20轮：保留最近8轮
对话轮数 > 20轮：保留最近10轮
```

**数据库表：**
```sql
CREATE TABLE dialogue_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  module TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  round_count INTEGER DEFAULT 0,
  context_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

CREATE TABLE dialogue_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES dialogue_sessions(id),
  role TEXT NOT NULL,
  agent_id TEXT,
  content TEXT NOT NULL,
  extracted_info TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 暂停/恢复/超期清理（2天）

**功能描述：** 对话暂停、恢复、超期清理机制。

**暂停机制：**
- 用户关闭页面/退出
- 用户点击"暂停对话"按钮
- 用户1小时无操作（自动暂停）

**恢复机制：**
- 用户登录后进入对话页面
- 检测到有paused状态的session
- 显示"你上次聊到第X轮，要继续吗？"

**超期清理机制：**
- 定时任务每天凌晨2点执行
- 检查expires_at < NOW()的session
- 发送站内+邮件通知
- 48小时后自动清理

### 11.3 第二层：业务逻辑（10天）

#### 画像模板生成（3天）

**功能描述：** 基于用户的岗位/行业/职级，动态生成定制化的画像模板。

**生成流程：**
```
第一步：职业导师生成通用基础模板（即时）
  · 身份信息、职业动机、价值排序、风险偏好、生活约束、发展诉求、能力自评

第二步：圆桌讨论生成定制化模板（3-5分钟，优先5分钟）
  · 参与角色：动态岗位Agent + 职业导师Agent + 心理学家Agent + AI效能专家Agent
  · 讨论内容：用户简历信息 + 用户提供的其他信息
  · 输出：该岗位的核心能力维度、行业特定维度、市场供需维度、AI能力维度

第三步：合并生成最终模板
  · 通用基础模板 + 定制化模板 = 最终用户画像模板
```

#### 竞争力评分算法（3天）

**功能描述：** 基于用户画像和简历信息，给出多维度的竞争力评分。

**评估维度（BARS rubric，1-5 分锚定）：**

每个 Agent 有独立的 BARS rubric，每个维度有强/中/弱的行为锚定描述。

| Agent | 维度数 | 核心维度 |
|-------|--------|---------|
| 市场对标 | 5 | 技能匹配、经验深度、行业稀缺性、简历表达力、市场需求度 |
| 猎头 | 6 | 市场稀缺性、薪资竞争力、简历竞争力、可迁移性、核心卖点、跳槽时机 |
| 职业导师 | 4 | 天花板距离、卡点数量、突破可行性、职业锚匹配 |
| AI效能专家 | 3 | AI替代风险、AI增效机会、技能缺口 |
| 心理学家 | 4 | 适应力、信心水平、焦虑管理、行动力 |

**评估流程（五阶段流水线）：**
```
Step 1: 证据收集
  · 从简历+对话+知识卡中提取各维度相关证据

Step 2: 维度评分（BARS 锚定）
  · 每个维度独立评估，先 CoT 推理再给 1-5 分
  · 不允许直接输出数字

Step 3: 加权聚合
  · 综合分 = Σ(维度分 × 权重) / 5，输出 0-1 连续值

Step 4: 定性映射
  · 综合分 ≥ 0.90 → 5/5：优秀 / 0.75-0.89 → 4/5：良好 / 0.45-0.74 → 3/5：中等 / 0.25-0.44 → 2/5：待提升 / < 0.25 → 1/5：需重点提升

Step 5: 多次运行共识
  · 运行 3 次取多数评级
  · 若 3 次结果不一致，取中间值并标记 confidence=low
```

**输出（定性评估 + 有限量化）：**
  · 竞争力评估：5/5优秀、4/5良好、3/5中等、2/5待提升、1/5需重点提升
  · 一句话定位
  · 各 Agent 评语（50-100 字）
  · 薪资分位（P25/P50/P75/P90）← 有数据锚点的量化
  · 优势和短板
  · 推理链（用户可展开查看 WHY）
```

#### 薪资分位数据源（2天）

**功能描述：** 基于公开数据和用户信息，给出薪资定位。

**数据来源优先级：**
```
优先级1：公开数据（最新时间月份）
  · 招聘网站薪资数据（猎聘、BOSS直聘、拉勾）
  · 行业薪资报告（艾瑞、易观、36氪）
  · 企业官方薪资信息（上市公司年报）

优先级2：用户补充数据
  · 用户在对话中提供的薪资信息
  · 用户上传的薪资证明（可选）

优先级3：AI推断数据
  · 基于岗位、行业、年限的薪资推断
  · 基于地理位置的薪资调整
```

**薪资分位计算：**
```
用户薪资分位 = (低于用户薪资的人数 / 总人数) × 100

输出：
  · 你的薪资分位：P55（中上）
  · 当前市场区间：18-35万/年
  · 你超过了55%的同岗位求职者
```

#### 评分公式和权重（2天）

**功能描述：** 动态生成评分权重，用户可见权重分配理由。

**权重生成流程：**
```
第一步：多Agent讨论权重分配
  · 市场对标Agent：基于市场数据提出权重建议
  · 行业总监Agent：基于行业特点提出权重建议
  · 职业导师Agent：基于职业发展提出权重建议

第二步：圆桌讨论综合
  · 各Agent亮明自己的权重建议
  · 讨论权重分配的合理性
  · 最终达成共识

第三步：生成权重说明
  · 各维度权重
  · 权重分配理由
  · 用户可见权重
```

### 11.4 第三层：体验优化（8天）

#### neat-freak机制（3天）

**功能描述：** 对话结束后，自动提炼关键信息到用户画像。

**触发时机：**
| 时机 | 说明 |
|------|------|
| 对话结束 | 每次对话完成后，自动提炼要点 |
| 15轮提醒 | 对话进行到15轮时，提醒用户更新画像 |
| 5天超期清理 | 对话超期后，提取关键信息到画像，删除session |

**提炼逻辑：**
```
输入：对话记录
    ↓
AI分析：
  · 识别新信息（之前画像中没有的）
  · 识别变化信息（之前画像中有，但这次对话中更新了）
  · 识别矛盾信息（之前画像中有，但这次对话中矛盾了）
    ↓
输出：
  · 新增字段：添加到画像
  · 更新字段：覆盖画像
  · 矛盾字段：标记，下次对话时确认
```

#### 前端状态管理（3天）

**功能描述：** 管理前端的交互状态，确保用户体验流畅。

**核心功能：**
| 功能 | 说明 |
|------|------|
| 流式输出 | AI回复逐字显示（100ms/字） |
| 正在输入... | AI回复前显示 |
| 打字机效果 | 圆桌讨论时每个角色发言逐字显示 |
| 对话恢复 | 用户回来后能看到之前的对话历史 |
| 自动暂停 | 1小时无操作自动暂停 |
| 离开保存 | 关闭页面时自动保存 |

#### 数据库迁移策略（2天）

**功能描述：** 管理数据库schema的版本和迁移。

**版本管理：**
- 每次schema变更，生成一个迁移文件（up.sql）
- 生成一个回滚文件（down.sql）
- 迁移文件按时间戳命名
- 记录在schema_migrations表中

**自动备份：**
- 每次迁移前自动备份
- 保留最近7天备份
- 超过7天的备份自动删除

### 11.5 开发工作量

| 层级 | 方案 | 开发工作量 |
|------|------|-----------|
| **阶段0：项目骨架** | Next.js+DB+UI+路由+AI SDK | 3天 |
| **阶段0.5：架构改造** | schema设计+数据迁移+模板改造+文档 | 3天 |
| **第一层：基础架构** | 用户认证系统 | 3天 |
| | 对话状态流转图 | 2天 |
| | 暂停/恢复/超期清理 | 2天 |
| **第二层：业务逻辑** | 画像模板生成 | 3天 |
| | 竞争力评分算法 | 3天 |
| | 薪资分位数据源 | 2天 |
| | 评分公式和权重 | 2天 |
| **第三层：体验优化** | neat-freak机制 | 3天 |
| | 前端状态管理 | 3天 |
| | 数据库迁移策略 | 2天 |
| **第四层：模块二+三** | 岗位匹配（JD解析+匹配分析+圆桌+前端） | 5天 |
| | 面试辅导（题生成+模拟面试+评估+前端） | 5天 |
| **阶段9：测试+上线** | 功能测试+体验优化+部署+种子用户 | 3天 |
| **总计** | | **44天** |

### 11.6 开发顺序

```
Week 1：项目骨架 + 架构改造
  Day 1-3：项目骨架（Next.js+DB+UI+路由+AI SDK）
  Day 4-6：架构改造（schema设计+数据迁移+模板改造）

Week 2：基础架构
  Day 7-9：用户认证系统
  Day 10-11：对话状态流转图
  Day 12-13：暂停/恢复/超期清理

Week 3：业务逻辑
  Day 14-16：画像模板生成
  Day 17-19：竞争力评分算法 + 评分公式和权重
  Day 20-21：薪资分位数据源

Week 4：体验优化
  Day 22-24：neat-freak机制
  Day 25-27：前端状态管理
  Day 28-29：数据库迁移策略

Week 5-6：模块二+三
  Day 30-31：JD解析 + 匹配分析
  Day 32-33：匹配圆桌 + 前端
  Day 34-35：面试题生成 + 模拟面试
  Day 36-38：答案评估 + 前端
  Day 39：报告导出

Week 7：测试+上线
  Day 40-41：功能测试 + 体验优化
  Day 42：部署上线
  Day 43-44：种子用户测试
```

### 11.7 成功指标

| 指标 | 定义 | 目标 |
|------|------|------|
| 诊断完成率 | 上传简历→拿到报告 | ≥70% |
| 报告满意度 | 用户评分1-5 | ≥4.0 |
| 全链路完成率 | 完成模块一+二+三 | ≥40% |
| 画像准确率 | 用户修正率 | ≤20% |
| 付费转化率 | 免费→付费 | ≥15% |
| 对话恢复成功率 | 用户回来后成功恢复对话 | ≥95% |

### 11.8 风险和缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| AI报告质量不稳定 | 高 | 致命 | Prompt工程+温度0.3+Few-shot+质量checklist |
| 薪资数据不准确 | 中 | 中 | 多来源交叉验证+用户补充 |
| 圆桌角色观点趋同 | 低 | 中 | 多模型并发+Prompt差异化 |
| neat-freak提炼不准确 | 中 | 中 | 人工审核+用户可修正 |
| 数据库迁移失败 | 低 | 高 | 自动备份+回滚机制 |
