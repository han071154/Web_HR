#!/usr/bin/env bash
# Rollback về một commit/tag đã biết chạy ổn định: checkout mã nguồn rồi build & chạy lại
# docker-compose. Dùng trước khi rollback: sao lưu CSDL bằng scripts/backup-db.sh, vì rollback
# mã nguồn KHÔNG tự rollback schema/dữ liệu (xem docs/DEPLOYMENT.md).
#
# Usage:
#   ./scripts/rollback.sh <git-ref>
#
# Ví dụ: ./scripts/rollback.sh v1.2.0
#        ./scripts/rollback.sh a3e203a
set -euo pipefail

GIT_REF="${1:?Usage: scripts/rollback.sh <git-ref>}"

echo "Rolling back to $GIT_REF"
git fetch --all --tags
git checkout "$GIT_REF"

echo "Rebuilding and restarting containers"
docker compose up -d --build

echo "Waiting for backend health check"
for attempt in $(seq 1 30); do
  if curl -fs "http://localhost:${BACKEND_PORT:-4000}/api/health" > /dev/null; then
    echo "Backend is healthy after rollback to $GIT_REF"
    exit 0
  fi
  sleep 1
done

echo "Backend did not become healthy after rollback" >&2
exit 1
