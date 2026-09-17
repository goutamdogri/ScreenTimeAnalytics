#!/usr/bin/env bash
# Install the desktop agent as a systemd service (Linux, X11 or Wayland).
#
# From a checkout of this repo, run:   sudo scripts/install-agent.sh
# - Builds the agent and stages a self-contained copy at /opt/screen-time-agent
#   (via `pnpm deploy`, so no repo/pnpm needed on the target afterwards).
# - Writes /etc/screen-time-agent.env once (kept if it already exists).
# - Installs + enables screen-time-agent.service.
#
# Wayland/GNOME only: additionally install the window-probe extension (ADR-007):
#   cp -r packages/adapters/gnome-shell-extension ~/.local/share/gnome-shell/extensions/ &&
#   gnome-extensions enable screentime.windowprobe@goutamdogri
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR=/opt/screen-time-agent
ENV_FILE=/etc/screen-time-agent.env
SERVICE=screen-time-agent.service
UNIT_SRC="$ROOT/apps/desktop-agent/deploy/screen-time-agent.service.template"
TARGET_USER="${SUDO_USER:-$(id -un)}"

if [[ $EUID -ne 0 ]]; then
  echo "error: run with sudo (sudo $0) so it can write to $INSTALL_DIR and $ENV_FILE." >&2
  exit 1
fi

echo "Building agent (pnpm)…"
(cd "$ROOT" && pnpm --filter @screen-time/desktop-agent build)

echo "Staging self-contained install to $INSTALL_DIR…"
rm -rf "$INSTALL_DIR"
(cd "$ROOT" && pnpm --filter @screen-time/desktop-agent deploy "$INSTALL_DIR")

if [[ -f "$ENV_FILE" ]]; then
  echo "Keeping existing $ENV_FILE."
else
  cat > "$ENV_FILE" <<EOF
STA_API_BASE_URL=http://localhost:3000
STA_DEVICE_NAME=$(hostname)
STA_PLATFORM=auto
EOF
  echo "Wrote $ENV_FILE (edit it for your backend URL before starting the service)."
fi

sed "s/{{USER}}/$TARGET_USER/g" "$UNIT_SRC" > "/etc/systemd/system/$SERVICE"
chmod 644 "/etc/systemd/system/$SERVICE"

systemctl daemon-reload
systemctl enable "$SERVICE"

echo
echo "Installed. Start with:   systemctl start $SERVICE"
echo "View logs with:          journalctl -u $SERVICE -f"
echo "Config lives in:         $ENV_FILE"