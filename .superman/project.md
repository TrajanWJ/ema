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
daemon/lib/ema_web/      — Phoenix controllers + channels (~50 controllers, 34 channels)
daemon/priv/repo/migrations/  — SQLite migrations (80+ tables)
app/src/                 — React 19 frontend (glass morphism, 50+ vApps)
app/src/stores/          — 67+ Zustand stores (REST load + WS sync)
.superman/               — durable project semantic memory
docs/                    — architecture, features, schemas, security specs
```

## Active Supervised Systems

| System | Supervision | Purpose |
|--------|------------|---------|
| ProposalEngine | rest_for_one | Scheduler → Generator → Refiner → Debater → Tagger → Combiner |
| Pipes | rest_for_one | EventBus → Registry → Loader → Executor (22 triggers, 15 actions) |
| SecondBrain | one_for_one | VaultWatcher → GraphBuilder → SystemBrain |
| Actors | Bootstrap on startup | 18 actors (1 human + 17 agents), phase cadence, tags, entity_data |
| Agents | DynamicSupervisor | Per-agent: AgentWorker + AgentMemory + channels (linked to Actors via FK) |
| ClaudeSessions | one_for_one | SessionWatcher (polls JSONL) + SessionMonitor (pgrep) |
| Babysitter | one_for_one | OrgController + StreamChannels + StreamTicker + VisibilityHub |
| Harvesters | one_for_one | GitHarvester + SessionHarvester (Vault/Usage/BrainDump not yet implemented) |
| Vectors | one_for_one | Index + Embedder |
| Responsibilities | one_for_one | Scheduler + HealthCalculator |
| Canvas | one_for_one | DataRefresher |
| Bridge (opt-in) | rest_for_one | SmartRouter + AccountManager + CostTracker + QualityGate |

## AI Backend

Default: `:runner` (Claude CLI via `Ema.Claude.AI.run/1`).  
Bridge (`:bridge`) is built but opt-in via `config :ema, :ai_backend, :bridge`.  
Multiple modules call `Bridge.run/2` which silently falls back to Runner when Bridge isn't started.

## Execution Loop (working end-to-end)

```
Proposal approved
  → Ema.Executions.on_proposal_approved/1
  → Execution record created
  → PubSub "executions:dispatch"
  → Ema.Executions.Dispatcher handles {:dispatch, execution}
  → Claude CLI invocation
  → Result artifact written
  → Execution completed
```

## Known Gaps (2026-04-05)

### Critical
- 7 frontend stores join channels that don't have matching `def join` handlers
- Bridge features (routing, cost tracking, governance) silently bypassed on every AI call
- 3 harvester modules declared but not implemented (vault, usage, brain_dump)
- Vault path resolved 4 different ways across codebase

### Phase 2 In Progress
- Intelligence.Router — event classification (not started)
- ContextInjector — vault + goals enrichment (not started)
- Domain agents (Strategist, Coach, Archivist) (not started)
- CampaignManager — persistent session clusters (not started)
- Outcome linker — proposal → result tracking (not started)
- Auto-approve rules (not started)
- Genealogy edge tracking / friction map heatmap (not started)

### Recently Built (in worktree branches, not yet merged)
- Superman.Context.for_project/2 — project dashboard context API
- Proposal API contract normalization
- BridgeDispatch GenServer — async dispatch with tracking + retries
- SeedPreflight — quality gate with scoring, dedup, enrichment
- Claude Failure Taxonomy — typed failures + preflight checks + event store
- Brain Dump → Proposal Loop — embedding clusters + auto-surfacing
- OpenClaw Vault Sync — rsync mirror + delta consumer + reconciler

## Key Docs

| Doc | What |
|-----|------|
| `docs/IMPLEMENTATION_ROADMAP.md` | Phase 1-4 status matrix |
| `docs/FEATURES.md` | Full feature specs |
| `docs/CONTRADICTIONS-AUDIT-2026-04-04.md` | 14 issues found, top 5 fix recommendations |
| `docs/PAP.md` | 12-week phase breakdown |
| `docs/features/FEATURE_*.md` | 8 individual feature specs |
| `docs/ARCHITECTURE.md` | System architecture |
| `docs/API_CONTRACTS.md` | API documentation |
