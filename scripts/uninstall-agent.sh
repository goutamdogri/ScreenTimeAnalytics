#!/usr/bin/env bash
# Remove the desktop agent systemd service and its staged install.
#   sudo scripts/uninstall-agent.sh
set -euo pipefail

SERVICE=screen-time-agent.service
INSTALL_DIR=/opt/screen-time-agent
ENV_FILE=/etc/screen-time-agent.env

if [[ $EUID -ne 0 ]]; then
  echo "error: run with sudo (sudo $0)." >&2
  exit 1
fi

systemctl disable --now "$SERVICE" || true
rm -f "/etc/systemd/system/$SERVICE"
systemctl daemon-reload
rm -rf "$INSTALL_DIR"

if [[ -e "$ENV_FILE" ]]; then
  echo "Keeping $ENV_FILE (delete it manually if you want it gone)."
fi
echo "Agent uninstalled."