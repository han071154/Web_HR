#!/usr/bin/env bash
# Sao lưu TOÀN BỘ dự án vào một thư mục có timestamp (WBS 259):
#   1. CSDL      : pg_dump dạng custom (.dump, phục hồi bằng pg_restore) + bản SQL thuần nén (.sql.gz)
#   2. Mã nguồn  : git bundle chứa mọi nhánh và tag (khôi phục: git clone web-hr.bundle)
#   3. File      : ảnh đại diện + CV ứng viên (backend/uploads, backend/storage) nén .tar.gz
#   4. SHA256SUMS: checksum để kiểm tra bản sao lưu không bị hỏng
#
# Nguồn CSDL (ưu tiên theo thứ tự):
#   - biến DATABASE_URL (vd CSDL cloud) → chạy pg_dump trong container postgres:${PG_DUMP_VERSION:-17}-alpine
#     (pg_dump phải cùng hoặc mới hơn phiên bản máy chủ), không cần cài pg_dump trên máy;
#   - không có DATABASE_URL → service "db" của docker compose (dùng ENV_FILE / COMPOSE_PROJECT nếu có).
#
# Usage:
#   ./scripts/backup-all.sh [output-dir]
#   DATABASE_URL=postgres://... ./scripts/backup-all.sh
#   ENV_FILE=.env.staging COMPOSE_PROJECT=web-hr-staging ./scripts/backup-all.sh
#
# Thư mục backups/ đã nằm trong .gitignore: bản sao lưu có dữ liệu cá nhân, không commit lên git.
set -euo pipefail

OUTPUT_ROOT="${1:-backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUT="$OUTPUT_ROOT/full-$TIMESTAMP"
mkdir -p "$OUT"

echo "==> 1/4 Sao lưu CSDL"
if [ -n "${DATABASE_URL:-}" ]; then
  IMAGE="postgres:${PG_DUMP_VERSION:-17}-alpine"
  docker run --rm -e DATABASE_URL "$IMAGE" sh -c 'pg_dump --no-owner --no-privileges -Fc "$DATABASE_URL"' > "$OUT/database.dump"
  docker run --rm -e DATABASE_URL "$IMAGE" sh -c 'pg_dump --no-owner --no-privileges "$DATABASE_URL"' | gzip > "$OUT/database.sql.gz"
else
  COMPOSE=(docker compose)
  [ -n "${ENV_FILE:-}" ] && COMPOSE+=(--env-file "$ENV_FILE")
  [ -n "${COMPOSE_PROJECT:-}" ] && COMPOSE+=(-p "$COMPOSE_PROJECT")
  "${COMPOSE[@]}" exec -T db pg_dump -U web_hr -Fc web_hr > "$OUT/database.dump"
  "${COMPOSE[@]}" exec -T db pg_dump -U web_hr web_hr | gzip > "$OUT/database.sql.gz"
fi

echo "==> 2/4 Sao lưu mã nguồn (git bundle mọi nhánh + tag)"
git bundle create "$OUT/web-hr.bundle" --all
git bundle verify "$OUT/web-hr.bundle" > /dev/null
git log -1 --format='%H %ad %s' --date=iso > "$OUT/HEAD.txt"

echo "==> 3/4 Sao lưu file upload (avatar, CV)"
FILE_DIRS=()
for dir in backend/uploads backend/storage; do
  [ -d "$dir" ] && FILE_DIRS+=("$dir")
done
if [ ${#FILE_DIRS[@]} -gt 0 ]; then
  tar -czf "$OUT/files.tar.gz" "${FILE_DIRS[@]}"
else
  echo "Không có thư mục upload trên máy này, bỏ qua"
fi

echo "==> 4/4 Checksum"
(cd "$OUT" && sha256sum ./* > SHA256SUMS)

echo "Xong: $OUT"
ls -la "$OUT"
