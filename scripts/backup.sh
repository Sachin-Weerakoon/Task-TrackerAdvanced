#!/bin/sh
# Periodic MongoDB backup: runs once at start, then every BACKUP_INTERVAL_SECONDS.
set -u
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
RETENTION="${BACKUP_RETENTION_DAYS:-7}"

while true; do
  TS="$(date -u +%Y%m%d-%H%M%S)"
  FILE="/backups/taskflow-$TS.archive.gz"
  echo "[backup] $TS starting"
  if mongodump --uri="$MONGO_URI" --archive="$FILE" --gzip; then
    echo "[backup] $TS done: $FILE"
  else
    echo "[backup] $TS FAILED" >&2
    rm -f "$FILE"
  fi
  find /backups -name 'taskflow-*.archive.gz' -mtime +"$RETENTION" -delete
  sleep "$INTERVAL"
done