#!/usr/bin/env bash
# Sao lưu CSDL PostgreSQL ra file .sql.gz có timestamp (HR DevOps, Tuần 7).
# Dùng được cả khi Postgres chạy trong docker-compose (service "db") hoặc một host khác.
#
# Usage:
#   ./scripts/backup-db.sh [output-dir]
#
# Biến môi trường tùy chọn: PGHOST, PGPORT, PGUSER, PGDATABASE (mặc định khớp docker-compose.yml),
# hoặc chạy qua docker compose: `docker compose exec db pg_dump -U web_hr web_hr | gzip > backup.sql.gz`
set -euo pipefail

OUTPUT_DIR="${1:-backups}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-web_hr}"
PGDATABASE="${PGDATABASE:-web_hr}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/web_hr-$TIMESTAMP.sql.gz"

echo "Backing up $PGDATABASE@$PGHOST:$PGPORT -> $OUTPUT_FILE"
PGPASSWORD="${PGPASSWORD:-web_hr_password}" pg_dump \
  -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  | gzip > "$OUTPUT_FILE"

echo "Done: $OUTPUT_FILE"
