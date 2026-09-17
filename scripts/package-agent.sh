#!/usr/bin/env bash
# Package the desktop agent as a portable zip for any OS (Windows included).
#
# Produces: release/screen-time-agent-<version>-<os>-<arch>.zip
# The zip is self-contained (bundled prod deps) and needs only Node.js >= 20
# plus a platform adapter backend (xprop/dbus on Linux, PowerShell on Windows).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$ROOT/release/package/screen-time-agent"
OUT_DIR="$ROOT/release"

cd "$ROOT"
if ! command -v zip >/dev/null 2>&1; then
  echo "error: 'zip' is required (sudo apt-get install zip)." >&2
  exit 1
fi

pnpm --filter @screen-time/desktop-agent build

rm -rf "$STAGE"
pnpm --filter @screen-time/desktop-agent deploy "$STAGE"

version="$(node -p "require('./apps/desktop-agent/package.json').version || 'dev'")"
os="$(node -p "process.platform")"
arch="$(node -p "process.arch")"
artifact="$OUT_DIR/screen-time-agent-$version-$os-$arch.zip"

cat > "$STAGE/README.md" <<'EOF'
# Screen Time Desktop Agent
Run with Node.js >= 20:
  node dist/cli.js run

Configure via STA_* environment variables (see the repo's .env.example —
STA_API_BASE_URL, STA_DEVICE_NAME, STA_PLATFORM are the essentials).

Linux (X11 only): see the repo for a systemd installer.
Wayland/GNOME: also install the gnome-shell-extension (ADR-007).
Windows: runs via PowerShell adapters; start with a scheduled task.
EOF

rm -f "$artifact"
(cd "$STAGE" && zip -qr "$artifact" .)
rm -rf "$STAGE"

echo "Packaged: $artifact"