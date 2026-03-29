#!/usr/bin/env bash
set -euo pipefail

echo "=== place-native setup ==="

# Ensure Erlang + Elixir on PATH (mise-installed)
export PATH="$HOME/.local/share/mise/installs/erlang/27.3.4.9/bin:$HOME/.local/share/mise/installs/elixir/1.18.4-otp-27/bin:$PATH"

# Check Elixir
if ! command -v elixir &>/dev/null; then
  echo "ERROR: Elixir not found. Install via mise:"
  echo "  mise use --global erlang@27 elixir@1.18.4-otp-27"
  exit 1
fi

# Check Rust/Cargo
if ! command -v cargo &>/dev/null; then
  echo "ERROR: Rust not found. Install via: https://rustup.rs"
  exit 1
fi

# Check Tauri CLI
if ! cargo install --list | grep -q tauri-cli; then
  echo "Installing Tauri CLI..."
  cargo install tauri-cli --version "^2"
fi

# Check pnpm
if ! command -v pnpm &>/dev/null; then
  echo "ERROR: pnpm not found. Install via: npm install -g pnpm"
  exit 1
fi

# Daemon deps
echo "Installing daemon dependencies..."
cd "$(dirname "$0")/../daemon"
mix deps.get
mix ecto.create
mix ecto.migrate
cd ..

# Frontend deps
echo "Installing frontend dependencies..."
cd app
pnpm install
cd ..

# Data directory
mkdir -p ~/.local/share/place-native

echo "=== Setup complete ==="
