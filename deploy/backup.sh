#!/usr/bin/env bash
# ============================================================
#  Daily PostgreSQL backup with rotation (runs ON THE VPS).
#
#  1) Replace DATABASE_URL password with the real one.
#  2) Make executable:        chmod +x deploy/backup.sh
#  3) Add to root crontab:    sudo crontab -e
#       17 3 * * *  /opt/oakhaven/deploy/backup.sh >> /opt/oakhaven-backups/backup.log 2>&1
#
#  Restore example:
#    pg_restore --clean --if-exists -d "$DATABASE_URL" file.dump
# ============================================================
set -euo pipefail

BACKUP_DIR=/opt/oakhaven-backups
KEEP_DAYS=14
DATABASE_URL='postgresql://ohy:REPLACE_ME@127.0.0.1:5432/oakhaven'

mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/oakhaven-$(date +%F-%H%M).dump"

pg_dump "$DATABASE_URL" -Fc -f "$FILE"

# rotate
find "$BACKUP_DIR" -name 'oakhaven-*.dump' -mtime "+$KEEP_DAYS" -delete

echo "[$(date -Is)] OK  $FILE  ($(du -h "$FILE" | cut -f1))"

# ── Optional: also copy every backup off the VPS ────────────
# FROM your own computer, once a week, run:
#   rsync -az oakhaven@BACKEND_VPS_IP:/opt/oakhaven-backups/ ./backups/
# (Do this while your DNS only points to the proxy — you connect
#  by IP directly for SSH anyway; DNS has nothing to do with it.)
