#!/usr/bin/env bash
# Builds the frontend from the checked-out Git repository on a 2GiB Aliyun
# Simple Application Server. Does not start any public HTTP listener.
set -Eeuo pipefail
umask 022

APP_ROOT="${PAWCREAM_ROOT:-/opt/pawcream}"
SOURCE_ROOT="${PAWCREAM_SOURCE:-$APP_ROOT/source}"
NODE_IMAGE="${PAWCREAM_NODE_IMAGE:-public.ecr.aws/docker/library/node:22-alpine}"
NPM_REGISTRY="${PAWCREAM_NPM_REGISTRY:-https://registry.npmmirror.com}"
BUILD_ROOT=""

log() { printf '\n[PawCream] %s\n' "$*"; }
die() { printf '[ERROR] %s\n' "$*" >&2; exit 1; }

cleanup() {
  if [[ -n "$BUILD_ROOT" && -d "$BUILD_ROOT" ]]; then
    rm -rf -- "$BUILD_ROOT"
  fi
}
trap cleanup EXIT

[[ "$EUID" -eq 0 ]] || die "请用 root 运行，或 sudo bash $SOURCE_ROOT/scripts/deploy-local-preview.sh"
[[ -d "$SOURCE_ROOT/.git" ]] || die "找不到 Git 源码目录：$SOURCE_ROOT"
[[ -f "$SOURCE_ROOT/package.json" ]] || die "缺少前端 package.json"
[[ -f "$SOURCE_ROOT/vite.config.ts" ]] || die "缺少 vite.config.ts"
[[ -d "$SOURCE_ROOT/src" && -d "$SOURCE_ROOT/public" ]] || die "前端源码目录不完整"

for executable in docker python3 cwebp file tar; do
  command -v "$executable" >/dev/null 2>&1 || die "缺少 $executable，请先安装：apt install -y webp file python3-fonttools python3-brotli"
done
python3 - <<'PY' >/dev/null 2>&1 || die "缺少 Python fonttools / brotli：apt install -y python3-fonttools python3-brotli"
from fontTools.ttLib import TTFont
import brotli
PY
docker info >/dev/null 2>&1 || die "Docker 守护进程不可用"
mkdir -p "$APP_ROOT"
BUILD_ROOT="$(mktemp -d "$APP_ROOT/.preview-build.XXXXXXXX")"

# Explicit allow-list: NEVER mount backend/.env, root .env, .git, or API
# credentials into the untrusted front-end npm dependency installation.
log "复制前端构建所需源码（不会复制密钥、backend、.git）"
tar -C "$SOURCE_ROOT" -cf - \
  package.json index.html vite.config.ts \
  tsconfig.json tsconfig.app.json tsconfig.node.json \
  src public scripts | tar -C "$BUILD_ROOT" -xf -

log "生成站点 WOFF2 字体"
(cd "$BUILD_ROOT" && python3 scripts/convert-fonts.py)

log "优化前端运行图片（WebP）"
(cd "$BUILD_ROOT" && python3 scripts/optimize-runtime-assets.py)

log "在 Docker 内安装前端依赖：$NODE_IMAGE"
docker run --rm \
  --memory=1536m \
  -v "$BUILD_ROOT:/app" -w /app \
  -e "npm_config_registry=$NPM_REGISTRY" \
  "$NODE_IMAGE" npm install --no-audit --no-fund

log "构建独立域名版本（base=/，VITE_API_BASE_URL=/api）"
docker run --rm \
  --memory=1536m \
  -v "$BUILD_ROOT:/app" -w /app \
  -e "VITE_API_BASE_URL=/api" \
  -e "NODE_OPTIONS=--max-old-space-size=1024" \
  "$NODE_IMAGE" npm run build:server:webp

DIST="$BUILD_ROOT/dist"
for asset in \
  "index.html" \
  "assets/font/pawcream-cn.woff2" \
  "assets/font/pawcream-en.woff2" \
  "assets/home/Home_mobile.webp" \
  "assets/atelier/background.webp" \
  "assets/atelier/people.webp" \
  "assets/atelier/message.webp"
do
  [[ -s "$DIST/$asset" ]] || die "构建产物缺失：$asset"
done
if grep -R -q '/PawCream/assets/font/' "$DIST" 2>/dev/null; then
  die "构建产物包含 GitHub Pages 的字体路径，拒绝发布"
fi

# nginx runs as www-data; readable assets are required even if root used
# a restrictive umask for earlier credential setup.
chmod -R a+rX "$DIST"

log "部署到 $APP_ROOT/dist（仅本机文件，不开放公网）"
if [[ -d "$APP_ROOT/dist" ]]; then
  rm -rf -- "$APP_ROOT/dist.prev"
  mv -- "$APP_ROOT/dist" "$APP_ROOT/dist.prev"
fi
mv -- "$DIST" "$APP_ROOT/dist"
log "构建成功；站点文件已就绪"
du -sh "$APP_ROOT/dist"
log "预览入口使用 nginx/pawcream-preview.conf；本脚本不会启动 Nginx。"
