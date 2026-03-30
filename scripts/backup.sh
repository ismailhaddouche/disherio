#!/usr/bin/env bash
# =============================================================================
# DisherIo - backup.sh
# Runs mongodump, compresses with timestamp and rotates backups older than 7 days.
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; RESET='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/disherio}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_NAME="disherio_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"
ARCHIVE="${BACKUP_PATH}.tar.gz"

log()  { echo -e "${GREEN}[OK]${RESET} $*"; }
warn() { echo -e "${YELLOW}[WARN]${RESET} $*"; }
err()  { echo -e "${RED}[ERROR]${RESET} $*"; exit 1; }

# ── Checks ────────────────────────────────────────────────────────────────────
check_running() {
  cd "$ROOT_DIR"
  docker compose ps mongo 2>/dev/null | grep -q "running\|Up" \
    || err "The mongo container is not running. Start the services first."
}

# ── Backup ─────────────────────────────────────────────────────────────────────
run_backup() {
  mkdir -p "$BACKUP_DIR"
  mkdir -p "$BACKUP_PATH"

  log "Starting mongodump → ${BACKUP_NAME}"
  cd "$ROOT_DIR"

  docker compose exec -T mongo mongodump \
    --db disherio \
    --out /tmp/dump_${TIMESTAMP} \
    --quiet 2>/dev/null \
    && docker compose cp "mongo:/tmp/dump_${TIMESTAMP}" "$BACKUP_PATH/" \
    || err "mongodump failed"

  # Clean up temporary dump from the container
  docker compose exec -T mongo rm -rf "/tmp/dump_${TIMESTAMP}" 2>/dev/null || true

  log "Compressing backup..."
  tar -czf "$ARCHIVE" -C "$BACKUP_DIR" "$BACKUP_NAME"
  rm -rf "$BACKUP_PATH"

  local size
  size=$(du -sh "$ARCHIVE" | cut -f1)
  log "Backup created: ${BOLD}${ARCHIVE}${RESET} (${size})"
}

# ── Rotation ──────────────────────────────────────────────────────────────────
rotate_backups() {
  log "Rotating backups older than ${RETENTION_DAYS} days..."
  local count=0
  while IFS= read -r -d '' old_backup; do
    rm -f "$old_backup"
    warn "Deleted: $(basename "$old_backup")"
    ((count++)) || true
  done < <(find "$BACKUP_DIR" -name "disherio_backup_*.tar.gz" -mtime "+${RETENTION_DAYS}" -print0 2>/dev/null)

  if [[ $count -eq 0 ]]; then
    log "No old backups to delete"
  else
    log "${count} backup(s) deleted"
  fi
}

# ── Listing ───────────────────────────────────────────────────────────────────
list_backups() {
  echo ""
  echo -e "${BOLD}  Available backups in ${BACKUP_DIR}:${RESET}"
  local found=0
  while IFS= read -r -d '' f; do
    local size date_str
    size=$(du -sh "$f" | cut -f1)
    date_str=$(stat -c '%y' "$f" | cut -d. -f1)
    echo -e "    ${f##*/}  (${size})  ${date_str}"
    ((found++)) || true
  done < <(find "$BACKUP_DIR" -name "disherio_backup_*.tar.gz" -print0 2>/dev/null | sort -z)

  [[ $found -eq 0 ]] && echo "    (none)"
  echo ""
}

# ── Main ───────────────────────────────────────────────────────────────────────
main() {
  echo -e "${BOLD}DisherIo — Backup${RESET}"
  echo ""
  check_running
  run_backup
  rotate_backups
  list_backups
  echo -e "  ${GREEN}Backup completed: ${BOLD}${ARCHIVE}${RESET}"
  echo ""
}

main "$@"
