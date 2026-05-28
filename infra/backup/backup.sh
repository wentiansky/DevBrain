#!/bin/sh
# TODO (Change 10)：实现 pg_dump 备份脚本
# - pg_dump -F c -> /backups/devbrain_YYYYMMDD.dump
# - 本地保留 14 天
# - rclone 上传到 R2，保留 90 天
# TODO (Change 11)：首次上线后手动 restore-test

TIMESTAMP=$(date +%Y%m%d)
DUMP_FILE="/backups/devbrain_${TIMESTAMP}.dump"

echo "[backup] Starting pg_dump to ${DUMP_FILE}"
pg_dump -h "${POSTGRES_HOST:-postgres}" \
  -U "${POSTGRES_USER:-devbrain}" \
  -d "${POSTGRES_DB:-devbrain}" \
  -F c \
  -f "${DUMP_FILE}"

echo "[backup] Cleaning local backups older than 14 days"
find /backups -name "devbrain_*.dump" -mtime +14 -delete

echo "[backup] Uploading to R2 via rclone"
rclone copy "${DUMP_FILE}" "r2:${R2_BUCKET}/backups/$(date +%Y/%m)/"

echo "[backup] Done"