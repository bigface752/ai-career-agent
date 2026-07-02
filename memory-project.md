---
name: ai-career-agent-project
description: AI 职业智囊产品 — 副业项目，100MAU目标
metadata:
  node_type: memory
  type: project
  originSessionId: 865b6ddb-a57b-4255-9bf3-c1357a4df1eb
  lastUpdated: 2026-06-17
---

# AI 职业智囊

彭信远的副业项目：基于多Agent系统的Web端职业决策产品。

→ 产品需求：见 PRD.md
→ 技术架构：见 SPEC.md
→ 开发计划：见 PLAN.md
→ Agent定义：见 kitty-specs/v1-career-cognition/agents/
→ 文档更新规则：见 DOC-RULES.md

## 当前状态（2026-06-17）

- V1 = 全功能（模块一+模块零+模块二+模块三），不是分版本
- 文档一致性已修复（评分0-100残留、模块零角色、V2/V3标注）
- 总任务51个，预估44天（6周，副业节奏约7-8周）
- 12个Agent：10个有完整定义，头部企业专家和岗位洞察为100%动态生成
- 搜索增强：三层存储设计完成（岗位级+公司级+用户级）

## 关键决策

- 圆桌配置：模块一6+1，模块零4+1，模块二3，模块三2
- 评分体系：定性评级（强/中/弱），不给0-100分
- V1岗位：数据分析师、B2B销售（2个）
- neat-freak冲突：方案B（pending_updates表）

## 下一步

- 进入阶段0：项目骨架搭建
- 开始编码

**Why:** 这是彭信远的副业项目，100MAU目标，2100元初始投入。

**How to apply:** 每次进入ai-career-agent项目时，先读这个记忆文件了解当前状态。详细信息读PRD.md。

相关：[[doc-single-source-of-truth]]
