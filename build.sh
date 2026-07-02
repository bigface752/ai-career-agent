#!/bin/bash
# build.sh — 构建项目（向后兼容包装器）
# 推荐直接用: npm run build
set -euo pipefail
cd "$(dirname "$0")" || exit 1
exec npm run build
