#!/usr/bin/env bash
# EMA Install Script
# Usage: ./install.sh [--mesh]
set -euo pipefail

# ── ANSI Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMA_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

info()    { echo -e "${BLUE}[ema]${RESET} $*"; }
success() { echo -e "${GREEN}[ema]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[ema]${RESET} $*"; }
error()   { echo -e "${RED}[ema]${RESET} $*" >&2; }
step()    { echo -e "\n${BOLD}${CYAN}▶ $*${RESET}"; }

# ── Flags ──────────────────────────────────────────────────────────────────────
MESH=false
for arg in "$@"; do
  case "$arg" in
    --mesh) MESH=true ;;
    -h|--help)
      echo "Usage: $0 [--mesh]"
      echo "  --mesh   After install, run node-setup.sh to join the EMA mesh"
      exit 0
      ;;
  esac
done

echo -e "\n${BOLD}${CYAN}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║       EMA Installation Script        ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════╝${RESET}\n"

# ── 1. mise ────────────────────────────────────────────────────────────────────
step "Checking mise (Elixir/Erlang version manager)"
if ! command -v mise &>/dev/null; then
  info "mise not found — installing..."
  curl -fsSL https://mise.run | sh
  export PATH="$HOME/.local/bin:$PATH"
  success "mise installed"
else
  success "mise already installed: $(mise --version 2>/dev/null | head -1)"
fi

# Ensure mise shims are on PATH
export PATH="$HOME/.local/bin:$PATH"
eval "$(mise activate bash 2>/dev/null || true)"

# ── 2. Erlang + Elixir via mise ────────────────────────────────────────────────
step "Checking Erlang + Elixir"

# Export mise-managed paths even if mise activate isn't fully wired yet
ERLANG_VERSION="27.3.4.9"
ELIXIR_VERSION="1.18.4-otp-27"
MISE_BIN="$HOME/.local/share/mise/installs"
export PATH="$MISE_BIN/erlang/$ERLANG_VERSION/bin:$MISE_BIN/elixir/$ELIXIR_VERSION/bin:$PATH"

if ! command -v elixir &>/dev/null; then
  info "Elixir not found — installing via mise (this may take a few minutes)..."
  mise use --global erlang@27 elixir@1.18.4-otp-27
  export PATH="$MISE_BIN/erlang/$ERLANG_VERSION/bin:$MISE_BIN/elixir/$ELIXIR_VERSION/bin:$PATH"
  success "Erlang + Elixir installed via mise"
else
  ELIXIR_VER=$(elixir --version 2>/dev/null | grep "Elixir" | awk '{print $2}' || echo "unknown")
  success "Elixir $ELIXIR_VER already available"
fi

# ── 3. Rust via rustup ─────────────────────────────────────────────────────────
step "Checking Rust / Cargo"
if ! command -v cargo &>/dev/null; then
  info "Rust not found — installing via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
  export PATH="$HOME/.cargo/bin:$PATH"
  success "Rust installed"
else
  export PATH="$HOME/.cargo/bin:$PATH"
  RUST_VER=$(rustc --version 2>/dev/null | awk '{print $2}' || echo "unknown")
  success "Rust $RUST_VER already installed"
fi

# ── 4. pnpm ────────────────────────────────────────────────────────────────────
step "Checking pnpm"
if ! command -v pnpm &>/dev/null; then
  info "pnpm not found — installing..."
  if command -v npm &>/dev/null; then
    npm install -g pnpm
  else
    curl -fsSL https://get.pnpm.io/install.sh | sh -
    export PATH="$HOME/.local/share/pnpm:$PATH"
  fi
  success "pnpm installed"
else
  PNPM_VER=$(pnpm --version 2>/dev/null || echo "unknown")
  success "pnpm $PNPM_VER already installed"
fi

# ── 5. Tauri CLI ───────────────────────────────────────────────────────────────
step "Checking Tauri CLI"
if ! cargo install --list 2>/dev/null | grep -q "tauri-cli"; then
  info "Installing Tauri CLI (this may take a while)..."
  cargo install tauri-cli --version "^2"
  success "Tauri CLI installed"
else
  success "Tauri CLI already installed"
fi

# ── 6. Daemon dependencies ─────────────────────────────────────────────────────
step "Setting up EMA daemon"
cd "$EMA_ROOT/daemon"
info "Fetching Elixir dependencies..."
mix deps.get
info "Creating database..."
mix ecto.create || warn "Database may already exist — continuing"
info "Running migrations..."
mix ecto.migrate
success "Daemon setup complete"

# ── 7. Frontend dependencies ───────────────────────────────────────────────────
step "Installing frontend dependencies"
cd "$EMA_ROOT/app"
pnpm install
success "Frontend dependencies installed"

# ── 8. Systemd service (Linux only) ───────────────────────────────────────────
if [[ "$(uname -s)" == "Linux" ]]; then
  step "Setting up systemd service"
  SERVICE_SRC="$SCRIPT_DIR/ema.service"
  SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
  if [[ -f "$SERVICE_SRC" ]]; then
    mkdir -p "$SYSTEMD_USER_DIR"
    cp "$SERVICE_SRC" "$SYSTEMD_USER_DIR/ema.service"
    systemctl --user daemon-reload 2>/dev/null || true
    success "Service installed to $SYSTEMD_USER_DIR/ema.service"
    info "Enable with: systemctl --user enable --now ema"
  else
    warn "No ema.service found in scripts/ — skipping systemd setup"
  fi
fi

# ── 9. Default config ──────────────────────────────────────────────────────────
step "Creating default configuration"
CONFIG_DIR="$HOME/.config/ema"
CONFIG_FILE="$CONFIG_DIR/config.exs"

mkdir -p "$CONFIG_DIR"

if [[ ! -f "$CONFIG_FILE" ]]; then
  cat > "$CONFIG_FILE" << 'CONFIG'
import Config

# EMA Configuration
# This file is loaded at runtime and overrides compiled defaults.

config :ema, :distributed_ai,
  enabled: false,
  hosts: [],
  sync_interval_ms: 30_000,
  # SSH key used for mesh communication
  ssh_key: Path.expand("~/.ssh/ema_mesh_ed25519")

config :ema, :spaces,
  default_space: "personal",
  spaces_dir: Path.expand("~/.local/share/ema/spaces")

# Override database URL if needed
# config :ema, Ema.Repo,
#   url: "postgres://localhost/ema_dev"
CONFIG
  success "Config created at $CONFIG_FILE"
else
  info "Config already exists at $CONFIG_FILE — skipping"
fi

# ── 10. Data directories ───────────────────────────────────────────────────────
mkdir -p ~/.local/share/ema/spaces

# ── --mesh flag ────────────────────────────────────────────────────────────────
if [[ "$MESH" == "true" ]]; then
  step "Setting up mesh networking"
  if [[ -f "$SCRIPT_DIR/node-setup.sh" ]]; then
    bash "$SCRIPT_DIR/node-setup.sh" "$@"
  else
    error "node-setup.sh not found in $SCRIPT_DIR"
    exit 1
  fi
fi

# ── Success banner ─────────────────────────────────────────────────────────────
echo -e "\n${BOLD}${GREEN}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║     ✓  EMA is ready to launch!       ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════╝${RESET}\n"

echo -e "${BOLD}Next steps:${RESET}"
echo -e "  ${CYAN}1.${RESET} Start the daemon:  ${BOLD}cd daemon && mix phx.server${RESET}"
echo -e "  ${CYAN}2.${RESET} Start the app:     ${BOLD}cd app && cargo tauri dev${RESET}"
if [[ "$(uname -s)" == "Linux" ]]; then
  echo -e "  ${CYAN}3.${RESET} Or run as service: ${BOLD}systemctl --user enable --now ema${RESET}"
fi
echo -e "  ${CYAN}→${RESET} Multi-node mesh:   ${BOLD}./scripts/install.sh --mesh${RESET}"
echo -e "  ${CYAN}→${RESET} Setup docs:        ${BOLD}docs/SETUP.md${RESET}\n"
