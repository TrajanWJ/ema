# EMA Daemon

Elixir/Phoenix backend for EMA — the personal AI desktop OS.

**Port:** `localhost:4488`
**Database:** SQLite via `ecto_sqlite3` at `~/.local/share/ema/ema_dev.db`
**Framework:** Phoenix 1.8 + OTP supervision trees

## Quick Start

```bash
mix setup          # deps.get + ecto.create + ecto.migrate
mix phx.server     # start on localhost:4488
mix test           # run tests
mix precommit      # compile --warnings-as-errors + format + test
```

## Architecture

```
lib/ema/                    # Context modules (business logic + Ecto schemas)
  ├── executions/           # Runtime execution loop (dispatch → Claude → result)
  ├── proposals/            # AI proposal pipeline (generate → refine → debate → tag)
  ├── proposal_engine/      # GenServers: Scheduler, Generator, Refiner, Debater, Tagger
  ├── agents/               # Agent system (DynamicSupervisor, per-agent workers)
  ├── claude/               # Claude CLI integration (Runner, Bridge, AI router)
  ├── tasks/                # Task management with status transitions
  ├── projects/             # Project workspaces
  ├── brain_dump/           # Inbox capture
  ├── pipes/                # Automation (22 triggers, 15 actions)
  ├── second_brain/         # Vault watcher + wikilink graph
  ├── intelligence/         # IntentMap, ProjectGraph, GapScanner, TokenTracker
  ├── contacts/             # CRM contacts
  ├── finance/              # Income/expense tracking
  ├── invoices/             # Invoice management
  ├── routines/             # Routine builder
  ├── meetings/             # Meeting scheduling
  ├── clipboard/            # Shared clipboard
  ├── file_vault/           # Managed file storage
  └── ...

lib/ema_web/
  ├── router.ex             # All REST routes under /api
  ├── controllers/          # 50+ controllers
  └── channels/             # 34 WebSocket channels

config/
  ├── config.exs            # Base config
  └── runtime.exs           # Runtime config (AI backend, MCP, etc.)
```

## Key Concepts

- **Execution Loop:** brain dump → proposal → approval → dispatch → Claude CLI → result artifact
- **Proposal Pipeline:** 5-stage GenServer chain (Scheduler → Generator → Refiner → Debater → Tagger)
- **Store Pattern:** Frontend loads via REST, then connects WebSocket channel for real-time sync
- **PubSub:** All mutations broadcast via `Phoenix.PubSub` — channels subscribe and push to frontend

## API

All endpoints under `/api`. See `docs/API_CONTRACTS.md` for full reference.

Key endpoints:
- `GET/POST /api/executions` — execution lifecycle
- `GET/POST /api/proposals` — proposal pipeline
- `GET/POST /api/tasks` — task management
- `GET /api/projects/:slug/context` — full project context assembler
- `GET /api/dashboard/today` — executive summary

## Environment

- **AI Backend:** `:runner` (Claude CLI via `System.cmd`) or `:bridge` (multi-backend)
- **Claude binary:** auto-resolved from PATH or `~/.local/bin/claude`
- **Vault:** `~/.local/share/ema/vault/` — watched by SecondBrain.VaultWatcher every 5s
