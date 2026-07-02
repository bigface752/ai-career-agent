# 搜索策略 Schema 定义

> 版本：v1.0
> 日期：2026-06-12

---

## 用途

当知识库数据过期（>90天）或遇到未知岗位/公司时，触发搜索增强。
搜索结果用于更新 positions/*.json 或生成定制化认知。

## 文件结构

```
search-strategies/
├── _schema.md                 # 本文件
├── data-analyst.json          # 数据分析师的搜索策略
├── b2b-sales.json             # B2B销售的搜索策略
└── pmm.json                   # PMM的搜索策略
```

## 字段定义

| 字段路径 | 类型 | 说明 |
|---------|------|------|
| `meta` | object | 元数据 |
| `triggers` | array | 触发条件列表 |
| `triggers[].condition` | string | 触发条件描述 |
| `triggers[].trigger_type` | string | 类型：new_position / target_company / data_expired / unknown_company |
| `queries` | object | 按Agent分组的搜索查询模板 |
| `queries.{agent_name}` | array | [{query_template, variables, purpose}] |
| `result_processing` | object | 搜索结果处理规则 |
| `result_processing.extract_fields` | array | 需要从搜索结果中提取的字段 |
| `result_processing.output_target` | string | 结果写入目标：positions/{id}.json 或 sessions/{user_id}/ |
| `result_processing.confidence_check` | string | 结果质量检查规则 |

## 占位符变量

查询模板中可用的变量：
- `{position}` — 岗位中文名（如"数据分析师"）
- `{position_en}` — 岗位英文名（如"Data Analyst"）
- `{industry}` — 行业（如"B2B企业软件"）
- `{company}` — 公司名（如"阿里巴巴"）
- `{year}` — 当前年份

## 触发策略

| 触发类型 | 时机 | 说明 |
|---------|------|------|
| `new_position` | 用户岗位不在 positions/ 中 | 首次遇到新岗位，需要生成完整知识卡 |
| `target_company` | 用户提到意向公司 | 生成头部企业专家需要的公司信息 |
| `data_expired` | positions/{id}.json 的 last_updated > 90天 | 更新岗位知识 |
| `unknown_company` | 用户简历中的公司不在已知列表中 | 理解用户背景 |

---

## 搜索结果存储设计

### 存储分层

| 结果类型 | 存储位置 | 有效期 | 复用性 | 示例 |
|---------|---------|--------|--------|------|
| 岗位级数据 | positions/{position}.json | 90天 | 所有同岗位用户复用 | 薪资分位、AI替代率、核心能力 |
| 公司级数据 | company_cache/{company}.json | 30天 | 所有提到该公司的用户复用 | 公司规模、业务线、团队结构 |
| 用户级数据 | 不存储，注入当次对话 | 当次会话 | 仅该用户 | 用户意向公司的最新动态 |

### 岗位级结果合并规则

搜索结果合并到 positions/{position}.json 时，遵循以下规则：

```
1. 提取与现有 schema 字段对齐的数据
2. 更新 confidence_level（搜索结果 > 已有数据时提升）
3. 更新 last_updated 时间戳
4. 追加 data_sources（不覆盖，记录所有来源）
5. 标注 source = "search_enhancement"
```

**合并目标字段映射：**

| 搜索结果类型 | 合并到 positions/{position}.json 的字段 |
|------------|--------------------------------------|
| 薪资数据 | salary.by_city.{city}.P25/P50/P75/P90 |
| AI影响数据 | ai_impact.tasks_replaced, ai_impact.tasks_enhanced |
| 行业趋势 | industry_status (如有) |
| 公司招聘信息 | 不合并到 positions，存 company_cache |

### 公司级缓存结构

```json
{
  "meta": {
    "company": "Salesforce",
    "last_updated": "2026-06-17",
    "data_sources": ["search_enhancement", "company_official"],
    "confidence_level": "medium"
  },
  "company_info": {
    "name": "Salesforce",
    "industry": "B2B SaaS / CRM",
    "size": "50000+",
    "china_presence": true,
    "main_products": ["Sales Cloud", "Service Cloud", "Platform"],
    "culture_keywords": ["Ohana", "Trailhead", "1-1-1模型"]
  },
  "hiring_signals": {
    "active_positions": ["B2B销售", "解决方案架构师"],
    "salary_range": {"B2B销售": "25-45万"},
    "hiring_trend": "稳定"
  }
}
```

### Agent消费流程

```
1. Orchestrator 检查触发条件
   ↓
2. 触发搜索 → 调用模型内置搜索能力
   ↓
3. 解析搜索结果 → 提取结构化数据
   ↓
4. 按存储分层规则写入
   ↓
5. 注入到 Agent prompt 的占位符
   - 岗位级 → {knowledge_card}（已包含搜索更新）
   - 公司级 → {company_context}（新增占位符）
   - 用户级 → 直接拼接到 prompt
```

### 搜索触发时机（代码层面）

```typescript
// 在 Orchestrator 中，Agent 调用前检查
async function prepareAgentContext(userId, agentType, position, company) {
  // 1. 检查 positions/{position}.json 是否存在
  let knowledgeCard = await loadKnowledgeCard(position);

  // 1.5 不存在时，找最近岗位（见 ai-efficiency-expert.md 最近岗位匹配算法）
  if (!knowledgeCard) {
    const nearest = await findNearestPosition(position); // 映射表 → LLM兜底 → 默认data-analyst
    knowledgeCard = await loadKnowledgeCard(nearest);
    if (knowledgeCard) {
      knowledgeCard.confidence = 'low'; // 标记为低置信度
      knowledgeCard.nearest_source = nearest; // 记录来源
    }
  }

  // 2. 检查是否需要搜索增强
  if (!knowledgeCard || isExpired(knowledgeCard, 90)) {
    const searchResult = await triggerSearch(position, agentType);
    await mergeToKnowledgeCard(position, searchResult);
  }

  // 3. 检查公司级缓存
  if (company) {
    const companyCache = await loadCompanyCache(company);
    if (!companyCache || isExpired(companyCache, 30)) {
      const companyResult = await triggerCompanySearch(company);
      await saveCompanyCache(company, companyResult);
    }
  }

  // 4. 组装 Agent context
  return {
    knowledge_card: await loadKnowledgeCard(position),
    company_context: company ? await loadCompanyCache(company) : null,
    // ...
  };
}
```

### 搜索结果质量控制

| 检查项 | 规则 | 不通过处理 |
|--------|------|-----------|
| 数据来源 | 必须有可追溯的来源URL或来源名 | 丢弃，标注"无来源" |
| 数据时效 | 薪资数据≤6个月，行业趋势≤1年 | 标注"数据可能过期" |
| 数据一致性 | 与现有数据偏差≤30% | 保留两个版本，标注"待人工确认" |
| 数据完整性 | 核心字段（如P50薪资）不能为空 | 降级使用，标注"部分数据缺失" |
