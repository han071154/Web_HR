#!/usr/bin/env bash
# Đóng gói mã nguồn bàn giao: xuất đúng nội dung đã commit tại một tag/commit (không kèm
# node_modules, .env, dữ liệu upload...) thành 1 file zip, dùng `git archive` nên luôn khớp
# với lịch sử Git (không vô tình kèm file rác chưa commit).
#
# Usage:
#   ./scripts/package-release.sh [git-ref] [output-dir]
#
# Ví dụ: ./scripts/package-release.sh HEAD dist-release
set -euo pipefail

GIT_REF="${1:-HEAD}"
OUTPUT_DIR="${2:-dist-release}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SHORT_SHA=$(git rev-parse --short "$GIT_REF")

mkdir -p "$OUTPUT_DIR"
OUTPUT_FILE="$OUTPUT_DIR/web-hr-$SHORT_SHA-$TIMESTAMP.zip"

echo "Packaging $GIT_REF ($SHORT_SHA) -> $OUTPUT_FILE"
git archive --format=zip -o "$OUTPUT_FILE" "$GIT_REF"

echo "Done: $OUTPUT_FILE"
echo "Note: chua kem CSDL. Chay scripts/backup-db.sh rieng neu can ban giao kem du lieu."
