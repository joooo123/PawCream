#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${1:-${PAWCREAM_DEPLOY_DIR:-/var/www/pawcream}}"

echo "[PawCream] install dependencies"
npm ci

echo "[PawCream] build for Gitea/Nginx"
npm run build:gitea

echo "[PawCream] publish dist -> ${DEPLOY_DIR}"
mkdir -p "${DEPLOY_DIR}"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete dist/ "${DEPLOY_DIR}/"
else
  find "${DEPLOY_DIR}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a dist/. "${DEPLOY_DIR}/"
fi

echo "[PawCream] done"
