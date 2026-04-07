#!/usr/bin/env bash
# scripts/openclaw-tunnel.sh
# Establishes a persistent SSH reverse tunnel so OpenClaw agents on the VM
# can reach EMA's REST API at localhost:4488.
#
# Usage:
#   ./scripts/openclaw-tunnel.sh start    # Start tunnel
#   ./scripts/openclaw-tunnel.sh stop     # Stop tunnel
#   ./scripts/openclaw-tunnel.sh status   # Check if running
#   ./scripts/openclaw-tunnel.sh install  # Install as systemd user service

set -euo pipefail

SSH_HOST="${OPENCLAW_SSH_HOST:-trajan@192.168.122.10}"
LOCAL_PORT="${EMA_PORT:-4488}"
REMOTE_PORT="${EMA_REMOTE_PORT:-4488}"
PID_FILE="${XDG_RUNTIME_DIR:-/tmp}/ema-openclaw-tunnel.pid"

start_tunnel() {
  if is_running; then
    echo "Tunnel already running (PID $(cat "$PID_FILE"))"
    return 0
  fi

  echo "Starting reverse tunnel: VM:${REMOTE_PORT} -> localhost:${LOCAL_PORT}"
  ssh -R "${REMOTE_PORT}:localhost:${LOCAL_PORT}" \
      "$SSH_HOST" \
      -N -f \
      -o ServerAliveInterval=30 \
      -o ServerAliveCountMax=3 \
      -o ExitOnForwardFailure=yes \
      -o StrictHostKeyChecking=accept-new

  # Find the ssh process we just started
  pgrep -f "ssh -R ${REMOTE_PORT}:localhost:${LOCAL_PORT}.*${SSH_HOST}" > "$PID_FILE" 2>/dev/null
  echo "Tunnel started (PID $(cat "$PID_FILE"))"
}

stop_tunnel() {
  if ! is_running; then
    echo "Tunnel not running"
    return 0
  fi

  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "Tunnel stopped"
}

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

status_tunnel() {
  if is_running; then
    echo "Tunnel running (PID $(cat "$PID_FILE"))"
    if ssh "$SSH_HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost:${REMOTE_PORT}/api/health" 2>/dev/null | grep -q 200; then
      echo "EMA API reachable on VM at localhost:${REMOTE_PORT}"
    else
      echo "WARNING: Tunnel process alive but EMA API not reachable on VM"
    fi
  else
    echo "Tunnel not running"
    return 1
  fi
}

install_service() {
  local service_dir="${HOME}/.config/systemd/user"
  mkdir -p "$service_dir"

  cat > "${service_dir}/ema-openclaw-tunnel.service" << UNIT
[Unit]
Description=EMA <-> OpenClaw SSH Reverse Tunnel
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/ssh -R ${REMOTE_PORT}:localhost:${LOCAL_PORT} ${SSH_HOST} -N -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
UNIT

  systemctl --user daemon-reload
  systemctl --user enable ema-openclaw-tunnel.service
  systemctl --user start ema-openclaw-tunnel.service
  echo "Service installed and started"
  systemctl --user status ema-openclaw-tunnel.service --no-pager
}

case "${1:-status}" in
  start)   start_tunnel ;;
  stop)    stop_tunnel ;;
  status)  status_tunnel ;;
  install) install_service ;;
  *)       echo "Usage: $0 {start|stop|status|install}" ;;
esac
