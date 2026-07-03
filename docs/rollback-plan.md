# 回滚方案

> Phase 6.7 产出文档。灰度发布期间的应急回滚指南。

---

## 回滚触发条件

| 级别 | 条件 | 响应时间 |
|------|------|----------|
| P0 | 核心流程完全不可用（注册/登录/对话） | 立即回滚 |
| P1 | 数据库连接失败 / 数据丢失风险 | 15 分钟内回滚 |
| P2 | 非核心功能异常（报告生成/面试评估） | 评估后决定 |
| P3 | UI 问题 / 性能下降 | 下个版本修复 |

---

## 回滚方式

### 1. Vercel 回滚（推荐，最快）

```bash
# 方式 A：Vercel Dashboard
# 1. 访问 https://vercel.com/bigface752/ai-career-agent/deployments
# 2. 找到上一个正常部署，点击 "Promote to Production"

# 方式 B：Vercel CLI
vercel rollback
```

**耗时**：< 1 分钟
**影响**：代码回滚，数据库不变

### 2. 数据库回滚（仅在 schema 变更时）

```bash
# 1. 停止所有写入（将 API 返回 503）
# 2. 从 Turso 备份恢复
turso db restore <backup-name>

# 3. 重新部署代码
vercel --prod
```

**耗时**：5-15 分钟
**影响**：回滚期间数据丢失

### 3. 邀请码紧急关闭

如果灰度阶段发现严重问题，可以通过禁用注册来阻止新用户：

```bash
# 方式 A：Vercel 环境变量
# 设置 INVITE_ENABLED=false，触发重新部署

# 方式 B：代码层面
# 在 /api/auth/register 中添加全局开关
```

---

## 回滚检查清单

- [ ] 确认回滚目标版本号
- [ ] 通知相关团队成员
- [ ] 执行回滚操作
- [ ] 验证健康检查 `/api/health` 返回 200
- [ ] 验证核心流程可用（注册/登录/对话）
- [ ] 检查 Sentry 是否有新错误
- [ ] 更新状态页（如有）
- [ ] 记录回滚原因和时间

---

## 灰度阶段特殊策略

### Alpha → Beta 回滚

- **范围**：仅影响受邀用户
- **方式**：Vercel 回滚 + 禁用邀请码
- **数据**：用户数据保留，不影响

### Beta → 全量回滚

- **范围**：所有用户
- **方式**：Vercel 回滚
- **数据**：检查是否有 schema 变更需要处理

---

## 监控告警配置

| 监控项 | 工具 | 告警阈值 |
|--------|------|----------|
| 错误率 | Sentry | > 5% 请求报错 |
| 响应时间 | Vercel Analytics | P95 > 3s |
| 数据库连接 | Health Check | /api/health 返回 503 |
| 内存使用 | Vercel Metrics | > 80% |

---

## 联系方式

- **负责人**：Bigface（彭信远）
- **Vercel 项目**：ai-career-agent
- **GitHub 仓库**：bigface752/ai-career-agent

---

*最后更新：2026-07-02 Phase 6 灰度发布*
