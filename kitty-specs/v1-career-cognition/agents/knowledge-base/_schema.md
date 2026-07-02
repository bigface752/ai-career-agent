# 知识库 Schema 定义

> 版本：v1.0
> 日期：2026-06-12
> 设计原则：从 Agent 消费侧反推，每个字段必须有明确消费者

---

## 三层架构

```
knowledge-base/
├── global_knowledge.json      # 第一层：跨行业通用数据
├── industry_context.json      # 第二层：B2B行业通用但跨岗位数据
├── positions/                 # 第三层：岗位特定数据
│   ├── data-analyst.json
│   ├── b2b-sales.json
│   └── pmm.json
└── _schema.md                 # 本文件
```

**数据归属原则：**
- 被 2+ 个 Agent 使用且跨岗位 → global_knowledge.json
- 被 2+ 个 Agent 使用且 B2B 行业特定 → industry_context.json
- 岗位特定数据 → positions/{position}.json
- 只被 1 个 Agent 使用且与角色定义紧密耦合 → 留在 Agent 文件中

**占位符注入方式：** 字符串模板替换（lodash.template 或等效方案）
- `{global_knowledge}` → global_knowledge.json 序列化为格式化文本
- `{industry_context}` → industry_context.json 序列化为格式化文本
- `{knowledge_card}` → positions/{position}.json 序列化为格式化文本
- `{company_context}` → company_cache/{company}.json 序列化为格式化文本（搜索增强，可选）

---

## 会话数据层（Session Data Layer）

**说明：** 以下数据不属于三层知识库，而是用户特定的会话数据。它们存储在数据库中，由代码层面注入到Agent的prompt中。

**数据来源：** SPEC.md §5.2（数据库 Schema）

### 会话数据占位符

| 占位符 | 数据来源 | 说明 | 消费者 |
|--------|---------|------|--------|
| `{resume_parsed}` | `portraits.portrait_json` | 简历解析结果（姓名、职位、行业、年限、技能、项目、学历） | 所有Agent |
| `{career_portrait}` | `portraits.portrait_json` | 职业画像（身份、职业动机、优势、短板、多段经历等） | 所有Agent |
| `{dialogue_history}` | `dialogue_sessions.slot_state` + `dialogue_messages` | 对话记录（已填充的Slot + 最近N轮原文） | 心理学家、职业导师、AI效能专家、猎头、行业总监 |

### 数据结构

**{resume_parsed} 结构（来自 SPEC.md §3.1）：**
```json
{
  "name": "姓名",
  "current_role": "当前职位",
  "industry": "行业",
  "years": 工作年限,
  "skills": ["技能1", "技能2"],
  "projects": [...],
  "education": "学历"
}
```

**{career_portrait} 结构（来自 SPEC.md §3.6）：**
```json
{
  "identity": { "name", "current_role", "industry", "years", "city" },
  "career_summary": { "motivation", "value_ranking", "risk_tolerance", "life_constraints", "development_goal" },
  "strengths": ["优势1", "优势2", "优势3"],
  "gaps": ["短板1", "短板2"],
  "career_segments": [{ "position_id", "industry", "company", "duration_years", "key_skills", "key_achievements", "departure_reason" }],
  "career_narrative": { "main_theme", "transition_rationale", "composite_strength" },
  "composite_profile": { "rare_combination", "scarcity_level", "market_value_multiplier", "core_narrative" },
  "industry_specific": { "按模板动态生成的维度" },
  "ai_capability": { "ai_literacy", "replacement_risk", "enhancement_opportunity", "skill_gap" },
  "career_clarity_score": 0.72
}
```

**{dialogue_history} 结构（来自 SPEC.md §5.2）：**
```json
{
  "slot_state": {
    "motivation": { "value": "...", "confidence": "high", "filled_at": "..." },
    "value_ranking": { "value": [...], "confidence": "medium", "filled_at": "..." },
    // ... 其他Slot
    "questions_asked": ["问题1", "问题2"]
  },
  "recent_window": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "initial_findings": "每轮对话后生成的累积洞察"
}
```

### 注入方式

这些数据由代码层面注入到Agent的prompt中，不是知识库的一部分：
- `{resume_parsed}` → 从 `portraits.portrait_json` 中提取简历部分
- `{career_portrait}` → 从 `portraits.portrait_json` 中提取完整画像
- `{dialogue_history}` → 从 `dialogue_sessions.slot_state` + `dialogue_sessions.recent_window` + `dialogue_messages` 组合

---

## 多段经历知识卡加载规则（2026-06-12 新增）

**问题：** 用户可能有 2-3 段不同岗位/行业的经历（如：数据分析师→数据产品经理→B2B销售）。
当前系统假设 1 用户 = 1 岗位 = 1 知识卡，需要扩展为多卡加载。

**加载策略：**

```
用户有 3 段经历：数据分析师(电商) → 数据产品经理(B2B) → B2B销售(SaaS)
  → 加载 positions/data-analyst.json（第 1 段）
  → 加载 positions/data-product-manager.json（第 2 段，如有）
  → 加载 positions/b2b-sales.json（第 3 段）
  → 合成 composite_profile（稀有组合评估）
  → 最多 3 张知识卡 + 1 个 composite_profile 注入 Agent prompt
```

**加载规则：**
1. 解析用户简历，提取 career_segments 数组
2. 对每个 segment，加载对应的 positions/{position}.json（去重）
3. 如果某段经历的岗位不在 positions/ 中，用 LLM 通用知识替代
4. 合成 composite_profile（多段经历的组合稀缺度评估）
5. 最多加载 3 张知识卡（避免 prompt 过长）

**composite_profile 数据结构：**
```json
{
  "rare_combination": "数据分析师 + B2B销售",
  "scarcity_level": "极高",
  "market_value_multiplier": 1.5,
  "core_narrative": "懂数据的销售，能用数据证明ROI",
  "transferable_skills": [
    {"skill": "数据思维", "from": "data-analyst", "value_in": "b2b-sales"}
  ]
}
```

**组合类型与市场价值倍数：**

| 组合类型 | 倍数 | 说明 |
|---------|------|------|
| 同岗位同行业 | 1.0 | 无加权 |
| 同岗位不同行业 | 1.1 | 行业广度加分 |
| 跨岗位，技能相关 | 1.3 | 技能组合加分 |
| 跨岗位，稀有组合 | 1.5 | 稀缺性溢价 |

**设计原则：** 多段经历是"稀缺的复合型人才"，不是"经历不稳定"。composite_profile 要帮用户发现组合优势。

**元数据字段（每个 JSON 文件必须包含）：**
```json
{
  "meta": {
    "schema_version": "1.0",
    "last_updated": "2026-06-12",
    "confidence_level": "high|medium|low",
    "data_sources": ["来源1", "来源2"],
    "owner": "定义此数据的权威Agent或文件"
  }
}
```

---

## 第一层：global_knowledge.json

**消费者：** AI效能专家、市场对标、猎头、心理学家、圆桌主持
**数据来源：** ai-efficiency-expert.md §3.1-3.3

### 字段定义

| 字段路径 | 类型 | 说明 | 消费者 | 来源 |
|---------|------|------|--------|------|
| `meta` | object | 元数据 | — | — |
| `macro_ai_data.jobs_displaced` | object | AI替代岗位数 {number, source, year} | AI效能专家、心理学家 | WEF 2025 |
| `macro_ai_data.jobs_created` | object | AI创造岗位数 {number, source, year} | AI效能专家、心理学家 | WEF 2025 |
| `macro_ai_data.enterprise_adoption` | object | 企业AI采用率 {percentage, source, year} | AI效能专家 | Gartner 2026 |
| `macro_ai_data.automation_rate` | object | 任务自动化率 {percentage, source, year} | AI效能专家、市场对标 | Goldman Sachs 2025 |
| `macro_ai_data.agent_market` | object | AI Agent市场 {size_2026, size_2030, cagr, sources} | AI效能专家 | 多家市场研究 |
| `flagship_cases` | array | 标志性案例 [{company, action, data, source}] | AI效能专家、圆桌主持 | Klarna/IBM/GitHub |
| `ai_tools_catalog` | object | AI工具目录（按类别分组） | AI效能专家 | 2026年6月 |
| `ai_tools_catalog.coding_agents` | array | [{name, company, capabilities, price}] | AI效能专家 | — |
| `ai_tools_catalog.enterprise_platforms` | array | [{name, company, impact}] | AI效能专家 | — |
| `ai_tools_catalog.sales_automation` | array | [{name, capabilities}] | AI效能专家 | — |

---

## 第二层：industry_context.json

**消费者：** 市场对标、猎头、职业导师、AI效能专家、圆桌主持
**数据来源：** ai-efficiency-expert.md §2.5, market-benchmark.md, headhunter.md

### 字段定义

| 字段路径 | 类型 | 说明 | 消费者 | 来源 |
|---------|------|------|--------|------|
| `meta` | object | 元数据 | — | — |
| `b2b_vs_internet` | object | B2B vs 互联网对比 | 所有Agent | 多文件汇总 |
| `b2b_vs_internet.ai_replacement_speed` | object | {b2b, internet} | AI效能专家 | ai-efficiency-expert §2.5 |
| `b2b_vs_internet.ai_enhancement_opportunity` | object | {b2b, internet} | AI效能专家 | ai-efficiency-expert §2.5 |
| `b2b_vs_internet.core_competitive_advantage` | object | {b2b, internet} | AI效能专家、职业导师 | ai-efficiency-expert §2.5 |
| `b2b_vs_internet.salary_structure` | object | {b2b_range, internet_range, ceiling} | 市场对标、猎头 | market-benchmark |
| `b2b_vs_internet.industry_mobility` | object | {b2b, internet} | 猎头、职业导师 | headhunter |
| `b2b_characteristics` | object | B2B行业特征 | 猎头、职业导师 | headhunter |
| `b2b_characteristics.evaluation_focus` | string | B2B看重什么 | 猎头 | — |
| `b2b_characteristics.scarcity_source` | string | 稀缺性来源 | 猎头 | — |

---

## 第三层：positions/{position}.json

**消费者：** AI效能专家、市场对标、猎头、职业导师、画像构建、圆桌主持
**数据来源：** ai-efficiency-expert.md §4 + industry-director-*.md

### 字段定义

| 字段路径 | 类型 | 说明 | 消费者 | 来源 |
|---------|------|------|--------|------|
| `meta` | object | 元数据 | — | — |
| `position_id` | string | 岗位ID（如"data-analyst"） | — | — |
| `display_name` | string | 岗位中文名 | 对话引导、圆桌主持 | — |
| `sub_types` | array | 子赛道 [{name, description, ai_risk_level}] | AI效能专家 | industry-director |
| `ai_impact` | object | AI影响分析 | AI效能专家、画像构建(L3)、职业导师、心理学家 | ai-efficiency-expert §4 |
| `ai_impact.tasks_replaced` | array | [{task, ai_tool, replacement_rate}] | AI效能专家、画像构建 | — |
| `ai_impact.tasks_enhanced` | array | [{task, how}] | AI效能专家、职业导师 | — |
| `ai_impact.efficiency_gain` | string | 效率提升倍数 | AI效能专家 | — |
| `ai_impact.future_model` | string | 未来形态 | 职业导师、圆桌主持 | — |
| `ai_impact.replacement_mode` | object | 替代模式 {old_pattern, new_pattern} | 圆桌主持 | industry-director |
| `core_competencies` | object | 核心能力分析 | 画像构建(L2)、市场对标、猎头、职业导师 | industry-director §4 |
| `core_competencies.irreplaceable` | array | [{capability, why_ai_cant, importance}] | 画像构建、职业导师 | — |
| `core_competencies.being_replaced` | array | [{capability, ai_tool, replacement_rate}] | 画像构建、AI效能专家 | — |
| `industry_barriers` | array | [{barrier, description, protection_level}] | 猎头、职业导师、市场对标 | industry-director §4.3 |
| `salary` | object | 薪资数据 | 市场对标、猎头、职业导师 | market-benchmark + industry-director |
| `salary.confidence` | string | 数据置信度：high/medium/low | 市场对标 | — |
| `salary.last_updated` | string | 最后更新日期 | 市场对标 | — |
| `salary.data_source` | string | 数据来源 | 市场对标 | — |
| `salary.by_city` | object | 按城市分组的薪资分位 | 市场对标、猎头 | Apify爬取+LLM推断 |
| `salary.by_city.{city}.P25` | number | 25分位月薪 | 市场对标 | — |
| `salary.by_city.{city}.P50` | number | 50分位月薪 | 市场对标 | — |
| `salary.by_city.{city}.P75` | number | 75分位月薪 | 市场对标 | — |
| `salary.by_city.{city}.P90` | number | 90分位月薪 | 市场对标 | — |
| `salary.by_city.{city}.sample_size` | number | 样本量 | 市场对标 | — |
| `salary.by_city.default` | object | 全国默认分位 | 市场对标 | — |
| `transformation_path` | array | [{stage, timeframe, role, core_skills, tools}] | 职业导师、AI效能专家 | industry-director §5 |
| `required_ai_tools` | array | [{tool, priority, use_case, learning_time, price}] | AI效能专家、职业导师 | industry-director §5.2 |
| `anti_intuition_insights` | array | [{insight, evidence, implication}] | 圆桌主持、职业导师 | industry-director |

---

## Schema 版本管理

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-06-12 | 初始版本，支持 V1 三个岗位 |

**版本升级规则：**
- 新增字段：minor 版本号 +1（如 v1.0 → v1.1），向后兼容
- 删除/重命名字段：major 版本号 +1（如 v1.0 → v2.0），需要迁移所有 JSON 文件
