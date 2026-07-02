# 会话状态（自动更新）

> **本文件记录当前任务进度和下一步行动，每次对话结束时更新。**
> **新对话开始时，先读本文件，然后继续工作。**
> **历史归档：见 [docs/session-archive.md](docs/session-archive.md)**

---

## 当前任务

**任务**：V1 上线准备 — Phase 0 基础设施就绪

**进度**：V1 开发全部完成 ✅，对抗性审查修复完成 ✅，上线规划完成 ✅

**下一步**：执行 Phase 0（Git 仓库 + .env.example + JWT_SECRET）

---

## 上线规划（Phase 0-7）

| Phase | 内容 | 预估时间 | 状态 |
|-------|------|----------|------|
| 0 | 基础设施就绪（Git、.env.example、JWT_SECRET） | 1-2 天 | ⬜ 待执行 |
| 1 | 安全加固（速率限制、安全 Headers、CORS） | 2-3 天 | ⬜ 待执行 |
| 2 | 可观测性（Sentry、结构化日志、健康检查） | 2-3 天 | ⬜ 待执行 |
| 3 | 测试体系（Vitest、P0/P1/P2 测试用例） | 3-5 天 | ⬜ 待执行 |
| 4 | CI/CD（GitHub Actions + Vercel） | 1-2 天 | ⬜ 待执行 |
| 5 | 数据库迁移（Turso 生产库初始化） | 1 天 | ⬜ 待执行 |
| 6 | 灰度发布（Alpha → Beta → 全量） | 1-2 天 | ⬜ 待执行 |
| 7 | 上线 Checklist | — | ⬜ 待执行 |

**总预估**：11-18 天

---

## Phase 0 任务清单

- [ ] 0.1 Git 仓库初始化（git init + 首次 commit + 推送 GitHub）
- [ ] 0.2 创建 .env.example（完整变量清单）
- [ ] 0.3 生成并配置 JWT_SECRET（openssl rand -base64 32）
- [ ] 0.4 验证 npm run build 通过

---

## Phase 0 环境变量清单

```bash
# 数据库
DATABASE_URL=file:./dev.db
TURSO_DATABASE_URL=libsql://<your-db>.turso.io
TURSO_AUTH_TOKEN=<your-token>

# JWT
JWT_SECRET=<generate-with-openssl-rand-base64-32>

# AI 模型 API Keys
MIMO_API_KEY=
DEEPSEEK_API_KEY=
DASHSCOPE_API_KEY=
GLM_API_KEY=

# 邮件
RESEND_API_KEY=

# 环境
NODE_ENV=production
```

---

## 已完成工作

### V1 开发（41个任务）
- 模块一（职业认知）：对话引擎 + 画像生成 + 评估
- 模块二（岗位匹配）：JD 解析 + 匹配分析 + 圆桌讨论
- 模块三（面试辅导）：题目生成 + 模拟面试 + 评估报告
- 模块零（职业辅导）：补充信息 + 圆桌讨论 + 提升方案
- 审计修复（8项）

### 对抗性审查修复（9项）
- P0-1 认证机制：cookie + Bearer 双路径
- P0-2 /api/chat 认证保护
- P1-1 消息长度限制（5000字）
- P1-2 错误信息不泄露内部细节
- P1-3/P1-4 JSON.parse 独立保护
- P2-3 StepIndicator bug 修复
- 追加：meta.sources 防御性检查
- 追加：portrait/extract JSON.parse 日志

---

## 工具建设

- **命令规范**：禁止裸命令，用 `npm run` 或 `run.sh`（自动定位目录）
- **对抗性审查**：手动读 SKILL.md 后 spawn subAgent 冷审
- **PostToolUse Hook**：`~/.claude/hooks/post-edit-typecheck.sh`，Write/Edit `.ts`/`.tsx` 后自动 `tsc --noEmit`
- **思维工具**：第一性原理 + 奥卡姆剃刀 + 贝叶斯更新

---

## 关键决策速查

| 决策 | 结果 |
|------|------|
| 模型 | MiMo + DeepSeek V4 + 千问 Max |
| 圆桌 | Vercel AI SDK + Promise.allSettled 自研 |
| 搜索 | 模型内置搜索 |
| 评分 | 定性（强/中/弱），不给0-100 |
| V1岗位 | 数据分析师、B2B销售 |
| 圆桌人数 | 模块一6+1，模块零4+1 |
| 多段经历 | 不限数量 |
| neat-freak冲突 | 方案B：存pending_updates表 |
| 成本监控 | V1记录token数 |
| 薪资数据 | curated_llm_inference，待接入真实数据源 |
| 部署平台 | Vercel（已有 vercel.json） |
| 数据库 | Turso（生产）+ SQLite（开发） |

---

*最后更新：2026-07-01 V1开发完成，对抗性审查修复完成，上线规划完成，准备执行 Phase 0*
