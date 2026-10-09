#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${PAWCREAM_ROOT:-/opt/pawcream}"
DEFAULT_ZIP="/home/admin/PawCream-main.zip"
ZIP_PATH="${1:-$DEFAULT_ZIP}"
NODE_IMAGE="${PAWCREAM_NODE_IMAGE:-node:22-alpine}"
NPM_REGISTRY="${PAWCREAM_NPM_REGISTRY:-https://registry.npmmirror.com}"
HEALTH_URL="${PAWCREAM_HEALTH_URL:-http://127.0.0.1/}"
WORK_ROOT=""
BUILD_SRC=""
COMPOSE_FILE=""

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

die() {
  printf '\n[ERROR] %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if [[ -n "${WORK_ROOT:-}" && -d "$WORK_ROOT" ]]; then
    rm -rf "$WORK_ROOT"
  fi
}
trap cleanup EXIT

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    die "请用 sudo 运行，例如：sudo bash $APP_ROOT/deploy.sh $ZIP_PATH"
  fi
}

ensure_base_tools() {
  local missing=()

  command -v unzip >/dev/null 2>&1 || missing+=("unzip")
  command -v curl >/dev/null 2>&1 || missing+=("curl")
  command -v python3 >/dev/null 2>&1 || missing+=("python3")
  command -v sha256sum >/dev/null 2>&1 || missing+=("coreutils")

  if (("${#missing[@]}" > 0)); then
    log "安装基础工具：${missing[*]}"
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y "${missing[@]}"
  fi
}

ensure_webp_tools() {
  if command -v cwebp >/dev/null 2>&1 && command -v file >/dev/null 2>&1; then
    return
  fi

  log "安装 WebP 图片优化工具（仅首次需要）"
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y webp file

  command -v cwebp >/dev/null 2>&1 || die "cwebp 安装失败"
  command -v file >/dev/null 2>&1 || die "file 安装失败"
}

ensure_font_tools() {
  if python3 - <<'PY' >/dev/null 2>&1
from fontTools.ttLib import TTFont
import brotli
PY
  then
    return
  fi

  log "安装 WOFF2 字体转换依赖（仅首次需要）"
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y python3-fonttools python3-brotli

  python3 - <<'PY' >/dev/null 2>&1 || die "字体转换依赖安装失败"
from fontTools.ttLib import TTFont
import brotli
PY
}

ensure_docker() {
  command -v docker >/dev/null 2>&1 || die "未找到 Docker"
  docker info >/dev/null 2>&1 || die "Docker daemon 不可用"
}

detect_compose_file() {
  local candidate

  for candidate in     "$APP_ROOT/compose.production.yaml"     "$APP_ROOT/compose.production.yml"     "$APP_ROOT/compose.yaml"     "$APP_ROOT/compose.yml"     "$APP_ROOT/docker-compose.yaml"     "$APP_ROOT/docker-compose.yml"
  do
    [[ -f "$candidate" ]] || continue

    if docker compose -f "$candidate" config --services 2>/dev/null | grep -qx "web"; then
      COMPOSE_FILE="$candidate"
      return
    fi
  done

  COMPOSE_FILE=""
}

restart_web() {
  detect_compose_file

  if [[ -n "$COMPOSE_FILE" ]]; then
    log "重新创建 web 容器以重新挂载新 dist：$COMPOSE_FILE"
    if docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate web; then
      return 0
    fi
    printf '[ERROR] web 容器重新创建失败\n' >&2
    return 1
  fi

  mapfile -t web_containers < <(
    docker ps -q --filter "label=com.docker.compose.service=web"
  )

  if (("${#web_containers[@]}" == 1)); then
    log "未找到含 web 服务的 Compose 文件，改为重启现有 web 容器"
    docker restart "${web_containers[0]}" >/dev/null
    return
  fi

  if (("${#web_containers[@]}" > 1)); then
    printf '[ERROR] 发现多个 Compose web 容器，无法安全判断应该重启哪一个\n' >&2
    return 1
  fi

  printf '[ERROR] 找不到 web 服务。请确认生产 Compose 文件位于 %s\n' "$APP_ROOT" >&2
  return 1
}

health_check() {
  local retries=15
  local i

  for ((i = 1; i <= retries; i++)); do
    if curl --fail --silent --show-error --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}

manual_rollback() {
  require_root
  ensure_docker

  [[ -d "$APP_ROOT/dist.prev" ]] || die "没有可回滚的上一版本：$APP_ROOT/dist.prev"

  log "执行手工回滚"

  rm -rf "$APP_ROOT/dist.swap"
  if [[ -d "$APP_ROOT/dist" ]]; then
    mv "$APP_ROOT/dist" "$APP_ROOT/dist.swap"
  fi

  mv "$APP_ROOT/dist.prev" "$APP_ROOT/dist"

  if [[ -d "$APP_ROOT/dist.swap" ]]; then
    mv "$APP_ROOT/dist.swap" "$APP_ROOT/dist.prev"
  fi

  restart_web || die "无法重启 web 容器"

  if health_check; then
    log "回滚成功：$HEALTH_URL 可正常访问"
    exit 0
  fi

  die "回滚后健康检查仍失败，请检查 Nginx / Docker 日志"
}

if [[ "${1:-}" == "--rollback" ]]; then
  manual_rollback
fi

require_root
ensure_base_tools
ensure_webp_tools
ensure_font_tools
ensure_docker

[[ -f "$ZIP_PATH" ]] || die "找不到 ZIP：$ZIP_PATH"

mkdir -p "$APP_ROOT" "$APP_ROOT/.npm-cache"

log "检查磁盘空间"
df -h "$APP_ROOT" | tail -n 1

WORK_ROOT="$(mktemp -d "$APP_ROOT/.deploy-work.XXXXXX")"
EXTRACT_DIR="$WORK_ROOT/extracted"
mkdir -p "$EXTRACT_DIR"

log "解压：$ZIP_PATH"
unzip -q "$ZIP_PATH" -d "$EXTRACT_DIR"

PACKAGE_JSON="$(
  find "$EXTRACT_DIR" -mindepth 1 -maxdepth 3 -type f -name package.json -print -quit
)"

[[ -n "$PACKAGE_JSON" ]] || die "ZIP 中未找到 package.json"
BUILD_SRC="$(dirname "$PACKAGE_JSON")"

[[ -f "$BUILD_SRC/vite.config.ts" ]] || die "未找到 vite.config.ts，ZIP 结构不符合 PawCream 项目"
[[ -f "$BUILD_SRC/scripts/convert-fonts.py" ]] || die "未找到 scripts/convert-fonts.py"
[[ -f "$BUILD_SRC/scripts/optimize-runtime-assets.py" ]] || die "未找到 scripts/optimize-runtime-assets.py"

log "源码目录：$BUILD_SRC"

log "生成 PawCream WOFF2 字体"
(
  cd "$BUILD_SRC"
  python3 scripts/convert-fonts.py
)

[[ -s "$BUILD_SRC/public/assets/font/pawcream-cn.woff2" ]] || die "中文 WOFF2 字体生成失败"
[[ -s "$BUILD_SRC/public/assets/font/pawcream-en.woff2" ]] || die "英文字体 WOFF2 生成失败"

log "安装前端依赖（在 Node Docker 容器中）"
docker run --rm   -v "$BUILD_SRC:/app"   -v "$APP_ROOT/.npm-cache:/root/.npm"   -w /app   -e "npm_config_registry=$NPM_REGISTRY"   "$NODE_IMAGE"   npm install --no-audit --no-fund

log "生成 Home + Atelier 运行时 WebP"
(
  cd "$BUILD_SRC"
  python3 scripts/optimize-runtime-assets.py
)

log "构建服务器 WebP 版本（base=/，API=/api）"
docker run --rm   -v "$BUILD_SRC:/app"   -w /app   -e "VITE_API_BASE_URL=/api"   -e "NODE_OPTIONS=--max-old-space-size=1024"   "$NODE_IMAGE"   npm run build:server:webp

[[ -s "$BUILD_SRC/dist/index.html" ]] || die "构建失败：dist/index.html 不存在"
[[ -s "$BUILD_SRC/dist/assets/font/pawcream-cn.woff2" ]] || die "构建产物缺少 pawcream-cn.woff2"
[[ -s "$BUILD_SRC/dist/assets/font/pawcream-en.woff2" ]] || die "构建产物缺少 pawcream-en.woff2"
[[ -s "$BUILD_SRC/dist/assets/home/Home_mobile.webp" ]] || die "构建产物缺少 Home_mobile.webp"
[[ -s "$BUILD_SRC/dist/assets/atelier/background.webp" ]] || die "构建产物缺少 background.webp"
[[ -s "$BUILD_SRC/dist/assets/atelier/people.webp" ]] || die "构建产物缺少 people.webp"
[[ -s "$BUILD_SRC/dist/assets/atelier/message.webp" ]] || die "构建产物缺少 message.webp"
[[ -s "$BUILD_SRC/dist/assets/atelier/sewing machine.webp" ]] || die "构建产物缺少 sewing machine.webp"

if grep -q "/PawCream/assets/font/" 2>/dev/null <<< "$(cat "$BUILD_SRC/dist/font-final-overrides.css" 2>/dev/null || true)"; then
  die "构建产物仍包含 GitHub Pages 专用字体绝对路径，拒绝上线"
fi

if grep -R -q "assets/home/Home_mobile.png\|assets/atelier/people.png\|assets/atelier/message.png\|assets/atelier/sewing%20machine.png" "$BUILD_SRC/dist/assets" 2>/dev/null; then
  die "关键运行时资源仍引用 PNG，拒绝上线"
fi

log "构建完成"
du -sh "$BUILD_SRC/dist"

NEW_DIST="$WORK_ROOT/dist.new"
mv "$BUILD_SRC/dist" "$NEW_DIST"

log "切换线上版本"
rm -rf "$APP_ROOT/dist.prev"

if [[ -d "$APP_ROOT/dist" ]]; then
  mv "$APP_ROOT/dist" "$APP_ROOT/dist.prev"
fi

mv "$NEW_DIST" "$APP_ROOT/dist"

# deploy.sh 自更新：本次部署成功后，下次会使用 ZIP 中的新脚本。
if [[ -f "$BUILD_SRC/deploy.sh" ]]; then
  cp "$BUILD_SRC/deploy.sh" "$APP_ROOT/deploy.sh.next"
  chmod 0755 "$APP_ROOT/deploy.sh.next"
fi

if ! restart_web; then
  log "web 容器重启失败，自动恢复上一版本"
  rm -rf "$APP_ROOT/dist.failed"
  mv "$APP_ROOT/dist" "$APP_ROOT/dist.failed"
  if [[ -d "$APP_ROOT/dist.prev" ]]; then
    mv "$APP_ROOT/dist.prev" "$APP_ROOT/dist"
    restart_web || true
  fi
  die "部署失败：无法重启 web 容器"
fi

log "执行网站健康检查：$HEALTH_URL"
if ! health_check; then
  log "健康检查失败，自动回滚上一版本"

  rm -rf "$APP_ROOT/dist.failed"
  mv "$APP_ROOT/dist" "$APP_ROOT/dist.failed"

  if [[ -d "$APP_ROOT/dist.prev" ]]; then
    mv "$APP_ROOT/dist.prev" "$APP_ROOT/dist"
    restart_web || true

    if health_check; then
      die "新版本健康检查失败，已自动恢复上一版本。失败版本保存在 $APP_ROOT/dist.failed"
    fi
  fi

  die "健康检查失败，并且上一版本也无法恢复正常，请检查 Docker/Nginx 日志"
fi

ZIP_SHA256="$(sha256sum "$ZIP_PATH" | awk '{print $1}')"
{
  echo "deployed_at=$(date --iso-8601=seconds)"
  echo "zip=$ZIP_PATH"
  echo "zip_sha256=$ZIP_SHA256"
} > "$APP_ROOT/DEPLOYED_VERSION"

if [[ -f "$APP_ROOT/deploy.sh.next" ]]; then
  mv "$APP_ROOT/deploy.sh.next" "$APP_ROOT/deploy.sh"
  chmod 0755 "$APP_ROOT/deploy.sh"
fi

rm -rf "$APP_ROOT/dist.failed"

log "部署成功"
echo "当前版本：$APP_ROOT/dist"
if [[ -d "$APP_ROOT/dist.prev" ]]; then
  echo "上一版本：$APP_ROOT/dist.prev"
  echo "手工回滚：sudo bash $APP_ROOT/deploy.sh --rollback"
fi
echo "网站检查：$HEALTH_URL"
