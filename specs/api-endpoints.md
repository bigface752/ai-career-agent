# PRD 补充：API 端点规格

> **文件职责**：API端点。所有接口定义都记录在这里。
> V1 阶段只实现模块一相关端点
> 更新日期：2026-06-08 · 加入飞书Webhook反馈推送、圆桌讨论接口

---

## 模块一：职业认知 API

### POST /api/resume/upload
上传简历文件

```
Request:
  Content-Type: multipart/form-data
  Body: file (PDF, ≤10MB)

Response 200:
  {
    "resume_id": "uuid",
    "parsed_data": {
      "name": "张三",
      "current_role": "产品运营",
      "industry": "SaaS",
      "years": 3,
      "skills": ["数据分析", "用户增长"],
      "projects": [...],
      "education": "本科"
    }
  }

Response 400:
  { "error": "INVALID_FORMAT", "message": "请上传 PDF 格式的文件（V1仅支持PDF）" }

Response 413:
  { "error": "FILE_TOO_LARGE", "message": "文件大小不能超过 10MB" }

Notes:
  · 不存原始简历文件，解析后立即丢弃
  · 只存 parsed_data 到数据库
```

### POST /api/career/start-dialogue
开始引导对话

```
Request:
  {
    "resume_id": "uuid",
    "portrait": { ... }  // 已有画像（如有）
  }

Response 200:
  {
    "session_id": "uuid",
    "round": 1,
    "question": "我看到你在当前公司做了3年产品运营，最近开始考虑跳槽的直接原因是什么？",
    "initial_finding": null
  }

Notes:
  · 如果用户已有画像，基于画像定制第一个问题
  · 如果是新用户，基于简历信息定制
```

### POST /api/career/dialogue
对话交互（逐轮）

```
Request:
  {
    "session_id": "uuid",
    "round": 2,
    "user_answer": "因为天花板..."
  }

Response 200:
  {
    "round": 2,
    "extracted_info": {"motivation": "职级天花板"},
    "initial_finding": "你的经历偏产品运营方向，核心动机是职级晋升受阻。",
    "next_question": "你说的天花板，具体是指职级、薪资、还是能力提升空间？",
    "is_valid_answer": true
  }

Response 200 (无效回答):
  {
    "round": 2,
    "extracted_info": null,
    "initial_finding": null,
    "next_question": "我理解你可能不太好回答，换个角度——如果现在有一个机会让你升一级，你会考虑吗？",
    "is_valid_answer": false
  }

Notes:
  · is_valid_answer=false 时不写入画像
  · 第4轮后必须返回 initial_finding
  · 最多6轮，超过后自动触发画像生成
```

### POST /api/career/portrait
生成职业画像

```
Request:
  { "session_id": "uuid" }

Response 200:
  {
    "portrait": {
      "identity": { ... },
      "career_summary": { ... },
      "strengths": [...],
      "gaps": [...],
      "career_clarity_score": 0.72
    },
    "market_positioning": {
      "competitiveness_rating": "4/5：良好",
      "salary_percentile": "P55",
      "salary_range": {"min": 18, "max": 28},
      "dimensions": { ... },
      "top_2_weaknesses": [...],
      "top_2_strengths": [...],
      "top_3_actions": [...]
    },
    "portrait_completion": 0.65
  }
```

### POST /api/career/roundtable
触发圆桌讨论

```
Request:
  { "session_id": "uuid" }

Response 200:
  {
    "roundtable": {
      "participants": [
        {
          "role": "心理学家",
          "analysis": "...",
          "key_point": "..."
        },
        {
          "role": "行业总监",
          "analysis": "...",
          "key_point": "..."
        },
        {
          "role": "职业导师",
          "analysis": "...",
          "key_point": "..."
        },
        {
          "role": "AI效能专家",
          "analysis": "...",
          "key_point": "..."
        },
        {
          "role": "猎头",
          "analysis": "...",
          "key_point": "..."
        }
      ],
      "debate": [
        {"speaker": "心理学家", "content": "...", "responding_to": "职业导师"}
      ],
      "consensus": ["共识1", "共识2"],
      "disagreements": ["分歧1"],
      "risk_warning": {
        "has_warning": true,
        "points": [
          {"point": "质疑点", "evidence": "证据", "perspective": "对用户决策的意义"}
        ],
        "summary": "一句话风险提示"
      },
      "recommendation": "...",
      "risk_level": "中等",
      "suggestion": "观望"
    }
  }

Notes:
  · 圆桌讨论采用多模型并发架构（AgentRound），每个角色用不同AI模型
  · risk_warning 来自心理学家的质疑者角色（challenger_insight），不参与共识投票
  · 每个角色发言前注入锚点：[你现在是XXX，基于以下背景发言]
```

---

## 画像系统 API

### GET /api/portrait
获取用户画像

```
Request:
  Headers: Authorization: Bearer {token}

Response 200:
  {
    "user_id": "uuid",
    "portrait_json": { ... },
    "completion": 0.65,
    "updated_at": "2026-06-03T10:00:00Z"
  }
```

### PUT /api/portrait
更新用户画像（模块完成时调用）

```
Request:
  {
    "module": "career_cognition",
    "updates": {
      "current_work": { ... }
    }
  }

Response 200:
  {
    "portrait_json": { ... },
    "completion": 0.80,
    "updated_at": "2026-06-03T10:05:00Z"
  }

Notes:
  · 后写入赢（V1不做并发控制）
  · 更新后自动重新计算 completion
```

### POST /api/portrait/correction
用户对画像提出异议

```
Request:
  {
    "field": "strengths",
    "correction": "我不是'数据驱动'，我是'用户洞察'",
    "reason": "我更擅长定性分析而非数据分析"
  }

Response 200:
  {
    "status": "recorded",
    "message": "已记录，下次对话时会重新评估"
  }

Notes:
  · 异议不直接修改画像，记录到 corrections 表
  · 下次该模块对话时，AI 会参考异议重新评估
```

---

## 模块二：岗位匹配 API

### POST /api/match/parse-jd
解析JD

```
Request:
  {
    "jd_text": "某B2B SaaS公司招聘销售总监，要求...",
    "input_method": "text"  // text | position_name
  }

Response 200:
  {
    "jd_id": "uuid",
    "parsed_jd": {
      "position": "销售总监",
      "company_type": "B2B SaaS",
      "requirements": {
        "skills": ["大客户销售", "解决方案销售", "团队管理"],
        "experience": "8年+",
        "education": "本科",
        "salary_range": "40-60万",
        "location": "上海"
      },
      "nice_to_have": ["行业资源", "英文能力"],
      "key_challenges": ["开拓新市场", "带10人团队"]
    },
    "confidence": "high",
    "note": null
  }

Response 200 (模糊输入):
  {
    "jd_id": "uuid",
    "parsed_jd": { ... },
    "confidence": "low",
    "note": "以下为基于行业常识的推断结果，可能与实际JD有差异"
  }

Response 400:
  { "error": "UNRECOGNIZABLE", "message": "无法识别岗位信息，请尝试粘贴完整的JD" }

Notes:
  · input_method=text 时解析完整JD
  · input_method=position_name 时基于行业常识推断
  · 不存原始JD，解析后丢弃
```

### POST /api/match/analyze
生成匹配分析

```
Request:
  {
    "jd_id": "uuid",
    "user_id": "uuid"
  }

Response 200:
  {
    "match_id": "uuid",
    "overall_rating": "强",
    "dimensions": {
      "技能匹配": {"rating": "强", "score": 4, "detail": "..."},
      "经验匹配": {"rating": "强", "score": 4, "detail": "..."},
      "薪资匹配": {"rating": "中", "score": 3, "detail": "..."},
      "发展匹配": {"rating": "中", "score": 3, "detail": "..."}
    },
    "gaps": [
      {"gap": "缺乏团队管理经验", "severity": "大", "how_to_close": "争取带2-3人的小项目"},
      {"gap": "无行业资源积累", "severity": "中", "how_to_close": "..."}
    ],
    "strengths": [
      {"strength": "大客户销售经验丰富", "market_value": "..."},
      {"strength": "数据驱动的销售方法论", "market_value": "..."}
    ],
    "resume_optimization": [
      {"priority": 1, "section": "项目经历", "what": "...", "how": "...", "why": "..."},
      {"priority": 2, "section": "技能标签", "what": "...", "how": "...", "why": "..."}
    ]
  }
```

### POST /api/match/roundtable
岗位匹配圆桌讨论

```
Request:
  {
    "match_id": "uuid"
  }

Response 200:
  {
    "roundtable": {
      "participants": [
        {"role": "岗位洞察", "analysis": "...", "key_point": "..."},
        {"role": "行业总监", "analysis": "...", "key_point": "..."},
        {"role": "猎头", "analysis": "...", "key_point": "..."}
      ],
      "consensus": ["共识1", "共识2"],
      "disagreements": ["分歧1"],
      "recommendation": "建议投递，但先补XX能力",
      "risk_level": "中等"
    }
  }
```

---

## 模块三：面试辅导 API

### POST /api/interview/generate-questions
生成面试题

```
Request:
  {
    "user_id": "uuid",
    "jd_id": "uuid",        // 复用模块二的JD，或新输入
    "round": "一面"          // 一面/二面/终面/HR面
  }

Response 200:
  {
    "interview_id": "uuid",
    "questions": [
      {
        "id": "q1",
        "type": "专业题",
        "question": "你如何设计一个B2B SaaS产品的定价策略？",
        "考察重点": "商业思维+行业理解",
        "difficulty": "中"
      },
      {
        "id": "q2",
        "type": "行为题",
        "question": "请描述一次你说服客户改变决策的经历",
        "考察重点": "影响力+沟通能力",
        "difficulty": "中"
      },
      {
        "id": "q3",
        "type": "非标准题",
        "question": "如果AI可以自动生成销售方案，你的价值在哪里？",
        "考察重点": "AI认知+差异化思维",
        "difficulty": "高"
      }
    ],
    "total_questions": 6,
    "estimated_time": "15-20分钟"
  }

Notes:
  · 专业题3-5题 + 行为题2-3题 + 非标准题1-2题
  · 基于JD定制，不是通用面试题
  · 注入用户画像，让问题更个性化
```

### POST /api/interview/answer
用户提交面试回答

```
Request:
  {
    "interview_id": "uuid",
    "question_id": "q1",
    "answer": "我会从三个维度考虑定价策略..."
  }

Response 200:
  {
    "question_id": "q1",
    "ai_response": {
      "type": "追问",
      "content": "你提到的三个维度，哪个对B2B SaaS最重要？为什么？",
      "reason": "考察深度思考能力"
    },
    "follow_up_count": 1,  // 当前追问次数
    "max_follow_up": 3     // 最多追问3次
  }

Response 200 (最后追问后):
  {
    "question_id": "q1",
    "ai_response": {
      "type": "转下一题",
      "content": "好的，我们来看下一题"
    }
  }

Notes:
  · 每题最多追问3次
  · 追问基于用户回答内容，不是固定模板
  · 记录所有回答，用于后续评估
```

### POST /api/interview/evaluate
面试评估圆桌

```
Request:
  {
    "interview_id": "uuid"
  }

Response 200:
  {
    "evaluation": {
      "overall_rating": "4/5：良好",
      "dimensions": {
        "专业深度": {"score": 4, "comment": "..."},
        "表达清晰度": {"score": 3, "comment": "..."},
        "STAR结构运用": {"score": 3, "comment": "..."},
        "抗压表现": {"score": 4, "comment": "..."}
      },
      "per_question": [
        {
          "question_id": "q1",
          "rating": 4,
          "strength": "...",
          "weakness": "...",
          "optimized_answer": "示范回答...",
          "key_improvement": "..."
        }
      ],
      "top_3_improvements": [
        {"priority": 1, "what": "...", "how": "..."},
        {"priority": 2, "what": "...", "how": "..."},
        {"priority": 3, "what": "...", "how": "..."}
      ]
    }
  }
```

---

## 管理后台 API

### GET /api/admin/users
用户列表

```
Response 200:
  {
    "users": [
      {
        "user_id": "uuid",
        "name": "张三",
        "created_at": "2026-06-01",
        "last_active": "2026-06-03",
        "modules_used": ["M1"],
        "portrait_completion": 0.65,
        "report_count": 2
      }
    ]
  }
```

### GET /api/admin/reports
报告列表

```
Response 200:
  {
    "reports": [
      {
        "report_id": "uuid",
        "user_id": "uuid",
        "user_name": "张三",
        "type": "career_cognition",
        "satisfaction_score": 4,
        "created_at": "2026-06-03"
      }
    ]
  }
```

### GET /api/admin/prompts
获取所有 Agent Prompt

```
Response 200:
  {
    "prompts": [
      {
        "agent_id": "dialogue_guide",
        "agent_name": "对话引导 Agent",
        "system_prompt": "...",
        "updated_at": "2026-06-03",
        "version": 3
      }
    ]
  }
```

### PUT /api/admin/prompts/{agent_id}
修改 Agent Prompt

```
Request:
  {
    "system_prompt": "新的 Prompt 内容..."
  }

Response 200:
  {
    "agent_id": "dialogue_guide",
    "version": 4,
    "updated_at": "2026-06-03T10:00:00Z"
  }

Notes:
  · 修改后立即生效（下次调用该 Agent 时使用新 Prompt）
  · 版本号递增，保留历史版本
```

### GET /api/admin/feedback
反馈列表

```
Response 200:
  {
    "feedback": [
      {
        "feedback_id": "uuid",
        "user_id": "uuid",
        "user_name": "张三",
        "report_id": "uuid",
        "score": 3,
        "comment": "薪资定位不太准",
        "created_at": "2026-06-03"
      }
    ]
  }

Notes:
  · score ≤ 3 的反馈标红
```

---

## 反馈收集 API（V1）

### POST /api/feedback
提交用户反馈

```
Request:
  {
    "report_id": "uuid",
    "user_id": "uuid",
    "score": 4,           // 1-5星，必填
    "comment": "薪资定位不太准",  // 文字反馈，选填
    "screenshot_url": "..."  // 截图URL，选填
  }

Response 200:
  {
    "feedback_id": "uuid",
    "status": "recorded",
    "message": "感谢反馈，我们会持续优化"
  }

Notes:
  · 评分必填，文字反馈选填
  · 提交后同时写入数据库 + Webhook推送飞书
  · 低分（1-2星）时可额外弹出输入框
```

### 飞书 Webhook 推送格式

```
POST {FEISHU_WEBHOOK_URL}

{
  "msg_type": "interactive",
  "card": {
    "header": {
      "title": {
        "tag": "plain_text",
        "content": "📝 新用户反馈"
      },
      "template": "blue"
    },
    "elements": [
      {
        "tag": "div",
        "fields": [
          {
            "is_short": true,
            "text": {
              "tag": "lark_md",
              "content": "**用户：** 张三"
            }
          },
          {
            "is_short": true,
            "text": {
              "tag": "lark_md",
              "content": "**评分：** ⭐⭐⭐⭐"
            }
          },
          {
            "is_short": true,
            "text": {
              "tag": "lark_md",
              "content": "**模块：** 职业认知"
            }
          },
          {
            "is_short": true,
            "text": {
              "tag": "lark_md",
              "content": "**时间：** 2026-06-08 20:35"
            }
          }
        ]
      },
      {
        "tag": "div",
        "text": {
          "tag": "lark_md",
          "content": "**反馈内容：**\n薪资定位不太准，应该再高一点"
        }
      }
    ]
  }
}

Notes:
  · 飞书免费版支持Webhook
  · 低分（≤3星）时卡片标题标红
  · 可选：截图通过图片消息单独推送
```

---

## 用户认证 API

### POST /api/auth/register
注册（邮箱+密码）

```
Request:
  {
    "email": "user@example.com",
    "password": "password123"
  }

Response 200:
  {
    "user_id": "uuid",
    "message": "验证码已发送到邮箱"
  }

Response 400:
  { "error": "EMAIL_EXISTS", "message": "该邮箱已注册，请登录" }

Response 400:
  { "error": "WEAK_PASSWORD", "message": "密码至少8位，包含字母和数字" }

Notes:
  · 发送6位验证码到邮箱
  · 验证码10分钟有效
  · 60秒内只能发1次
```

### POST /api/auth/verify
验证邮箱（验证码）

```
Request:
  {
    "email": "user@example.com",
    "code": "123456"
  }

Response 200:
  {
    "user_id": "uuid",
    "token": "jwt_token",
    "message": "注册成功"
  }

Response 400:
  { "error": "INVALID_CODE", "message": "验证码错误或已过期" }
```

### POST /api/auth/login
登录（邮箱+密码）

```
Request:
  {
    "email": "user@example.com",
    "password": "password123"
  }

Response 200:
  {
    "user_id": "uuid",
    "token": "jwt_token",
    "message": "登录成功"
  }

Response 400:
  { "error": "INVALID_CREDENTIALS", "message": "邮箱或密码错误" }

Response 400:
  { "error": "ACCOUNT_LOCKED", "message": "账号已锁定，请30分钟后重试" }

Notes:
  · 密码错误5次锁定30分钟
  · 单设备登录，踢掉旧设备
```

### POST /api/auth/logout
登出

```
Request:
  Headers: Authorization: Bearer {token}

Response 200:
  { "message": "登出成功" }
```

### POST /api/auth/refresh
刷新token

```
Request:
  Headers: Authorization: Bearer {token}

Response 200:
  {
    "token": "new_jwt_token",
    "expires_in": 86400
  }
```

### POST /api/auth/reset-password
重置密码（验证码+新密码）

```
Request:
  {
    "email": "user@example.com",
    "code": "123456",
    "new_password": "newpassword123"
  }

Response 200:
  { "message": "密码重置成功" }

Response 400:
  { "error": "INVALID_CODE", "message": "验证码错误或已过期" }
```

### GET /api/auth/me
获取当前用户信息

```
Request:
  Headers: Authorization: Bearer {token}

Response 200:
  {
    "user_id": "uuid",
    "email": "user@example.com",
    "created_at": "2026-06-01T10:00:00Z",
    "last_active_at": "2026-06-09T10:00:00Z"
  }
```

---

## 对话状态管理 API

### POST /api/dialogue/start
开始新对话

```
Request:
  {
    "module": "career_cognition",
    "resume_id": "uuid"
  }

Response 200:
  {
    "session_id": "uuid",
    "round": 0,
    "status": "active",
    "message": "对话已开始"
  }

Notes:
  · 每个用户每个模块只能有一个active的session
  · 如果有paused的session，提示用户是否继续
```

### POST /api/dialogue/message
发送消息（逐轮）

```
Request:
  {
    "session_id": "uuid",
    "content": "因为天花板..."
  }

Response 200:
  {
    "round": 2,
    "extracted_info": {"motivation": "职级天花板"},
    "initial_finding": "你的经历偏产品运营方向，核心动机是职级晋升受阻。",
    "next_question": "你说的天花板，具体是指职级、薪资、还是能力提升空间？",
    "is_valid_answer": true
  }

Response 200 (流式):
  Content-Type: text/event-stream
  data: {"type": "token", "content": "你"}
  data: {"type": "token", "content": "好"}
  data: {"type": "done", "content": "你好"}
```

### POST /api/dialogue/pause
暂停对话

```
Request:
  {
    "session_id": "uuid"
  }

Response 200:
  {
    "session_id": "uuid",
    "status": "paused",
    "expires_at": "2026-06-14T10:00:00Z",
    "round_count": 5,
    "context_retained": 5,
    "message": "对话已暂停"
  }

Notes:
  · 动态上下文保留：根据对话轮数保留最近N轮
  · 设置expires_at = now + 5天
```

### POST /api/dialogue/resume
恢复对话

```
Request:
  {
    "session_id": "uuid"
  }

Response 200:
  {
    "session_id": "uuid",
    "status": "active",
    "round": 5,
    "context": [...],
    "message": "对话已恢复"
  }

Response 400:
  { "error": "SESSION_EXPIRED", "message": "对话已过期" }
```

### GET /api/dialogue/status
获取对话状态

```
Request:
  Headers: Authorization: Bearer {token}

Response 200:
  {
    "has_active_session": false,
    "has_paused_session": true,
    "paused_session": {
      "session_id": "uuid",
      "module": "career_cognition",
      "round": 5,
      "paused_at": "2026-06-09T10:00:00Z",
      "expires_at": "2026-06-14T10:00:00Z"
    }
  }
```

### POST /api/dialogue/cleanup
超期清理（定时任务）

```
Request:
  (无参数，定时任务调用)

Response 200:
  {
    "expired_sessions": 5,
    "notified_users": 5,
    "cleaned_sessions": 0,
    "message": "已发送通知，48小时后清理"
  }

Notes:
  · 每天凌晨2点执行
  · 发送站内+邮件通知
  · 48小时后自动清理
```

---

## neat-freak机制 API

### POST /api/portrait/extract
对话结束提炼要点

```
Request:
  {
    "session_id": "uuid"
  }

Response 200:
  {
    "extracted": {
      "new_fields": [
        {"field": "career_goal", "value": "想转行做产品经理"}
      ],
      "updated_fields": [
        {"field": "value_ranking", "old": ["薪资", "成长", "平衡"], "new": ["成长", "薪资", "平衡"]}
      ],
      "conflicting_fields": [
        {"field": "work_life_balance", "old": "不想加班", "new": "可以接受偶尔加班"}
      ]
    },
    "message": "画像已更新"
  }

Notes:
  · 自动提炼，用户可查看
  · 矛盾字段标记，下次对话时确认
```

### POST /api/portrait/remind
15轮提醒

```
Request:
  {
    "session_id": "uuid",
    "round": 15
  }

Response 200:
  {
    "should_remind": true,
    "message": "我们已经聊了15轮了，要不要更新一下你的职业画像？"
  }

Notes:
  · 每15轮提醒一次
  · 用户可选择更新或继续
```

---

## 前端状态管理 API

### GET /api/dialogue/history
获取对话历史

```
Request:
  Headers: Authorization: Bearer {token}
  Params: session_id

Response 200:
  {
    "session_id": "uuid",
    "round": 5,
    "messages": [
      {
        "id": "uuid",
        "role": "user",
        "content": "因为天花板...",
        "created_at": "2026-06-09T10:00:00Z"
      },
      {
        "id": "uuid",
        "role": "assistant",
        "content": "你说的天花板，具体是指什么？",
        "created_at": "2026-06-09T10:01:00Z"
      }
    ]
  }
```

### POST /api/dialogue/auto-pause
自动暂停（1小时无操作）

```
Request:
  {
    "session_id": "uuid"
  }

Response 200:
  {
    "session_id": "uuid",
    "status": "paused",
    "message": "对话已自动暂停"
  }

Notes:
  · 前端检测1小时无操作后调用
  · 与手动暂停逻辑相同
```
