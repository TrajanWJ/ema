#!/usr/bin/env bash

set -u

REPO_ROOT="/home/trajan/Projects/ema"
BLUEPRINT_SCRIPT="$REPO_ROOT/blueprint/server.js"
RENDERER_INDEX="$REPO_ROOT/apps/renderer/dist/index.html"
ELECTRON_MAIN="$REPO_ROOT/apps/electron/dist/main.js"
ELECTRON_BIN="$REPO_ROOT/apps/electron/node_modules/.bin/electron"

BLUEPRINT_PORT="${EMA_BLUEPRINT_PORT:-7777}"
LAUNCHER_LOG="/tmp/ema-launcher.log"
BLUEPRINT_LOG="/tmp/ema-blueprint.log"
ELECTRON_LOG="/tmp/ema-electron.log"

NVM_NODE_BIN="$(ls -1d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | tail -1 || true)"
NODE_BIN="$NVM_NODE_BIN/node"

exec >>"$LAUNCHER_LOG" 2>&1

say() {
  echo "[ema] $*"
}

if [ ! -x "$NODE_BIN" ]; then
  say "node binary missing at $NODE_BIN"
  exit 1
fi

if [ ! -f "$RENDERER_INDEX" ]; then
  say "renderer bundle missing at $RENDERER_INDEX"
  command -v notify-send >/dev/null && notify-send "EMA" "Renderer bundle missing. Build apps/renderer first."
  exit 1
fi

if [ ! -f "$ELECTRON_MAIN" ]; then
  say "electron main bundle missing at $ELECTRON_MAIN"
  command -v notify-send >/dev/null && notify-send "EMA" "Electron bundle missing. Build apps/electron first."
  exit 1
fi

if ! curl -sSf "http://127.0.0.1:${BLUEPRINT_PORT}/health" >/dev/null 2>&1; then
  say "starting blueprint server on :${BLUEPRINT_PORT}"
  nohup "$NODE_BIN" "$BLUEPRINT_SCRIPT" >"$BLUEPRINT_LOG" 2>&1 </dev/null &
  disown || true
else
  say "blueprint server already running on :${BLUEPRINT_PORT}"
fi

if pgrep -f "electron.*apps/electron/dist/main.js|electron/cli.js .*apps/electron/dist/main.js" >/dev/null 2>&1; then
  say "electron already running"
  if command -v wmctrl >/dev/null 2>&1; then
    wmctrl -a "EMA" >/dev/null 2>&1 || true
  fi
  exit 0
fi

say "starting electron"
cd "$REPO_ROOT/apps/electron" || exit 1
export EMA_MANAGED_RUNTIME=external
export EMA_RENDERER_MODE=file
say "execing electron"
exec "$ELECTRON_BIN" --no-sandbox --disable-gpu-sandbox "$ELECTRON_MAIN" \
  >>"$ELECTRON_LOG" 2>&1
