#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.local/share/mise/installs/erlang/27.3.4.9/bin:$HOME/.local/share/mise/installs/elixir/1.18.4-otp-27/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== place-native dev ==="

# Ensure data dir exists
mkdir -p ~/.local/share/place-native

# Start Elixir daemon in background
echo "Starting daemon on :4488..."
cd "$ROOT/daemon"
mix ecto.migrate 2>/dev/null
mix phx.server &
DAEMON_PID=$!

# Wait for daemon
for i in {1..30}; do
  if curl -s http://localhost:4488/api/dashboard/today > /dev/null 2>&1; then
    echo "Daemon ready."
    break
  fi
  sleep 0.5
done

# Start Tauri dev
echo "Starting Tauri frontend..."
cd "$ROOT/app"
cargo tauri dev &
TAURI_PID=$!

# Cleanup on exit
trap "kill $DAEMON_PID $TAURI_PID 2>/dev/null; echo 'Stopped.'" EXIT
echo "Running. Ctrl+C to stop."
wait
