# AI 职业智囊 产品文档

## 目录结构

```
ai-career-agent/
├── README.md                      ← 本文件
├── PRD.md                         ← 产品需求文档（唯一权威来源）
├── BUSINESS-PLAN.md               ← 商业计划书
├── module-0-career-coaching.md    ← 模块零：当前工作辅导设计
├── specs/                         ← 可执行规格（开发参考）
│   ├── acceptance-criteria.md     ← 用户故事验收标准
│   ├── user-flows.md              ← 详细用户流程图
│   ├── agent-prompts.md           ← Agent System Prompt 规格
│   ├── report-templates.md        ← 报告模板结构
│   └── api-endpoints.md           ← API 端点规格
└── kitty-specs/                   ← 开发规格
    └── v1-career-cognition/
        ├── SPEC.md                ← V1开发规格
        ├── PLAN.md                ← 开发计划
        ├── TASKS.md               ← 任务清单
        └── agents/                ← Agent角色定义
```

## 阅读建议

- **快速了解产品**：读 `PRD.md`
- **开发参考**：读 `specs/` 目录下的规格文件
- **模块零设计**：读 `module-0-career-coaching.md`

## 产品一句话

"你在市场上值多少？下一步怎么走？"

三个模块：职业认知 → 岗位匹配 → 面试辅导
12个Agent（动态占比模型）+ 圆桌讨论 + 动态角色生成器
