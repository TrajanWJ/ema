# EMA Setup Guide

> **EMA** (Executive Memory Assistant) — local-first AI context management across your machines.

---

## Quick Install

One command installs all dependencies and sets up EMA:

```bash
git clone https://github.com/your-org/ema.git
cd ema
./scripts/install.sh
```

The installer handles:
- **mise** — Elixir/Erlang version manager
- **Erlang 27 + Elixir 1.18** — via mise
- **Rust + Cargo** — via rustup
- **pnpm** — frontend package manager
- **Tauri CLI** — desktop app tooling
- Database setup (Ecto create + migrate)
- Systemd user service (Linux)
- Default config at `~/.config/ema/config.exs`

---

## Starting EMA

### Development mode (two terminals)

**Terminal 1 — daemon:**
```bash
cd daemon
mix phx.server
```

**Terminal 2 — app:**
```bash
cd app
cargo tauri dev
```

### Production (Linux — systemd)

After install, enable the background service:

```bash
systemctl --user enable --now ema
systemctl --user status ema
```

View logs:
```bash
journalctl --user -u ema -f
```

---

## Multi-Node Mesh Setup

EMA can distribute AI context across multiple machines over SSH. Each node stays in sync and can share memory spaces.

### Step 1 — Install on each machine

Run `./scripts/install.sh` on every machine that will join the mesh.

### Step 2 — Set up the mesh from one node

```bash
./scripts/install.sh --mesh --hosts "macbook.local workstation.lan server.example.com"
```

Or run `node-setup.sh` directly after install:

```bash
./scripts/node-setup.sh --hosts "host1 host2 host3"
```

This will:
1. Generate `~/.ssh/ema_mesh_ed25519` keypair (if not present)
2. Copy the public key to each host's `~/.ssh/authorized_keys`
3. Update `~/.config/ema/config.exs` with `enabled: true` and the host list

### Step 3 — Restart the daemon

```bash
systemctl --user restart ema
# or: kill mix phx.server and re-run it
```

EMA will start syncing context across the mesh on the next startup.

---

## Spaces

**Spaces** are isolated memory contexts — like separate workspaces for different projects, clients, or modes of work.

- Each space has its own conversation history, notes, and AI context
- Switch spaces without losing work in other contexts
- Default space: `personal`

Spaces are stored in `~/.local/share/ema/spaces/`.

### Working with spaces

From the EMA interface, use the space switcher in the top bar. From the CLI (when implemented):

```bash
# Future CLI support
ema space new work-project
ema space switch work-project
ema space list
```

---

## Config Reference

Config file: `~/.config/ema/config.exs`

```elixir
import Config

# Distributed AI / Mesh settings
config :ema, :distributed_ai,
  enabled: false,            # set true to activate mesh sync
  hosts: [],                 # list of peer hostnames/IPs
  sync_interval_ms: 30_000,  # sync frequency in milliseconds
  ssh_key: Path.expand("~/.ssh/ema_mesh_ed25519")  # SSH key for mesh auth

# Spaces
config :ema, :spaces,
  default_space: "personal",
  spaces_dir: Path.expand("~/.local/share/ema/spaces")

# Optional: custom database URL (default uses local SQLite/Postgres)
# config :ema, Ema.Repo,
#   url: "postgres://localhost/ema_prod"
```

### Key options

| Key | Default | Description |
|-----|---------|-------------|
| `distributed_ai.enabled` | `false` | Enable mesh sync across nodes |
| `distributed_ai.hosts` | `[]` | Peer node hostnames or IPs |
| `distributed_ai.sync_interval_ms` | `30000` | How often to sync (ms) |
| `distributed_ai.ssh_key` | `~/.ssh/ema_mesh_ed25519` | SSH key for mesh auth |
| `spaces.default_space` | `"personal"` | Space loaded on startup |
| `spaces.spaces_dir` | `~/.local/share/ema/spaces` | Where spaces are stored |

---

## Troubleshooting

**Elixir not found after install**
```bash
export PATH="$HOME/.local/bin:$PATH"
eval "$(mise activate bash)"
```

**Database errors on first run**
```bash
cd daemon
mix ecto.drop && mix ecto.create && mix ecto.migrate
```

**App won't start (Tauri)**
```bash
# Check Rust is on PATH
source ~/.cargo/env
cd app && cargo tauri dev
```

**Mesh node unreachable**
```bash
# Test SSH connectivity manually
ssh -i ~/.ssh/ema_mesh_ed25519 yourhost "echo ok"
# Add key manually if needed
cat ~/.ssh/ema_mesh_ed25519.pub | ssh yourhost "cat >> ~/.ssh/authorized_keys"
```

---

## Directory Structure

```
ema/
├── app/              # Tauri desktop app (React + Rust)
├── daemon/           # Phoenix backend (Elixir/OTP)
├── scripts/
│   ├── install.sh    # Main installer
│   ├── node-setup.sh # Mesh setup
│   └── ema.service   # Systemd unit file
└── docs/             # Documentation
```

Runtime data:
```
~/.config/ema/config.exs          # Runtime config (yours to edit)
~/.local/share/ema/spaces/        # Memory spaces data
~/.ssh/ema_mesh_ed25519           # Mesh SSH key (auto-generated)
~/.config/systemd/user/ema.service # Installed service (Linux)
```
