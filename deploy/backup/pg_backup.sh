#!/usr/bin/env bash
# =============================================================================
# Argeneo — daily PostgreSQL backup (CDC §3.3: daily, restorable, off-site).
# =============================================================================
# Runs on the VPS, invoked by argeneo-backup.service (see the .timer for daily
# scheduling). Produces a timestamped custom-format dump (pg_restore-friendly),
# gzipped, with local retention; then optionally copies it OFF-SITE.
#
# Install: provision.sh copies this to /usr/local/bin/argeneo-pg-backup.sh.
# Manual run / test:   sudo -u postgres /usr/local/bin/argeneo-pg-backup.sh
# =============================================================================
set -euo pipefail

# --- Tunables ---------------------------------------------------------------
PG_DB="${PG_DB:-argeneo}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/argeneo}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"      # keep ~2 weeks of daily dumps
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="${BACKUP_DIR}/argeneo-${TIMESTAMP}.dump"   # custom format (-Fc)
LOG_TAG="argeneo-backup"

logger -t "${LOG_TAG}" "Starting backup of '${PG_DB}' -> ${DUMP_FILE}.gz"
mkdir -p "${BACKUP_DIR}"

# --- 1. Dump ----------------------------------------------------------------
# -Fc = custom format: compressed, selective restore, parallel-restore capable.
# Run as the postgres OS user (peer auth) — no password needed locally.
pg_dump -Fc "${PG_DB}" -f "${DUMP_FILE}"

# --- 2. Compress ------------------------------------------------------------
# Custom format is already compressed, but gzip gives a uniform .gz artifact
# and an extra integrity check. -Fc files are still binary; we gzip the wrapper.
gzip -f "${DUMP_FILE}"
FINAL="${DUMP_FILE}.gz"
chmod 600 "${FINAL}"

SIZE="$(du -h "${FINAL}" | cut -f1)"
logger -t "${LOG_TAG}" "Backup written: ${FINAL} (${SIZE})"

# --- 3. Local retention -----------------------------------------------------
# Delete dumps older than RETENTION_DAYS days.
find "${BACKUP_DIR}" -name 'argeneo-*.dump.gz' -type f -mtime "+${RETENTION_DAYS}" -print -delete \
  | sed 's/^/pruned: /' | while read -r line; do logger -t "${LOG_TAG}" "$line"; done

# --- 4. OFF-SITE copy (CDC: do NOT rely only on the VPS snapshot) -----------
# >>> PLACEHOLDER — uncomment and configure ONE of the options below. <<<
# Without this, backups live only on the VPS. The CDC requires off-site.
#
# Option A — rclone to S3 / OVH Object Storage / Backblaze / Google Drive:
#   rclone copy "${FINAL}" "argeneo-remote:argeneo-backups/" \
#     --config /etc/argeneo/rclone.conf
#
# Option B — rsync over SSH to another host (key-based, no passphrase):
#   rsync -az -e "ssh -i /etc/argeneo/backup_id_ed25519" \
#     "${FINAL}" "backup@offsite.example.com:/srv/argeneo-backups/"
#
# Option C — copy to a mounted external/network volume:
#   cp "${FINAL}" /mnt/offsite/argeneo-backups/
#
# echo "OFF-SITE COPY NOT CONFIGURED" >&2   # remove once configured
logger -t "${LOG_TAG}" "Backup finished. (Off-site copy is a placeholder — configure it!)"
