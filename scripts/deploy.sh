#!/usr/bin/env bash
# Triển khai toàn hệ thống (db + backend + frontend) bằng Docker Compose lên một môi trường (mặc định
# staging) — dùng thủ công trên máy chủ hoặc được job deploy-staging của GitHub Actions gọi qua SSH.
#
# Các bước: sao lưu CSDL đang chạy → (tùy chọn) checkout git-ref → build & chạy container → tạo/cập nhật
# schema (+ dữ liệu demo nếu LOAD_SAMPLE_DATA=true) → chờ health check backend & frontend. Bước nào lỗi thì
# tự rollback về commit đang chạy trước đó (mã nguồn; dữ liệu phục hồi thủ công từ bản sao lưu).
#
# Usage:
#   ./scripts/deploy.sh [env-file] [git-ref]
#
# Ví dụ: ./scripts/deploy.sh .env.staging            # deploy mã nguồn hiện tại lên staging
#        ./scripts/deploy.sh .env.staging origin/Dev # deploy nhánh Dev mới nhất
set -euo pipefail

ENV_FILE="${1:-.env.staging}"
GIT_REF="${2:-}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Không tìm thấy $ENV_FILE (copy từ .env.staging.example rồi điền giá trị thật)" >&2
  exit 1
fi

# Đọc vài giá trị từ env file. Không `source`/export cả file: biến môi trường của shell sẽ đè lên env file khi
# docker compose đọc, và Git Bash trên Windows còn tự đổi "/api" thành đường dẫn Windows (hỏng VITE_API_URL).
env_value() {
  grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '\r'
}

PROJECT="$(env_value COMPOSE_PROJECT_NAME)"
PROJECT="${PROJECT:-web-hr-staging}"
BACKEND_PORT="$(env_value BACKEND_PORT)"
FRONTEND_PORT="$(env_value FRONTEND_PORT)"
LOAD_SAMPLE_DATA="$(env_value LOAD_SAMPLE_DATA)"
BACKEND_URL="http://localhost:${BACKEND_PORT:-4000}/api/health"
FRONTEND_URL="http://localhost:${FRONTEND_PORT:-8080}/"
PREVIOUS_REF=$(git rev-parse HEAD)

compose() {
  docker compose --env-file "$ENV_FILE" -p "$PROJECT" "$@"
}

wait_healthy() {
  for attempt in $(seq 1 60); do
    if curl -fs "$BACKEND_URL" > /dev/null && curl -fs "$FRONTEND_URL" > /dev/null; then
      echo "Healthy: $BACKEND_URL, $FRONTEND_URL"
      return 0
    fi
    sleep 2
  done

  echo "Hệ thống không healthy sau 120 giây" >&2
  compose ps >&2
  compose logs --tail 50 backend >&2 || true
  return 1
}

deploy() {
  compose up -d --build --remove-orphans
  compose exec -T -e LOAD_SAMPLE_DATA="${LOAD_SAMPLE_DATA:-false}" backend npm run db:setup
  wait_healthy
}

echo "==> [$PROJECT] Sao lưu CSDL hiện tại (nếu đang chạy)"
if compose ps --status running --services 2>/dev/null | grep -qx db; then
  mkdir -p "backups/$PROJECT"
  BACKUP_FILE="backups/$PROJECT/web_hr-$(date +%Y%m%d-%H%M%S).sql.gz"
  compose exec -T db pg_dump -U web_hr web_hr | gzip > "$BACKUP_FILE"
  echo "Đã sao lưu: $BACKUP_FILE"
else
  echo "CSDL chưa chạy, bỏ qua sao lưu (lần triển khai đầu tiên)"
fi

if [ -n "$GIT_REF" ]; then
  echo "==> Checkout $GIT_REF"
  git fetch --all --tags --prune
  git checkout --detach "$GIT_REF"
fi

echo "==> Build & khởi động $(git rev-parse --short HEAD)"
if deploy; then
  echo "==> Triển khai thành công $(git rev-parse --short HEAD) lên $PROJECT"
  exit 0
fi

echo "==> Triển khai lỗi, rollback về $PREVIOUS_REF" >&2
git checkout --detach "$PREVIOUS_REF"
compose up -d --build --remove-orphans
wait_healthy || true
exit 1
