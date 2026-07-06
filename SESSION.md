# 会话状态（自动更新）

> **本文件记录当前任务进度和下一步行动，每次对话结束时更新。**
> **新对话开始时，先读本文件，然后继续工作。**
> **历史归档：见 [docs/session-archive.md](docs/session-archive.md)**

---

## 当前任务

**任务**：V1.1 用户旅程重构 — Phase 2 前端开发完成

**进度**：
- V1 灰度发布进行中（Phase 6.2 部署完成）
- V1.1 Phase 1 后端开发 ✅ 完成
- V1.1 Phase 2 前端开发 ✅ 完成
- Phase 2 对抗性审查 ✅ 完成（3个P0、4个P1已修复）

**V1.1 任务清单**：
- [x] 1.1 数据库迁移（JourneySession 表 + Portrait 关联）
- [x] 1.2 旅程 API（status / start / advance / rollback / step）
- [x] 1.3 状态管理（journey.ts 规则引擎 + 步骤校验）
- [x] 2.1 JourneyProgress 组件（进度条 + 回退功能）
- [x] 2.2 JourneyStep 组件（步骤内容 + 操作按钮）
- [x] 2.4 /journey 页面（组合组件 + 状态管理）— 跳过 2.3 JourneyChat，复用现有对话系统
- [x] 2.5 首页改造（添加"开始我的职业决策"按钮）
- [x] Phase 2 对抗性审查（修复P0×3、P1×4）

**下一步**：Phase 3 测试与发布（任务3.1功能测试 → 3.2性能测试 → 3.3发布）

**部署信息**：
- 服务器：阿里云 ECS（116.62.149.221）
- 进程管理：pm2（开机自启已配置）
- 反代：nginx → port 3000
- 公网地址：http://116.62.149.221
- 数据库：Turso 生产库

**下一步**：任务 1.2 旅程 API 开发

---

## 上线规划（Phase 0-7）

| Phase | 内容 | 预估时间 | 状态 |
|-------|------|----------|------|
| 0 | 基础设施就绪（Git、.env.example、JWT_SECRET） | 1-2 天 | ✅ 完成 |
| 1 | 安全加固（速率限制、安全 Headers、CORS） | 2-3 天 | ✅ 完成 |
| 2 | 可观测性（Sentry、结构化日志、健康检查） | 2-3 天 | ✅ 完成 |
| 3 | 测试体系（Vitest、P0/P1/P2 测试用例） | 3-5 天 | ✅ 完成 |
| 4 | CI/CD（GitHub Actions + Vercel） | 1-2 天 | ✅ 完成 |
| 5 | 数据库迁移（Turso 生产库初始化） | 1 天 | ✅ 完成 |
| 6 | 灰度发布（Alpha → Beta → 全量） | 1-2 天 | 🔄 进行中（6.2 部署完成） |
| 7 | 上线 Checklist | — | ⬜ 待执行 |

**总预估**：11-18 天

---

## Phase 6 任务清单

- [x] 6.1 邀请码机制实现（Schema + API + 注册流程集成）
- [x] 6.1.1 对抗性审查（10 项发现，修复 7 项，记录 3 项）
- [x] 6.2 部署（阿里云 ECS + nginx + pm2）
- [ ] 6.3 Alpha 测试（内部验证 + 核心流程测试）
- [ ] 6.4 Beta 测试（小范围用户 + 反馈收集）
- [ ] 6.5 全量发布（正式上线）
- [x] 6.6 监控告警验证（Sentry + Health Check + 日志）
- [x] 6.7 回滚方案确认

### Phase 6.2 部署信息

| 项目 | 详情 |
|------|------|
| 服务器 | 阿里云 ECS（Ubuntu 22.04.5 LTS） |
| IP | 116.62.149.221 |
| 进程管理 | pm2（开机自启已配置） |
| 反代 | nginx → port 3000 |
| 公网地址 | http://116.62.149.221 |
| 数据库 | Turso 生产库（libsql://bigfacedatabase-bigfacezzz.aws-ap-northeast-1.turso.io） |
| 健康检查 | http://116.62.149.221/api/health |

### Phase 6.2 部署变更

| 变更 | 详情 |
|------|------|
| 新增文件 | .env（服务器环境变量） |
| nginx 配置 | /etc/nginx/sites-available/tiaobutiao（反代到 port 3000） |
| pm2 配置 | tiaobutiao 进程（npm start） |
| 项目改名 | "AI Career Agent" → "跳不跳" |

### Phase 6.1.1 对抗性审查结果

| # | 严重度 | 问题 | 处理 |
|---|--------|------|------|
| 1 | 🔴 P0 | 用户创建 + 邀请码消耗无事务保护 | ✅ 已修：db.$transaction 包裹 |
| 2 | 🔴 P0 | 邀请码 TOCTOU 竞态条件 | ✅ 已修：条件更新 WHERE use_count < max_uses |
| 3 | 🟡 P1 | 已注册未验证用户重复消耗邀请码 | ✅ 已修：检查已有使用记录 |
| 4 | 🟡 P1 | maxUses 和 expiresInDays 无输入验证 | ✅ 已修：添加范围校验 |
| 5 | 🟡 P1 | 单条插入性能问题 | ✅ 已修：批量事务插入 |
| 6 | 🟢 P2 | 信息泄露 remainingUses | ✅ 已修：不返回剩余次数 |
| 7 | 🟢 P2 | 邀请码模偏差 | 记录：8 位码空间足够，不构成安全风险 |
| 8 | 🟢 P2 | 错误响应格式不一致 | 记录：validate 和 register 状态码不同，可接受 |
| 9 | 🟢 P2 | 前端重复处理 | 记录：防御性设计，非 bug |
| 10 | 🟢 P2 | 日志记录邀请码明文 | ✅ 已修：只记录 userId |

### Phase 6.1 邀请码机制变更

| 文件 | 变更 |
|------|------|
| prisma/schema.prisma | 新增 InviteCode + InviteCodeUsage 模型 |
| src/app/api/invite/validate/route.ts | 邀请码验证 API |
| src/app/api/invite/generate/route.ts | 邀请码生成 API（管理员用） |
| src/app/api/auth/register/route.ts | 集成邀请码验证 |
| src/app/register/page.tsx | 添加邀请码输入框 |

### Phase 6.2 Vercel 部署前置条件

> 以下需要用户在 Vercel Dashboard 手动操作

1. **创建 Vercel 项目**
   - 访问 https://vercel.com/new
   - 导入 GitHub 仓库 `bigface752/ai-career-agent`
   - Framework Preset: Next.js
   - Root Directory: `.`（默认）

2. **配置环境变量**（见 Phase 4 清单）

3. **配置 ADMIN_EMAILS**（邀请码管理权限）
   - `ADMIN_EMAILS=your@email.com`（逗号分隔多个管理员）

---

## Phase 0 任务清单

- [x] 0.1 Git 仓库初始化（git init + 首次 commit + 推送 GitHub ✅）
- [x] 0.2 创建 .env.example（完整变量清单）
- [x] 0.3 生成并配置 JWT_SECRET（openssl rand -base64 32）
- [x] 0.4 验证 npm run build 通过（61 页面全部生成）

---

## Phase 1 任务清单

- [x] 1.1 速率限制（API 请求频率限制）— 滑动窗口，100次/分钟/IP
- [x] 1.2 安全 Headers（CSP / X-Frame-Options / X-Content-Type-Options 等）
- [x] 1.3 CORS 配置（origin 白名单 + 预检请求处理）
- [x] 1.4 验证 npm run build 通过（middleware 33.6 kB）
- [x] 1.5 对抗性审查（6项发现，修复4项，记录1项已知限制）

### 对抗性审查结果

| # | 严重度 | 问题 | 处理 |
|---|--------|------|------|
| 1 | 🔴 | 内存 Map 在 Vercel 无状态环境不跨实例共享 | 记录为已知限制，灰度阶段够用，正式上线评估 Upstash |
| 2 | 🟡 | checkRateLimit 对认证请求被调用两次（消耗2个配额） | ✅ 已修：保存第一次 remaining，不再重复调用 |
| 3 | 🟡 | x-forwarded-for 可被客户端伪造 | ✅ 已修：取最后一个值（最靠近服务器的代理 IP） |
| 4 | 🟢 | CORS "null" 在 sandbox iframe 场景可被利用 | ✅ 已修：不设 header 而非设 "null" |
| 5 | 🟢 | 非公开页面缺少 CORS headers | 确认无需修改，所有 API 都在 /api/ 下 |
| 6 | 🟢 | JWT_SECRET 未定义时静默失败 | ✅ 已修：启动时 guard 检查 |

---

## Phase 2 任务清单

- [x] 2.1 Sentry 集成（错误监控 + 性能追踪）— @sentry/nextjs + 三端配置 + Prisma Integration
- [x] 2.2 结构化日志（pino + logger.ts）— 统一日志格式 + Sentry 双上报 + 改造 5 个核心路由
- [x] 2.3 健康检查端点（/api/health）— DB 探活 + 版本 + uptime + middleware 放行
- [x] 2.4 验证 npm run build 通过（62 页面全部生成）
- [x] 2.5 对抗性审查（7 项发现，全部修复）

### 对抗性审查结果

| # | 严重度 | 问题 | 处理 |
|---|--------|------|------|
| 1 | 🔴 | 客户端 Sentry DSN 未注入（NEXT_PUBLIC_ 前缀缺失） | ✅ 已修：改用 NEXT_PUBLIC_SENTRY_DSN |
| 2 | 🔴 | next.config.mjs webpack 配置位置错误（顶层选项误放 webpack 内） | ✅ 已修：恢复顶层选项 |
| 3 | 🟡 | Logger 用 captureMessage 丢失 Error 栈信息 | ✅ 已修：有 err 时改用 captureException |
| 4 | 🟡 | Health check uptime 在 serverless 环境不准确 | ✅ 已修：改用 process.uptime() |
| 5 | 🟡 | Logger err 字段类型处理不当（非 Error 实例序列化问题） | ✅ 已修：显式 err 字段 + normalizeContext |
| 6 | 🟢 | instrumentation.ts 缺少错误处理（Sentry 初始化失败会阻塞启动） | ✅ 已修：加 try/catch 降级 |
| 7 | 🟢 | global-error.tsx reset 类型定义不准确 | ✅ 已修：改为 () => Promise<void> |

### Phase 2 新增文件

| 文件 | 用途 |
|------|------|
| sentry.client.config.ts | 浏览器端 Sentry 初始化（DSN + Replay + BrowserTracing） |
| sentry.server.config.ts | 服务端 Sentry 初始化（Prisma Integration） |
| sentry.edge.config.ts | Edge Runtime Sentry 初始化（middleware） |
| src/instrumentation.ts | Next.js Instrumentation Hook（Sentry 注册入口） |
| src/lib/logger.ts | 结构化日志（pino + Sentry 双上报 + 路由级 logger 工厂） |
| src/app/api/health/route.ts | 健康检查端点（DB 探活 + 版本 + uptime） |
| src/app/global-error.tsx | 全局错误边界（Sentry captureException + 用户重试） |

### Phase 2 环境变量新增

```bash
# Sentry
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project-id>       # 服务端
NEXT_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project-id>  # 客户端
SENTRY_ORG=
SENTRY_PROJECT=
```

---

## Phase 3 任务清单

- [x] 3.1 安装 Vitest + 配置（vitest.config.ts + package.json scripts）
- [x] 3.2 P0 测试用例（认证、对话核心流程）— auth.ts + slot-state.ts
- [x] 3.3 P1 测试用例（面试、匹配、评估）— consensus.ts + interview/schema.ts
- [x] 3.4 P2 测试用例（边界情况、错误处理）— edge-cases.test.ts
- [x] 3.5 验证 npm run build 通过（62 页面全部生成）
- [x] 3.6 对抗性审查（12 项发现，修复 6 项，记录 4 项已知限制）

### 对抗性审查结果

| # | 严重度 | 问题 | 处理 |
|---|--------|------|------|
| 1 | 🔴 | addTurnToWindow 断言阈值错误（RECENT_WINDOW_SIZE=3，测试写 6） | ✅ 已修：改用 toHaveLength(3) |
| 2 | 🔴 | fillSlot 不可变性测试不充分（未验证原状态未被污染） | ✅ 已修：补充 state.filled 检查 |
| 3 | 🔴 | TEST_SLOTS 缺少 type/default_question 必填字段 | ✅ 已修：补全字段定义 |
| 4 | 🟡 | consensus.test.ts 未测试 runWithConsensus 主函数 | 记录为已知限制，P1 路径已覆盖核心算法 |
| 5 | 🟡 | edge-cases 测试名与行为不匹配 | ✅ 已修：改名为"刚签发的 token 应验证通过" |
| 6 | 🟡 | majorityVote 依赖 Object.entries 排序稳定性 | 记录为已知限制，当前 3 等级无等计数场景 |
| 7 | 🟡 | 不同测试文件使用不同 JWT_SECRET | ✅ 已修：vitest.config.ts 设置 pool: 'forks' 进程隔离 |
| 8 | 🟡 | 缺少 sendVerificationEmail/sendPasswordResetEmail 测试 | 记录为已知限制，外部服务调用需 mock |
| 9 | 🟡 | getUsedQuestionVariants 无测试覆盖 | ✅ 已修：补充 3 个测试用例 |
| 10 | 🟢 | validatePasswordStrength 错误消息用中文硬编码 | 记录为已知限制，当前无 i18n 需求 |
| 11 | 🟢 | fillSlot 改口场景未验证旧值保留 | 已在 #2 修复中一并覆盖 |
| 12 | 🟢 | 覆盖率配置未排除 types.ts | ✅ 已修：coverage.exclude 添加 types.ts |

### Phase 3 测试覆盖

| 测试文件 | 测试数 | 覆盖范围 |
|----------|--------|----------|
| tests/lib/auth.test.ts | 31 | 密码哈希、JWT、验证码、密码强度、Cookie |
| tests/lib/dialogue/slot-state.test.ts | 74 | Slot 创建/填充/查询、问题追踪、进度计算、流程控制 |
| tests/lib/evaluation/consensus.test.ts | 11 | majorityVote 共识算法 |
| tests/lib/interview/schema.test.ts | 16 | Zod Schema 验证（轮次、题目、输入输出） |
| tests/lib/edge-cases.test.ts | 18 | 边界情况（特殊字符、Unicode、不可变性等） |
| **合计** | **150** | |

### Phase 3 新增文件

| 文件 | 用途 |
|------|------|
| vitest.config.ts | Vitest 配置（路径别名、覆盖率、Mock 策略） |
| tests/lib/auth.test.ts | P0 认证工具函数测试 |
| tests/lib/dialogue/slot-state.test.ts | P0 Slot 状态管理测试 |
| tests/lib/evaluation/consensus.test.ts | P1 共识算法测试 |
| tests/lib/interview/schema.test.ts | P1 面试 Schema 验证测试 |
| tests/lib/edge-cases.test.ts | P2 边界情况测试 |

### Phase 3 新增 npm scripts

| 脚本 | 命令 | 用途 |
|------|------|------|
| `test` | `vitest run` | 运行所有测试 |
| `test:watch` | `vitest` | 监听模式 |
| `test:coverage` | `vitest run --coverage` | 覆盖率报告 |

---

## Phase 5 任务清单

- [x] 5.1 Turso 生产库连接验证（Token 更新 + 连接测试）
- [x] 5.2 Prisma schema push 到生产库（18 个表全部就绪）
- [x] 5.3 基础数据初始化（无需预设数据）
- [x] 5.4 npm run build 验证通过（62 页面全部生成）
- [x] 5.5 对抗性审查（8 项发现，修复 4 项，记录 4 项建议）

### 对抗性审查结果

| # | 严重度 | 问题 | 处理 |
|---|--------|------|------|
| 1 | 🔴 | Schema 严重漂移（15 vs 19 模型） | ✅ 已修：从 inlineSchema 重写 schema.prisma |
| 2 | 🔴 | init.sql 严重过期（缺 5 张表） | ✅ 已修：标记为 deprecated |
| 3 | 🟡 | 生成代码未入库但无构建保障 | ✅ 已修：添加 prebuild 脚本 |
| 4 | 🟡 | 缺少高频查询索引 | ✅ 已修：添加 4 个索引（reports, interview_sessions, dialogue_messages, notifications） |
| 5 | 🟡 | Turso Auth Token 为长期 Token | 记录为建议：确认过期策略 |
| 6 | 🟡 | Turso Token 存在于两个文件 | 记录为建议：统一管理 |
| 7 | 🟢 | SQL 注入风险 | 确认无需处理：全部使用 Prisma ORM |
| 8 | 🟢 | Token 连接方式安全 | 确认无需处理 |

### Phase 5 数据库变更

| 变更 | 详情 |
|------|------|
| 新增表 | notifications, salary_submissions, job_descriptions, match_results, match_roundtable_discussions |
| 新增索引 | idx_reports_user_created, idx_interview_sessions_user_created, idx_dialogue_messages_session_created, idx_notifications_user_created |
| Schema 修正 | 从 inlineSchema 重写，统一 PascalCase + @@map() 命名 |
| 构建优化 | 添加 prebuild 脚本确保 prisma generate |

---

## Phase 4 任务清单

- [x] 4.1 创建 GitHub Actions workflow（PR 检查：lint + typecheck + test + build）
- [x] 4.2 Vercel 部署配置（buildCommand + framework + 环境变量清单）
- [x] 4.3 验证 npm run build 通过（62 页面全部生成）
- [x] 4.4 对抗性审查（3 项发现，修复 1 项，记录 1 项已知限制）
- [x] 4.5 Sentry dryRun guard（CI 无 auth token 时跳过 source map 上传）

### 对抗性审查结果

| # | 严重度 | 问题 | 处理 |
|---|--------|------|------|
| 1 | 🟡 | Sentry CI 构建缺 SENTRY_AUTH_TOKEN 可能失败 | ✅ 已修：next.config.mjs 加 `dryRun: !process.env.SENTRY_AUTH_TOKEN` |
| 2 | 🟡 | DATABASE_URL 指向不存在文件可能触发连接校验 | 确认无需修改：build 已验证通过，Prisma 构建时不连库 |
| 3 | 🟢 | PR + push-to-main 重复触发消耗 CI 资源 | 保留：push-to-main 是合并后的最终安全网 |

### Phase 4 新增/修改文件

| 文件 | 用途 |
|------|------|
| .github/workflows/pr-check.yml | GitHub Actions PR 检查（lint → typecheck → test → build） |
| vercel.json | Vercel 部署配置（buildCommand + crons） |
| next.config.mjs | 新增 Sentry dryRun guard |

### Phase 4 Vercel 环境变量清单

> 在 Vercel Dashboard → Settings → Environment Variables 中配置

| 变量 | 用途 | 环境 |
|------|------|------|
| `DATABASE_URL` | Turso 生产库 URL | Production |
| `TURSO_DATABASE_URL` | libsql 连接字符串 | Production |
| `TURSO_AUTH_TOKEN` | Turso 认证 token | Production |
| `JWT_SECRET` | JWT 签名密钥 | Production |
| `MIMO_API_KEY` | MiMo 模型 API Key | Production |
| `DEEPSEEK_API_KEY` | DeepSeek 模型 API Key | Production |
| `DASHSCOPE_API_KEY` | 千问模型 API Key | Production |
| `GLM_API_KEY` | GLM 模型 API Key | Production |
| `RESEND_API_KEY` | 邮件服务 API Key | Production |
| `SENTRY_DSN` | Sentry 服务端 DSN | Production |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry 客户端 DSN | Production |
| `SENTRY_ORG` | Sentry 组织名 | Production |
| `SENTRY_PROJECT` | Sentry 项目名 | Production |
| `SENTRY_AUTH_TOKEN` | Sentry source map 上传 token | Production |

> **注**：Phase 4 原计划使用 Vercel 部署，后改为阿里云 ECS。环境变量已配置在服务器 .env 文件中。

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
| 部署平台 | 阿里云 ECS（116.62.149.221）+ nginx + pm2 |
| 数据库 | Turso（生产）+ SQLite（开发） |

---

*最后更新：2026-07-06 Phase 6 灰度发布进行中（邀请码机制 ✅ + 对抗性审查 ✅ + 阿里云部署 ✅ + 监控告警 ✅ + 回滚方案 ✅ + 待 Alpha 测试）*
