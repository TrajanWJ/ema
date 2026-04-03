# EMA — Dev Setup Guide

Get EMA running locally in under 10 minutes.

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Elixir | ~> 1.15 | `asdf install elixir 1.16.3` or OS package |
| Erlang | ~> 26 | `asdf install erlang 26.2.5` |
| Node.js | >= 20 | `asdf install nodejs 22.x` or `nvm use 22` |
| pnpm | >= 9 | `npm i -g pnpm` |
| Rust | stable | `rustup install stable` |
| Tauri CLI deps | — | See below |

### Tauri system deps (Linux)
```bash
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### Tauri system deps (macOS)
```bash
xcode-select --install
```

---

## 1. Clone & Enter

```bash
git clone <repo> ema
cd ema
```

---

## 2. Daemon (Elixir/Phoenix)

```bash
cd daemon

# Install deps + create + migrate DB + seed
mix setup

# Start dev server on localhost:4488
mix phx.server
```

That's it. The daemon auto-migrates on start in dev. SQLite lives at `~/.local/share/ema/ema_dev.db`.

**Verify:** `curl http://localhost:4488/api/vm/health

---

## 3. Frontend (React + Vite)

In a **second terminal**:

```bash
cd app

npm install   # or: pnpm install

npm run dev   # vite dev server → localhost:1420 (HMR on 1421)
```

Open `http://localhost:1420` — you'll see the EMA Launchpad.

---

## 4. Full Desktop App (Tauri)

To run as a real desktop window (optional for most dev work):

```bash
cd app

npx tauri dev   # builds Rust shell + launches desktop window
```

First run compiles Rust (~2-3 min). Subsequent runs are fast.

---

## 5. Reset Database

```bash
cd daemon
mix ecto.reset   # drop + recreate + migrate + seed
```

---

## Common Dev Tasks

| Task | Command |
|---|---|
| Run all tests | `cd daemon && mix test` |
| Run single test file | `mix test test/ema/brain_dump_test.exs` |
| Run tests with output | `mix test --trace` |
| Format code | `mix format` |
| Pre-commit check | `mix precommit` (compile + format + test) |
| DB console | `cd daemon && iex -S mix` → `Ema.Repo.all(Ema.BrainDump.Item)` |
| Regenerate types from DB | `cd daemon && mix ecto.migrate` |
| Frontend lint | `cd app && npm run lint` |
| Frontend build | `cd app && npm run build` |

---

## Environment Variables

EMA uses no required env vars in dev — everything defaults work out of the box.

Optional overrides via `daemon/config/dev.exs` (never commit local changes):

```elixir
# Override DB path
config :ema, Ema.Repo, database: "/tmp/ema_custom.db"

# Use different port
config :ema, EmaWeb.Endpoint, http: [port: 4489]
```

---

## AI Backend

EMA routes AI calls through the **bridge** (multi-backend) or **runner** (direct Claude CLI).

```elixir
# config/dev.exs — switch AI backend
config :ema, ai_backend: :bridge   # default
# or
config :ema, ai_backend: :runner   # direct System.cmd to claude CLI
```

Claude CLI must be on `$PATH` for runner mode. Check: `which claude`.

---

## Troubleshooting

### "Database file not found"
```bash
mkdir -p ~/.local/share/ema
cd daemon && mix ecto.create && mix ecto.migrate
```

### "Port 4488 already in use"
```bash
lsof -i :4488 | grep LISTEN
kill -9 <PID>
```

### "Tauri won't compile"
```bash
rustup update stable
cargo clean  # from app/src-tauri/
npx tauri dev
```

### "Mix deps conflict"
```bash
cd daemon && mix deps.clean --all && mix deps.get
```

### "Frontend can't reach daemon"


---

## Project Structure

```
ema/
├── app/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/   # Feature UIs (brain-dump/, tasks/, etc.)
│   │   ├── stores/       # Zustand stores (one per feature)
│   │   ├── lib/          # api.ts, ws.ts, shared utils
│   │   └── types/        # Shared TypeScript types
│   └── src-tauri/        # Rust Tauri shell
├── daemon/               # Elixir/Phoenix backend
│   ├── lib/
│   │   ├── ema/          # Business logic (contexts)
│   │   └── ema_web/      # HTTP API + WebSocket channels
│   ├── priv/repo/        # Migrations + seeds
│   └── test/             # ExUnit tests
├── docs/                 # This documentation
└── scripts/              # Dev/deploy automation scripts
```

---

## Next Steps

- Read `docs/TESTING.md` — how to write and run tests
- Read `docs/DEV_GUIDE.md` — extending features, adding new contexts
- Read `docs/DEPLOYMENT.md` — shipping safely
