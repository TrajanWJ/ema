# EMA — Executive Management Assistant

Personal AI OS. Elixir/Phoenix daemon + Tauri 2 + React 19 + SQLite.

**Repo:** ~/Projects/ema  
**Daemon port:** localhost:4488  
**Vault:** ~/.local/share/ema/vault/  
**DB:** ~/.local/share/ema/ema.db  
**Stack:** Elixir/Phoenix 1.8 + OTP supervision trees + SQLite via ecto_sqlite3

## Architecture

```
daemon/lib/ema/          — domain contexts (proposals, tasks, pipes, agents, etc.)
daemon/lib/ema_web/      — Phoenix controllers + channels
daemon/priv/repo/migrations/  — SQLite migrations
app/src/                 — React 19 frontend (glass morphism)
app/src/stores/          — Zustand stores (REST load + WS sync)
.superman/               — durable project semantic memory
```

## Active Systems
- **ProposalEngine** — Scheduler → Generator → Refiner → Debater → Tagger (PubSub pipeline)
- **Pipes** — EventBus → Executor (22 triggers, 15 actions)
- **SecondBrain** — VaultWatcher → GraphBuilder → SystemBrain
- **Agents** — DynamicSupervisor with AgentWorker + AgentMemory per agent
- **ClaudeSessions** — SessionWatcher (polls ~/.claude/projects/) + SessionMonitor

## Known Gaps (2026-04-03)
- Ralph loop is a stub — approved proposals dispatch nowhere
- No Execution object linking proposals → sessions → results
- SessionHarvester not implemented
- agent_sessions table does not exist (only passive claude_sessions discovery)
