#!/usr/bin/env bash
# Package the browser extension for manual (load-unpacked) install.
#
# Produces: release/screen-time-extension.zip containing manifest.json + dist.
# Load in Chrome/Edge: chrome://extensions → Developer mode → Load unpacked
# (or unzip and point at the extracted folder).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/release"
BUILD_DIR="$ROOT/apps/extension"
ARTIFACT="$OUT_DIR/screen-time-extension.zip"

cd "$ROOT"
if ! command -v zip >/dev/null 2>&1; then
  echo "error: 'zip' is required (sudo apt-get install zip)." >&2
  exit 1
fi

pnpm --filter @screen-time/extension build

rm -f "$ARTIFACT"
(
  cd "$BUILD_DIR"
  zip -qr "$ARTIFACT" manifest.json dist
)

echo "Packaged: $ARTIFACT"