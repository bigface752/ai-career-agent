#!/bin/bash
# run.sh — 万能命令包装器
# 自动定位到项目根目录，然后执行任意命令
# 用法: bash /home/dev/ai-career-agent/run.sh <任意命令>
# 示例: bash /home/dev/ai-career-agent/run.sh npx prisma migrate dev
#       bash /home/dev/ai-career-agent/run.sh npm run build

set -euo pipefail

# 自动定位到项目根目录（run.sh 所在的目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || { echo "ERROR: 无法进入项目目录 $SCRIPT_DIR"; exit 1; }

# 验证确实在正确目录
if [ ! -f "package.json" ]; then
  echo "ERROR: 项目目录异常，找不到 package.json"
  echo "当前目录: $(pwd)"
  exit 1
fi

# 如果没有参数，显示用法
if [ $# -eq 0 ]; then
  echo "用法: bash run.sh <命令>"
  echo ""
  echo "常用命令（推荐用 npm run）:"
  echo "  bash run.sh npm run build       # 构建"
  echo "  bash run.sh npm run validate    # 验证知识卡"
  echo "  bash run.sh npm run typecheck   # 类型检查"
  echo "  bash run.sh npm run db:generate # 生成 Prisma Client"
  echo ""
  echo "临时命令:"
  echo "  bash run.sh npx prisma migrate dev"
  echo "  bash run.sh ls -la src/"
  exit 0
fi

# 执行传入的命令
exec "$@"
