#!/bin/bash
#
# ai-career-agent 文档一致性验证脚本
#
# 用法：bash verify-docs.sh
# 通过：所有检查通过 → 输出"可以编码"
# 失败：列出具体问题 → 修完再继续
#
# 退出码：0=全部通过，1=有失败项

set +e  # 不因单个命令失败而退出，由脚本自行处理错误

PROJECT="/home/dev/ai-career-agent"
AGENTS="$PROJECT/kitty-specs/v1-career-cognition/agents"
SPECS="$PROJECT/specs"
V1="$PROJECT/kitty-specs/v1-career-cognition"

PASS=true
WARN=0
FAIL=0

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✅ $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; PASS=false; ((FAIL++)); }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; ((WARN++)); }

# ============================================================
echo ""
echo "=========================================="
echo "  ai-career-agent 文档一致性验证"
echo "=========================================="
echo ""

# ============================================================
echo "--- Check 1: 核心文件存在性 ---"
# ============================================================
CORE_FILES=(
  "PRD.md"
  "CLAUDE.md"
  "DOC-RULES.md"
  "SESSION.md"
  "specs/acceptance-criteria.md"
  "specs/api-endpoints.md"
  "specs/report-templates.md"
  "specs/user-flows.md"
  "specs/agent-prompts.md"
  "kitty-specs/v1-career-cognition/SPEC.md"
  "kitty-specs/v1-career-cognition/PLAN.md"
  "kitty-specs/v1-career-cognition/TASKS.md"
)
for f in "${CORE_FILES[@]}"; do
  if [ -f "$PROJECT/$f" ]; then
    pass "$f"
  else
    fail "$f 缺失"
  fi
done
echo ""

# ============================================================
echo "--- Check 2: Agent 文件完整性（输入+输出定义）---"
# ============================================================
# 需要检查的核心 Agent 文件（排除 README、流程文档等非 Agent 定义文件）
AGENT_FILES=(
  "psychologist.md"
  "moderator.md"
  "career-mentor.md"
  "portrait-builder.md"
  "dialogue-guide.md"
  "headhunter.md"
  "market-benchmark.md"
  "ai-efficiency-expert.md"
  "interview-coach.md"
)
for f in "${AGENT_FILES[@]}"; do
  filepath="$AGENTS/$f"
  if [ ! -f "$filepath" ]; then
    fail "$f 文件不存在"
    continue
  fi
  has_input=$(grep -cE "^## 输入|^## Input|^\*\*输入|\{resume_parsed\}|\{career_portrait\}" "$filepath" 2>/dev/null || true)
  has_input=${has_input:-0}
  has_output=$(grep -cE "输出格式|输出JSON|^## 输出|^## Output|\{.*slot" "$filepath" 2>/dev/null || true)
  has_output=${has_output:-0}
  if [ "$has_input" -gt 0 ] && [ "$has_output" -gt 0 ]; then
    pass "$f（输入✅ 输出✅）"
  else
    if [ "$has_input" -eq 0 ]; then fail "$f 缺少输入定义"; fi
    if [ "$has_output" -eq 0 ]; then fail "$f 缺少输出定义"; fi
  fi
done
echo ""

# ============================================================
echo "--- Check 3: 评分体系残留（0-100分）---"
# ============================================================
residual=$(grep -rn "评分.*0-100\|匹配度.*0-100\|/100分\|分数.*0-100" "$PROJECT" --include="*.md" | grep -v "不给" | grep -v "verify-docs" | grep -v "修复\|已修复\|残留\|检查\|grep" || true)
if [ -z "$residual" ]; then
  pass "无 0-100 分残留"
else
  fail "发现 0-100 分残留："
  echo "$residual" | head -10 | while read line; do echo "    $line"; done
fi
echo ""

# ============================================================
echo "--- Check 4: 圆桌人数一致性 ---"
# ============================================================
# 模块一应该是 6+1 或 6角色
m1_variants=$(grep -rn "5+1\|5角色\|5个角色\|五个角色" "$PROJECT" --include="*.md" | grep -v "verify-docs" | grep -v "0% 动态" | grep -v "SESSION.md\|DOC-RULES.md\|memory-" || true)
if [ -z "$m1_variants" ]; then
  pass "无旧版'5+1/5角色'残留"
else
  fail "发现旧版圆桌人数表述（应为6+1）："
  echo "$m1_variants" | head -10 | while read line; do echo "    $line"; done
fi
echo ""

# ============================================================
echo "--- Check 5: V1 支持岗位一致性 ---"
# ============================================================
# 应该只有 2 个：数据分析师、B2B销售
pmm_in_v1=$(grep -rn "V1.*PMM\|PMM.*V1\|V1.*产品经理\|产品经理.*V1" "$PROJECT" --include="*.md" | grep -v "verify-docs" | grep -v "V2\|v2\|⏳" | grep -v "pmm.json" || true)
if [ -z "$pmm_in_v1" ]; then
  pass "V1 岗位列表无 PMM 残留"
else
  warn "PMM 可能出现在 V1 岗位列表中（需人工确认）："
  echo "$pmm_in_v1" | head -5 | while read line; do echo "    $line"; done
fi
echo ""

# ============================================================
echo "--- Check 6: 交叉引用完整性（见 XX.md）---"
# ============================================================
ref_files=$(grep -rhoP '见\s*\K[A-Za-z_-]+\.md' "$PROJECT" --include="*.md" 2>/dev/null | sort -u | grep -v "^XX\.md$" | grep -v "^file\.md$")
broken=0
while IFS= read -r ref_file; do
  [ -z "$ref_file" ] && continue
  found=$(find "$PROJECT" -name "$ref_file" -type f 2>/dev/null | head -1)
  if [ -z "$found" ]; then
    fail "交叉引用 $ref_file 不存在"
    ((broken++)) || true
  fi
done <<< "$ref_files"
if [ "$broken" -eq 0 ]; then
  pass "交叉引用完整（$(echo "$ref_files" | wc -l) 个引用）"
fi
echo ""

# ============================================================
echo "--- Check 7: 评级术语一致性（应为强/中/弱或五级制）---"
# ============================================================
old_rating=$(grep -rn "评分.*高/中/低\|评级.*高/中/低\|风险.*高/中/低" "$PROJECT" --include="*.md" | grep -v "verify-docs" | grep -v "心理状态\|anxiety\|confidence.*high\|修复\|已修复\|残留\|grep" || true)
if [ -z "$old_rating" ]; then
  pass "评级术语一致（无'高/中/低'用于竞争力评级）"
else
  warn "发现可能的旧评级术语（需人工确认是否为竞争力评级）："
  echo "$old_rating" | head -5 | while read line; do echo "    $line"; done
fi
echo ""

# ============================================================
echo "--- Check 8: 知识库文件完整性 ---"
# ============================================================
KB_DIR="$AGENTS/knowledge-base"
KB_FILES=("global_knowledge.json" "industry_context.json" "_schema.md")
for f in "${KB_FILES[@]}"; do
  if [ -f "$KB_DIR/$f" ]; then
    pass "knowledge-base/$f"
  else
    fail "knowledge-base/$f 缺失"
  fi
done
# 检查 positions 目录
if [ -d "$KB_DIR/positions" ]; then
  pos_count=$(ls "$KB_DIR/positions"/*.json 2>/dev/null | wc -l)
  if [ "$pos_count" -ge 2 ]; then
    pass "positions/ 有 $pos_count 个岗位知识卡"
  else
    warn "positions/ 只有 $pos_count 个知识卡（预期至少2个：data-analyst, b2b-sales）"
  fi
else
  fail "positions/ 目录不存在"
fi
echo ""

# ============================================================
echo "--- Check 9: 搜索策略文件完整性 ---"
# ============================================================
SS_DIR="$AGENTS/search-strategies"
SS_FILES=("_schema.md" "data-analyst.json" "b2b-sales.json")
for f in "${SS_FILES[@]}"; do
  if [ -f "$SS_DIR/$f" ]; then
    pass "search-strategies/$f"
  else
    fail "search-strategies/$f 缺失"
  fi
done
echo ""

# ============================================================
echo "--- Check 10: SESSION.md 最后更新日期 ---"
# ============================================================
last_update=$(grep -oP '\d{4}-\d{2}-\d{2}' "$PROJECT/SESSION.md" | tail -1)
today=$(date +%Y-%m-%d)
days_diff=$(( ( $(date -d "$today" +%s) - $(date -d "$last_update" +%s) ) / 86400 ))
if [ "$days_diff" -le 3 ]; then
  pass "SESSION.md 最后更新 $last_update（${days_diff}天前）"
elif [ "$days_diff" -le 7 ]; then
  warn "SESSION.md 最后更新 $last_update（${days_diff}天前），建议更新"
else
  fail "SESSION.md 最后更新 $last_update（${days_diff}天前），严重过期"
fi
echo ""

# ============================================================
echo "--- Check 11: decision log 存在性（可选）---"
# ============================================================
DECISION_LOG="$PROJECT/DECISIONS.md"
if [ -f "$DECISION_LOG" ]; then
  decision_count=$(grep -c "^| #" "$DECISION_LOG" 2>/dev/null || echo 0)
  pass "DECISIONS.md 存在（$decision_count 条决策记录）"
else
  warn "DECISIONS.md 不存在（建议创建决策日志来封存已确认的设计决策，防止审计循环）"
fi
echo ""

# ============================================================
# 汇总
# ============================================================
echo "=========================================="
echo "  验证结果"
echo "=========================================="
echo ""
if [ "$WARN" -gt 0 ]; then
  echo -e "  警告：${YELLOW}$WARN${NC}（需人工确认）"
fi
if [ "$FAIL" -gt 0 ]; then
  echo -e "  失败：${RED}$FAIL${NC}（必须修复）"
fi
if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
  echo -e "  ${GREEN}全部通过，无警告${NC}"
elif [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}无失败项${NC}，有 $WARN 个警告"
fi
echo ""

if $PASS; then
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  ✅ 文档验证通过，可以进入编码阶段${NC}"
  echo -e "${GREEN}========================================${NC}"
  exit 0
else
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}  ❌ 有失败项，修复后重新运行${NC}"
  echo -e "${RED}========================================${NC}"
  exit 1
fi
