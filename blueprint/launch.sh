#!/usr/bin/env bash
# EMA desktop launcher — starts all processes needed to open the full vApp.
# Idempotent: re-running just focuses the existing launchpad.
#
# Starts in this order:
#   1. blueprint/server.js  (the live state API + SSE stream, :7777)
#   2. apps/renderer Vite dev server  (React app at :1420)
#   3. apps/electron main  (Electron shell — launchpad + vApp windows)
#
# Each step is skipped if the process is already running.

set -u

REPO_ROOT="/home/trajan/Projects/ema"
BLUEPRINT_SCRIPT="$REPO_ROOT/blueprint/server.js"
RENDERER_DIR="$REPO_ROOT/apps/renderer"
ELECTRON_DIR="$REPO_ROOT/apps/electron"

BLUEPRINT_PORT="${EMA_BLUEPRINT_PORT:-7777}"
VITE_PORT="1420"

BLUEPRINT_LOG="/tmp/ema-blueprint.log"
VITE_LOG="/tmp/ema-vite.log"
ELECTRON_LOG="/tmp/ema-electron.log"

# Make sure node / npx are on PATH — desktop launchers sometimes strip it
NVM_NODE_BIN="$(ls -1d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | tail -1 || true)"
export PATH="/usr/local/bin:/usr/bin:/bin:$NVM_NODE_BIN:$PATH"

say() {
  echo "[ema] $*"
}

# ── 1. Blueprint state server (live API for the vApp) ────────────────

if curl -sSf "http://127.0.0.1:${BLUEPRINT_PORT}/health" >/dev/null 2>&1; then
  say "blueprint server already running on :${BLUEPRINT_PORT}"
else
  say "starting blueprint server on :${BLUEPRINT_PORT}"
  nohup node "$BLUEPRINT_SCRIPT" >"$BLUEPRINT_LOG" 2>&1 &
  disown || true
  for _ in 1 2 3 4 5; do
    if curl -sSf "http://127.0.0.1:${BLUEPRINT_PORT}/health" >/dev/null 2>&1; then
      break
    fi
    sleep 0.6
  done
  if ! curl -sSf "http://127.0.0.1:${BLUEPRINT_PORT}/health" >/dev/null 2>&1; then
    say "FAILED blueprint server — see $BLUEPRINT_LOG"
    command -v notify-send >/dev/null && notify-send "EMA" "Blueprint server failed — see $BLUEPRINT_LOG"
    exit 1
  fi
  say "blueprint server ready"
fi

# ── 2. Vite renderer dev server (for React UI) ───────────────────────

if curl -sSf "http://127.0.0.1:${VITE_PORT}/" >/dev/null 2>&1; then
  say "vite dev server already running on :${VITE_PORT}"
else
  say "starting vite renderer on :${VITE_PORT}"
  (cd "$RENDERER_DIR" && nohup npm run dev >"$VITE_LOG" 2>&1 &)
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if curl -sSf "http://127.0.0.1:${VITE_PORT}/" >/dev/null 2>&1; then
      break
    fi
    sleep 0.8
  done
  if ! curl -sSf "http://127.0.0.1:${VITE_PORT}/" >/dev/null 2>&1; then
    say "vite didn't start — see $VITE_LOG"
    command -v notify-send >/dev/null && notify-send "EMA" "Vite dev server failed — see $VITE_LOG"
    # Continue anyway — Electron will error out with a visible message
  else
    say "vite ready"
  fi
fi

# ── 3. Electron main (launchpad window + vApp windows) ───────────────

if pgrep -f "electron.*apps/electron/dist/main.js" >/dev/null 2>&1; then
  say "electron already running — focus is handled by tray/launchpad"
  # Bring existing launchpad to front via Super+Shift+Space shortcut if desktop
  # (best-effort; the tray icon click also works)
else
  say "starting electron"
  cd "$ELECTRON_DIR" || exit 1
  # Skip the managed services/workers runtime — we don't have those yet
  export EMA_MANAGED_RUNTIME=external
  # Build main process TypeScript if dist/main.js is stale or missing
  if [ ! -f "$ELECTRON_DIR/dist/main.js" ] || [ "$ELECTRON_DIR/main.ts" -nt "$ELECTRON_DIR/dist/main.js" ]; then
    say "building electron main"
    (cd "$ELECTRON_DIR" && npm run build:main >>"$ELECTRON_LOG" 2>&1) || {
      say "electron build failed — see $ELECTRON_LOG"
      exit 1
    }
  fi
  nohup "$ELECTRON_DIR/node_modules/.bin/electron" "$ELECTRON_DIR/dist/main.js" >>"$ELECTRON_LOG" 2>&1 &
  disown || true
  say "electron spawned (see $ELECTRON_LOG)"
fi

exit 0
