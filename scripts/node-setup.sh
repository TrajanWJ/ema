#!/usr/bin/env bash
# EMA Node Setup — Add this machine to an EMA mesh
# Usage: ./node-setup.sh --hosts "host1 host2 host3"
set -euo pipefail

# ── ANSI Colors ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${BLUE}[mesh]${RESET} $*"; }
success() { echo -e "${GREEN}[mesh]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[mesh]${RESET} $*"; }
error()   { echo -e "${RED}[mesh]${RESET} $*" >&2; }

# ── Parse args ─────────────────────────────────────────────────────────────────
HOSTS=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --hosts)
      HOSTS="$2"
      shift 2
      ;;
    --mesh)
      # Passed through from install.sh, ignore
      shift
      ;;
    -h|--help)
      echo "Usage: $0 --hosts \"host1 host2 host3\""
      echo ""
      echo "  --hosts   Space-separated list of mesh node hostnames/IPs"
      echo ""
      echo "This script:"
      echo "  1. Generates ~/.ssh/ema_mesh_ed25519 keypair (if absent)"
      echo "  2. Copies the public key to each host's authorized_keys"
      echo "  3. Updates ~/.config/ema/config.exs with mesh settings"
      exit 0
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -z "$HOSTS" ]]; then
  error "No hosts specified. Usage: $0 --hosts \"host1 host2\""
  exit 1
fi

echo -e "\n${BOLD}${CYAN}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}║       EMA Mesh Node Setup            ║${RESET}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════╝${RESET}\n"

# ── 1. Generate SSH keypair ────────────────────────────────────────────────────
SSH_KEY="$HOME/.ssh/ema_mesh_ed25519"
SSH_PUB="$SSH_KEY.pub"

if [[ ! -f "$SSH_KEY" ]]; then
  info "Generating EMA mesh SSH keypair at $SSH_KEY..."
  ssh-keygen -t ed25519 -f "$SSH_KEY" -N "" -C "ema-mesh@$(hostname)"
  success "Keypair generated: $SSH_KEY"
else
  info "SSH keypair already exists: $SSH_KEY"
fi

PUBKEY=$(cat "$SSH_PUB")

# ── 2. Distribute public key to each host ─────────────────────────────────────
echo -e "\n${BOLD}Distributing public key to mesh nodes:${RESET}"
SUCCESSFUL_HOSTS=()
FAILED_HOSTS=()

for host in $HOSTS; do
  echo -ne "  ${CYAN}→${RESET} $host ... "
  if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new "$host" \
       "mkdir -p ~/.ssh && chmod 700 ~/.ssh && \
        grep -qF '$PUBKEY' ~/.ssh/authorized_keys 2>/dev/null || \
        echo '$PUBKEY' >> ~/.ssh/authorized_keys && \
        chmod 600 ~/.ssh/authorized_keys" 2>/dev/null; then
    echo -e "${GREEN}✓${RESET}"
    SUCCESSFUL_HOSTS+=("$host")
  else
    echo -e "${RED}✗ (failed — check SSH access)${RESET}"
    FAILED_HOSTS+=("$host")
  fi
done

# ── 3. Update config.exs ──────────────────────────────────────────────────────
CONFIG_DIR="$HOME/.config/ema"
CONFIG_FILE="$CONFIG_DIR/config.exs"

mkdir -p "$CONFIG_DIR"

# Build Elixir host list string
HOST_LIST=""
for host in $HOSTS; do
  HOST_LIST="\"$host\", $HOST_LIST"
done
HOST_LIST="${HOST_LIST%, }"  # trim trailing comma+space

echo -e "\n${BOLD}Updating $CONFIG_FILE...${RESET}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  # Create fresh config
  cat > "$CONFIG_FILE" << CONFIG
import Config

config :ema, :distributed_ai,
  enabled: true,
  hosts: [${HOST_LIST}],
  sync_interval_ms: 30_000,
  ssh_key: Path.expand("~/.ssh/ema_mesh_ed25519")

config :ema, :spaces,
  default_space: "personal",
  spaces_dir: Path.expand("~/.local/share/ema/spaces")
CONFIG
  success "Config created with mesh settings"
else
  # Update existing config using a temp file
  TMPFILE=$(mktemp)

  # Check if distributed_ai block exists
  if grep -q "distributed_ai" "$CONFIG_FILE"; then
    # Update enabled and hosts in-place
    sed \
      -e 's/enabled: false/enabled: true/' \
      -e "s|hosts: \[\]|hosts: [${HOST_LIST}]|" \
      "$CONFIG_FILE" > "$TMPFILE"
    mv "$TMPFILE" "$CONFIG_FILE"
    success "Updated existing distributed_ai config"
  else
    # Append mesh config block
    cat >> "$CONFIG_FILE" << CONFIG

config :ema, :distributed_ai,
  enabled: true,
  hosts: [${HOST_LIST}],
  sync_interval_ms: 30_000,
  ssh_key: Path.expand("~/.ssh/ema_mesh_ed25519")
CONFIG
    success "Appended distributed_ai config"
  fi
fi

# ── 4. Summary ────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}${GREEN}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║       Mesh Setup Summary             ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════╝${RESET}\n"

echo -e "${BOLD}SSH Key:${RESET} $SSH_KEY"
echo -e "${BOLD}Public Key:${RESET}\n  $PUBKEY\n"

if [[ ${#SUCCESSFUL_HOSTS[@]} -gt 0 ]]; then
  echo -e "${GREEN}✓ Configured nodes (${#SUCCESSFUL_HOSTS[@]}):${RESET}"
  for host in "${SUCCESSFUL_HOSTS[@]}"; do
    echo -e "  • $host"
  done
fi

if [[ ${#FAILED_HOSTS[@]} -gt 0 ]]; then
  echo ""
  echo -e "${YELLOW}⚠ Failed nodes (${#FAILED_HOSTS[@]}) — add key manually:${RESET}"
  for host in "${FAILED_HOSTS[@]}"; do
    echo -e "  • $host"
  done
  echo -e "\n  Manual command:"
  echo -e "  ${BOLD}echo '$PUBKEY' | ssh <host> 'cat >> ~/.ssh/authorized_keys'${RESET}"
fi

echo -e "\n${CYAN}→${RESET} Restart EMA daemon to activate mesh:"
echo -e "  ${BOLD}systemctl --user restart ema${RESET}  (or restart mix phx.server)\n"
