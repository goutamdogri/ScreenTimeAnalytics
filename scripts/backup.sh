#!/usr/bin/env bash
# screen-time backup — pg_dump of the backend database.
#
# Works for every deployment mode (local Docker Compose, VPS, managed cloud
# Postgres) because it speaks plain Postgres over DATABASE_URL.
#
# Usage:
#   scripts/backup.sh                          # uses DATABASE_URL from .env
#   DATABASE_URL=... scripts/backup.sh         # or from the environment
#   BACKUPS_DIR=/path/with-room scripts/backup.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
BACKUPS_DIR="${BACKUPS_DIR:-$ROOT/backups}"

if [[ -z "${DATABASE_URL:-}" && -f "$ENV_FILE" ]]; then
  val="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n1 | cut -d'=' -f2-)"
  val="${val%\"}"; val="${val#\"}"
  DATABASE_URL="$val"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "error: DATABASE_URL is not set. Set it in the environment or in $ENV_FILE." >&2
  exit 1
fi

mkdir -p "$BACKUPS_DIR"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUPS_DIR/screen-time-$stamp.dump"

pg_dump --format=custom --no-owner "$DATABASE_URL" > "$out"
echo "Backup written to $out"