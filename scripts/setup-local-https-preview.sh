#!/usr/bin/env bash
# PawCream pre-ICP loopback-only HTTPS preview, safe alongside HTTP 8080.
set -euo pipefail

if (( EUID != 0 )); then
  echo '[ERROR] 请以 root 运行（证书保存在 /etc/nginx）' >&2
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="$PROJECT_DIR/nginx/pawcream-preview.conf"
CERT='/etc/nginx/pawcream-preview-cert.pem'
KEY='/etc/nginx/pawcream-preview-key.pem'
CHECK_ONLY="${1:-}"
if [[ -n "$CHECK_ONLY" && "$CHECK_ONLY" != '--check-only' ]]; then
  echo '用法: bash scripts/setup-local-https-preview.sh [--check-only]' >&2
  exit 2
fi
if [[ -f "$CERT" && ! -f "$KEY" ]] || [[ -f "$KEY" && ! -f "$CERT" ]]; then
  echo '[ERROR] TLS 证书和密钥只有一项存在，拒绝覆盖。请手动检查。' >&2
  exit 1
fi
if [[ ! -f "$CERT" ]]; then
  umask 077
  openssl req -x509 -nodes -newkey rsa:3072 -sha256 -days 90 \
    -keyout "$KEY" -out "$CERT" \
    -subj '/CN=127.0.0.1' \
    -addext 'subjectAltName=IP:127.0.0.1,DNS:localhost' >/dev/null 2>&1
  chmod 600 "$KEY" "$CERT"
  echo '[PawCream] 已在服务器本地创建自签名 HTTPS 预览证书'
fi

if ! openssl x509 -in "$CERT" -noout -checkend 0 >/dev/null 2>&1; then
  echo '[ERROR] HTTPS 预览证书已过期，请先更新证书' >&2
  exit 1
fi

nginx -t -c "$CONF"
if [[ "$CHECK_ONLY" == '--check-only' ]]; then
  echo '[PawCream] HTTPS Nginx 配置检查成功，未启动服务'
  exit 0
fi

PID_FILE='/run/nginx-pawcream-preview.pid'
if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  nginx -s reload -c "$CONF"
  echo '[PawCream] 已重载原有预览 Nginx'
else
  nginx -c "$CONF"
  echo '[PawCream] 已启动回环预览 Nginx'
fi

ss -lntp | grep -E '127\\.0\\.0\\.1:(8080|8443)' || true
echo '[PawCream] HTTP:  http://127.0.0.1:8080/'
echo '[PawCream] HTTPS: https://127.0.0.1:8443/admin （仅通过 SSH 隧道访问）'
