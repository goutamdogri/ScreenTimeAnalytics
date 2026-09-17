#!/usr/bin/env bash
# screen-time restore — pg_restore of a backup produced by scripts/backup.sh.
#
# Usage:
#   scripts/restore.sh backups/screen-time-<timestamp>.dump
#
# Restores (with --drop) into the database pointed to by DATABASE_URL. The
# target database must already exist; for Docker Compose use the `db` service.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <backup.dump>" >&2
  exit 1
fi

DUMP="$1"
if [[ ! -f "$DUMP" ]]; then
  echo "error: $DUMP does not exist." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" && -f "$ENV_FILE" ]]; then
  val="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n1 | cut -d'=' -f2-)"
  val="${val%\"}"; val="${val#\"}"
  DATABASE_URL="$val"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "error: DATABASE_URL is not set. Set it in the environment or in $ENV_FILE." >&2
  exit 1
fi

pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" "$DUMP"
echo "Restore complete."