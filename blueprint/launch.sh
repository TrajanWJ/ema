#!/usr/bin/env bash
# EMA desktop launcher — starts all processes needed to open the full vApp.
# Idempotent: re-running just focuses the existing launchpad.
#
# Starts in this order:
#   1. blueprint/server.js  (the live state API + SSE stream, :7777)
#   2. apps/renderer build  (static renderer bundle for desktop startup)
#   3. apps/electron main   (Electron shell — launchpad + vApp windows)
#
# Each step is skipped if the process is already running.

set -u

REPO_ROOT="/home/trajan/Projects/ema"
BLUEPRINT_SCRIPT="$REPO_ROOT/blueprint/server.js"
RENDERER_DIR="$REPO_ROOT/apps/renderer"
ELECTRON_DIR="$REPO_ROOT/apps/electron"

BLUEPRINT_PORT="${EMA_BLUEPRINT_PORT:-7777}"
BLUEPRINT_LOG="/tmp/ema-blueprint.log"
RENDERER_LOG="/tmp/ema-renderer.log"
ELECTRON_LOG="/tmp/ema-electron.log"
LAUNCHER_LOG="/tmp/ema-launcher.log"
ELECTRON_BIN="$ELECTRON_DIR/node_modules/.bin/electron"
RENDERER_INDEX="$RENDERER_DIR/dist/index.html"

if [ "${EMA_LAUNCH_LOG_REDIRECTED:-0}" != "1" ]; then
  export EMA_LAUNCH_LOG_REDIRECTED=1
  exec >>"$LAUNCHER_LOG" 2>&1
fi

# Make sure node / npx are on PATH — desktop launchers sometimes strip it
NVM_NODE_BIN="$(ls -1d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | tail -1 || true)"
export PATH="/usr/local/bin:/usr/bin:/bin:$NVM_NODE_BIN:$PATH"
NODE_BIN="$NVM_NODE_BIN/node"
NPM_BIN="$NVM_NODE_BIN/npm"

say() {
  echo "[ema] $*"
}

# ── 1. Blueprint state server (live API for the vApp) ────────────────

if curl -sSf "http://127.0.0.1:${BLUEPRINT_PORT}/health" >/dev/null 2>&1; then
  say "blueprint server already running on :${BLUEPRINT_PORT}"
else
  say "starting blueprint server on :${BLUEPRINT_PORT}"
  nohup "$NODE_BIN" "$BLUEPRINT_SCRIPT" >"$BLUEPRINT_LOG" 2>&1 &
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

# ── 2. Static renderer bundle (for reliable desktop startup) ─────────

say "building renderer bundle"
if [ ! -x "$NPM_BIN" ]; then
  say "npm binary missing at $NPM_BIN"
  command -v notify-send >/dev/null && notify-send "EMA" "NPM binary missing — check Node install"
  exit 1
fi

say "renderer build command: $NPM_BIN run build"
(
  cd "$RENDERER_DIR" &&
    "$NPM_BIN" run build >"$RENDERER_LOG" 2>&1
)
build_status=$?
if [ "$build_status" -ne 0 ]; then
  say "renderer build exited with status $build_status"
  say "renderer build failed — see $RENDERER_LOG"
  command -v notify-send >/dev/null && notify-send "EMA" "Renderer build failed — see $RENDERER_LOG"
  exit 1
fi

if [ ! -f "$RENDERER_INDEX" ]; then
  say "renderer bundle missing at $RENDERER_INDEX"
  command -v notify-send >/dev/null && notify-send "EMA" "Renderer bundle missing after build"
  exit 1
fi

say "renderer bundle ready"

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
  export EMA_RENDERER_MODE=file
  # Build main process TypeScript if dist/main.js is stale or missing
  if [ ! -f "$ELECTRON_DIR/dist/main.js" ] || [ "$ELECTRON_DIR/main.ts" -nt "$ELECTRON_DIR/dist/main.js" ]; then
    say "building electron main"
    (cd "$ELECTRON_DIR" && npm run build:main >>"$ELECTRON_LOG" 2>&1) || {
      say "electron build failed — see $ELECTRON_LOG"
      exit 1
    }
  fi
  # --no-sandbox: skip chrome-sandbox setuid root requirement for dev installs
  # (pnpm/npm don't chown root the sandbox binary on unpriv installs)
  if [ ! -x "$ELECTRON_BIN" ]; then
    say "electron binary missing at $ELECTRON_BIN"
    command -v notify-send >/dev/null && notify-send "EMA" "Electron binary missing — reinstall desktop deps"
    exit 1
  fi
  nohup "$ELECTRON_BIN" --no-sandbox --disable-gpu-sandbox "$ELECTRON_DIR/dist/main.js" \
    >>"$ELECTRON_LOG" 2>&1 </dev/null &
  disown || true
  say "electron spawned (see $ELECTRON_LOG)"
fi

exit 0
