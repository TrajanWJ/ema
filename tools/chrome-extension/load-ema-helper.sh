#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXT_DIR="$ROOT_DIR/tools/chrome-extension/ema-chronicle-helper"

find_browser() {
  local candidates=(
    "${EMA_BROWSER_BIN:-}"
    "/opt/google/chrome/google-chrome"
    "/opt/google/chrome/chrome"
    "/usr/bin/google-chrome-stable"
    "/usr/bin/google-chrome"
    "/usr/bin/chromium"
    "/usr/bin/chromium-browser"
    "/snap/bin/chromium"
    "/usr/bin/brave-browser"
    "/opt/microsoft/msedge/msedge"
  )

  for candidate in "${candidates[@]}"; do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

BROWSER_BIN="$(find_browser || true)"
if [[ -z "$BROWSER_BIN" ]]; then
  echo "No supported browser binary found." >&2
  echo "Set EMA_BROWSER_BIN=/path/to/browser and rerun." >&2
  exit 1
fi

PROFILE_DIR="${EMA_BROWSER_PROFILE_DIR:-Default}"
USER_DATA_DIR="${EMA_BROWSER_USER_DATA_DIR:-$HOME/.config/google-chrome}"

exec "$BROWSER_BIN" \
  --user-data-dir="$USER_DATA_DIR" \
  --profile-directory="$PROFILE_DIR" \
  --disable-extensions-except="$EXT_DIR" \
  --load-extension="$EXT_DIR" \
  --new-window \
  "https://chatgpt.com" \
  "https://claude.ai" \
  "chrome://extensions/"
