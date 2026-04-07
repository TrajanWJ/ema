# EMA — Executive Management Assistant

Personal AI desktop app: an autonomous thinking companion and life OS.

**Stack:** Elixir/Phoenix 1.8 daemon + Tauri 2 + React 19 + Zustand + SQLite  
**Aesthetic:** Glass morphism (dark void backgrounds, frosted blur surfaces, teal/blue/amber accents)  
**Port:** Daemon runs on `localhost:4488`

---

## Architecture Overview

> **⚠️ Historical Artifact Warning:** `docs/superpowers/specs/2026-03-29-ema-design.md` is a spec for the **predecessor project "place-native"** (targets KDE Neon, uses `place.db` at `~/.local/share/place-native/`). It does **NOT** describe EMA. Ignore it for EMA development.


```
┌─────────────────────────────────────────────┐
│  Tauri Shell (Rust)                         │
│  ├─ Launchpad window (always open)          │
│  ├─ Per-app webview windows (on demand)     │
│  └─ Tray icon (close = minimize)            │
├─────────────────────────────────────────────┤
│  React Frontend (app/src/)                  │
│  ├─ Route-based app switching (App.tsx)      │
│  ├─ 67+ Zustand stores (REST load + WS sync) │
│  └─ Glass CSS design system (globals.css)   │
├─────────────────────────────────────────────┤
│  Phoenix Daemon (daemon/)                   │
│  ├─ REST API (/api/*)                       │
│  ├─ WebSocket Channels (Phoenix.PubSub)     │
│  ├─ OTP Supervision Trees                   │
│  └─ SQLite via Ecto (ecto_sqlite3)          │
└─────────────────────────────────────────────┘
```

Communication: Each frontend store calls `loadViaRest()` on mount, then `connect()` to join a Phoenix channel for real-time pushes. REST is the source of truth for initial load; channels broadcast mutations.

---

## Build & Dev Commands

```bash
# Daemon
cd daemon
mix setup          # deps.get + ecto.create + ecto.migrate
mix phx.server     # start on localhost:4488
mix test           # run tests
mix precommit      # compile --warnings-as-errors + deps.unlock --check-unused + format --check + test

# Frontend
cd app
npm install
npm run dev        # vite dev server on localhost:1420 (HMR on 1421)
npm run build      # tsc -b && vite build

# Tauri (from app/)
npx tauri dev      # full desktop app with hot reload
npx tauri build    # production build
```

---

## Daemon Module Map

### Core Contexts (CRUD + business logic)

| Module | Schema | Purpose |
|--------|--------|---------|
| `Ema.BrainDump` | `Item` | Inbox capture — quick thoughts, links, ideas |
| `Ema.Tasks` | `Task`, `Comment` | Actionable work items with status transitions |
| `Ema.Projects` | `Project` | Workspaces with linked paths, context docs |
| `Ema.Proposals` | `Proposal`, `Seed`, `ProposalTag` | AI-generated ideas queued for review |
| `Ema.Habits` | `Habit`, `HabitLog` | Daily habits with streak tracking |
| `Ema.Journal` | `Entry` | Daily journal with mood/energy, full-text search |
| `Ema.Settings` | `Setting` | Key-value app configuration |
| `Ema.Workspace` | `WindowState` | Per-app window position/size persistence |
| `Ema.Responsibilities` | `Responsibility`, `CheckIn` | Recurring obligations with health scores |
| `Ema.Goals` | `Goal` | Goal tracking (scaffolded) |
| `Ema.Focus` | `Session`, `Block` | Focus timer (scaffolded) |
| `Ema.Notes` | `Note` | Simple notes (scaffolded, separate from SecondBrain) |
| `Ema.Canvas` | `Canvas`, `Element`, `DataSource` | Visual workspaces with live data |
| `Ema.VaultIndex` | `VaultEntry` | Vault file index (scaffolded) |
| `Ema.AppShortcuts` | `AppShortcut` | Keyboard shortcut bindings |

### Supervised Systems (OTP GenServers)

#### Claude Integration (`lib/ema/claude/`)
- **`runner.ex`** — Shells out to `claude` CLI with `--output-format json`. Task.async with 120s timeout. `available?/0` checks System.find_executable.
- **`context_manager.ex`** — Builds enriched prompts for proposal pipeline stages (generator/refiner/debater/tagger). Pulls project context, recent proposals, active tasks.

#### Claude Sessions (`lib/ema/claude_sessions/`)
Supervised by `ClaudeSessions.Supervisor` (one_for_one).

| GenServer | Purpose |
|-----------|---------|
| `SessionWatcher` | Polls `~/.claude/projects/**/*.jsonl` every 30s, parses sessions, imports to DB |
| `SessionMonitor` | Detects active `claude` processes via `pgrep` every 5s, broadcasts presence |

Supporting modules:
- `SessionParser` — Parses JSONL session files (extracts tool_calls, files_touched, tokens, timestamps)
- `SessionLinker` — Matches sessions to EMA projects by path
- `ClaudeSessions` — Context module (list/create/update/link/complete sessions)
- `ClaudeSession` — Ecto schema (session_id, project_path, status, token_count, files_touched)

#### Actor/Workspace System (`lib/ema/actors/`)
Bootstrapped on startup via `Ema.Actors.Bootstrap.ensure_defaults/0`. Creates actor records for all active agents + human operator. Actors are the collaboration/workspace identity layer; Agents are the operational worker runtime.

| Component | Purpose |
|-----------|---------|
| `Actors` | Context module: CRUD, phase transitions, tags, entity_data, commands |
| `Actor` | Schema: id, slug, actor_type (human/agent), phase, capabilities, config |
| `Bootstrap` | Idempotent startup: creates human actor + agent actors, backfills agent FK |
| `Tag` | Universal tags: any actor can tag any entity |
| `EntityData` | Per-actor metadata on any entity (priority, sprint_week, etc.) |
| `PhaseTransition` | Append-only log: plan → execute → review → retro cadence |
| `ActorCommand` | Agent-registered CLI extensions |
| `ContainerConfig` | Per-container (space/project/task) settings |

**Bridge:** `Ema.Agents.Agent` has `actor_id` FK to `Ema.Actors.Actor`. Slug convention as fallback. Bridge functions: `Ema.Actors.actor_for_agent/1`, `Ema.Agents.agent_for_actor/1`.

**Actor-stamping:** Tasks and executions get `actor_id` on creation (defaults to human actor). REST API supports `?actor_id=` filtering on `/api/tasks` and `/api/executions`.

#### Agents System (`lib/ema/agents/`)
Supervised by `Agents.Supervisor` (DynamicSupervisor). Starts active agents on boot. Each agent has a corresponding Actor record (workspace identity) linked via `actor_id` FK.

| Component | Purpose |
|-----------|---------|
| `AgentSupervisor` | Per-agent supervisor: AgentWorker + AgentMemory + channel DynamicSupervisor |
| `AgentWorker` | GenServer handling messages, Claude CLI calls, tool execution |
| `AgentMemory` | GenServer managing conversation compression (summarizes when >20 messages) |
| `ApiChannel` | Synchronous REST chat handler |
| `WebchatChannelBridge` | Bridges Phoenix channel messages to AgentWorker |
| `DiscordChannel` | Stub (needs nostrum dep) |
| `TelegramChannel` | Stub (needs ex_gram dep) |

Schemas: `Agent` (slug, model, temperature, tools, settings, actor_id), `Channel` (type, config), `Conversation`, `Message`, `Run`

#### Proposal Engine (`lib/ema/proposal_engine/`)
Supervised by `ProposalEngine.Supervisor` (rest_for_one).

Pipeline: **Scheduler** → **Generator** → **Refiner** → **Debater** → **Tagger**

| GenServer | Purpose |
|-----------|---------|
| `Scheduler` | Checks seeds every 60s, dispatches to Generator when schedule fires |
| `Generator` | Builds prompt via ContextManager, calls Claude, creates raw proposal, publishes `:generated` |
| `Refiner` | Subscribes to `:generated`, runs critique pass, publishes `:refined` |
| `Debater` | Subscribes to `:refined`, runs steelman/red-team/synthesis, sets confidence score, publishes `:debated` |
| `Tagger` | Subscribes to `:debated`, auto-assigns tags via Claude haiku, sets status "queued", publishes `:queued` |
| `Combiner` | Hourly scan: clusters queued proposals by shared tags, creates cross-pollination seeds |
| `KillMemory` | Tracks killed proposal patterns (Jaccard similarity on titles, tag overlap) |

PubSub topic: `"proposals:pipeline"` with `{:proposals, stage_atom, proposal}`.  
User actions: **approve** (→ creates `Execution` record → dispatched via `executions:dispatch` PubSub → `Ema.Executions.Dispatcher` → AI agent handles → output creates Task/artifact), **redirect** (→ 3 new seeds), **kill** (→ KillMemory).

#### Pipes System (`lib/ema/pipes/`)
Supervised by `Pipes.Supervisor` (rest_for_one: Registry → Loader → Executor).

| Component | Purpose |
|-----------|---------|
| `Registry` | Catalog of 22 triggers + 15 actions. Stock triggers/actions for brain_dump, tasks, proposals, projects, habits, system |
| `Loader` | Seeds 7 stock pipes on first boot (e.g., "Approved Proposal → Task") |
| `Executor` | Subscribes to active pipe trigger patterns, runs transform chain, executes actions |
| `EventBus` | Simple module broadcasting `{:pipe_event, trigger_pattern, payload}` |

Transforms: filter, map, delay, conditional, claude (stub).  
Schemas: `Pipe` (trigger_pattern as "context:event"), `PipeAction`, `PipeTransform`, `PipeRun`.

#### Second Brain (`lib/ema/second_brain/`)
Supervised by `SecondBrain.Supervisor` (one_for_one).

| Component | Purpose |
|-----------|---------|
| `VaultWatcher` | Polls vault dir every 5s, syncs file changes to DB, creates directory structure |
| `GraphBuilder` | Parses `[[wikilinks]]` from markdown, maintains link graph in DB |
| `SystemBrain` | Auto-writes state files to `vault/system/state/` (projects.md, notes.md, proposals.md) with 5s debounce |

Vault location: `~/.local/share/ema/vault/`  
Schemas: `Note` (file_path, space, tags, source_type), `Link` (source_note, target_note, link_type)

#### Responsibilities (`lib/ema/responsibilities/`)
Supervised by `Responsibilities.Supervisor`.

| Component | Purpose |
|-----------|---------|
| `Scheduler` | Generates due tasks from active responsibilities based on cadence (daily/weekly/monthly) |
| `HealthCalculator` | Computes health scores (0.0-1.0) from task completion rates |

Schema: `Responsibility` (role, cadence, health_score), `CheckIn`

#### Canvas (`lib/ema/canvas/`)
Supervised by `Canvas.Supervisor`.

- `DataRefresher` — Periodically refreshes canvas data sources
- Schemas: `Canvas`, `Element`, `DataSource`

### Web Layer (`lib/ema_web/`)

**Controllers** (one per domain): DashboardController, BrainDumpController, HabitsController, JournalController, SettingsController, WorkspaceController, ProjectController, TaskController, ProposalController, SeedController, EngineController, VaultController, PipeController, ResponsibilityController, AgentController, AgentChannelController, CanvasController, DataSourceController, SessionController, ContextController

**Channels** (real-time sync): dashboard, brain_dump, habits, journal, settings, workspace, project, task, proposal, pipes, responsibility, agent_lobby, agent_chat, vault, canvas, session

**Router** — All under `/api`. Key patterns:
- Standard CRUD: `resources "/tasks", TaskController`
- Custom actions: `post "/proposals/:id/approve"`, `post "/engine/pause"`
- Nested: `get "/projects/:id/tasks"`, `post "/agents/:agent_id/chat"`

---

## Frontend Structure (`app/src/`)

### Layout Components
- **`Shell.tsx`** — Main wrapper, initializes all 67+ stores on mount
- **`Launchpad.tsx`** — Home dashboard with app tile grid (4 columns), greeting, One Thing card
- **`Dock.tsx`** — Vertical app launcher bar (56px), green dots for running apps
- **`AmbientStrip.tsx`** — Custom titlebar (32px), clock, window controls
- **`AppWindowChrome.tsx`** — Window frame for per-app windows (titlebar, controls, accent color)

### App Components (52+ vApps)
Each app is a self-contained component in `components/<domain>/`:
BrainDumpApp, HabitsApp, JournalApp, SettingsApp, TasksApp, ProjectsApp, ProposalsApp, ResponsibilitiesApp, AgentsApp, VaultApp, CanvasApp, PipesApp, ChannelsApp

### Stores (`stores/`)
67+ Zustand stores, each following the pattern:
1. `loadViaRest()` — Fetch initial state from daemon REST API
2. `connect()` — Join Phoenix channel for real-time updates
3. Domain-specific actions (CRUD, transitions, etc.)
4. Error handling with try/catch on init

### Connectivity (`lib/`)
- **`api.ts`** — REST client using Tauri HTTP plugin, base URL `http://localhost:4488/api`
- **`ws.ts`** — Phoenix WebSocket singleton at `ws://localhost:4488/socket`
- **`window-manager.ts`** — Tauri WebviewWindow lifecycle (open/close/restore/save state)

### Types (`types/`)
TypeScript interfaces for each domain. `workspace.ts` contains `APP_CONFIGS` with default dimensions and accent colors for all apps.

### Styling
**`globals.css`** — Complete glass morphism design system:
- Glass levels: `.glass-ambient` (40%, 6px blur), `.glass-surface` (55%, 20px blur), `.glass-elevated` (65%, 28px blur)
- Colors: void #060610 → base #0A0C14 → surfaces #0E1017/#141721/#1A1D2A
- Text opacity: primary 0.87, secondary 0.60, tertiary 0.40, muted 0.25
- Fonts: system-ui (sans), JetBrains Mono (mono)

---

## AI Bridge Architecture (ACTIVE)

**Status:** Bridge is now active (`ai_backend: :bridge` in `config/config.exs`). `BridgeSupervisor` starts on app boot.

**Active features:** SmartRouter (multi-account rotation), QualityGate (response scoring), cost tracking (SQLite), governance audit logging, circuit breakers (soft/hard trip at 3/5 failures). Falls back gracefully to `Runner.run/2` if Bridge GenServer is unavailable.

**Original build files** were in `~/shared/inbox-host/vm--ema-bridge-files/`.

### Build Order

| Phase | Module | Purpose |
|-------|--------|---------|
| 0 | `config.ex` | Configuration schema + validation |
| 0 | `supervisor.ex` | OTP supervision tree (rest_for_one) |
| 0 | Migrations | providers, accounts, usage_records, audit_logs, routing_decisions tables |
| 1 | `provider_registry.ex` | Provider lifecycle: register, health check, capabilities, rate limits |
| 1 | `account_manager.ex` | Multi-account rotation with per-account rate limit tracking |
| 1 | Adapters | `claude_cli.ex`, `codex_cli.ex`, `ollama.ex`, `openclaw.ex`, `openrouter.ex` |
| 2 | `smart_router.ex` | 6 routing strategies: balanced, cheapest, fastest, best, round_robin, failover |
| 2 | `stream_parser.ex` | Normalize JSONL/SSE events across providers |
| 3 | `bridge.ex` | Main API: `run/2`, `stream/2`, `start_session/1`, backward compat with Runner |
| 3 | `circuit_breaker.ex` | Soft/hard trip (3/5 consecutive failures) |
| 3 | `cost_tracker.ex` | Token usage + cost recording to SQLite |
| 3 | `quality_gate.ex` | Output verification for proposals/code reviews |
| 3 | `governance.ex` | Audit logging for tool calls (Edit, Write, Bash, Agent) |
| 4 | `node_coordinator.ex` | Distributed Erlang via :pg groups, heartbeat, RPC failover |
| 4 | `sync_coordinator.ex` | CRDT-based state sync (DeltaCrdt.AWLWWMap) |
| 4 | `cluster_config.ex` | libcluster topologies: local EPMD, Tailscale, manual, DNS |
| 5 | Integration | Wire Bridge into ProposalEngine, Agents, Pipes |

### Provider Adapters
- **Claude CLI** — Spawns `claude` process with `--print --output-format stream-json`
- **Codex CLI** — OpenAI Codex via `codex exec --full-auto`, PTY wrapper
- **Ollama** — Local models via HTTP API with streaming
- **OpenClaw** — Gateway subprocess with stream-json output
- **OpenRouter** — HTTP with SSE streaming, dynamic model listing

### Routing Strategies
- **balanced** — Weighted score: 40% cost + 30% speed + 30% quality
- **cheapest** — Minimize cost per token
- **fastest** — Minimize latency
- **best** — Maximize quality score
- **round_robin** — Rotate across providers
- **failover** — Primary with ordered fallbacks

---

## Next Phase: Life OS Architecture

File: `~/shared/inbox-host/vm--ema-bridge-files/LIFE-OS-ARCHITECTURE.md`

Federated knowledge architecture with multi-context spaces and P2P sync.

### Core Concepts
- **Spaces** — Isolated contexts (Work, Personal, Health, Finance, Learning) with separate vaults, settings, AI context
- **Space-Qualified IDs** — `space:type:id` format for cross-space references
- **Shadow Notes** — Cross-space links that expose minimal metadata without leaking content
- **P2P Sync** — CRDT-based sync between EMA instances (laptop ↔ desktop ↔ phone) via Tailscale

### 12 Planned Modules
SpaceManager, SpaceRouter, NoteSync, ShadowNoteManager, CrossSpaceQuery, SpaceAwareAI, ConflictResolver, AccessControl, MigrationEngine, SpaceAnalytics, BackupManager, SpaceTemplates

---

## Database

SQLite at `~/.local/share/ema/ema.db` via `ecto_sqlite3`.

Key tables: brain_dump_items, habits, habit_logs, journal_entries, settings, workspace_windows, projects, tasks, task_comments, proposals, proposal_tags, seeds, vault_notes, vault_links, pipes, pipe_actions, pipe_transforms, pipe_runs, responsibilities, check_ins, agents, agent_channels, agent_conversations, agent_messages, agent_runs, canvases, canvas_elements, canvas_data_sources, claude_sessions, goals, focus_sessions, focus_blocks, notes, vault_entries, app_shortcuts, actors, tags, entity_data, phase_transitions, container_config, actor_commands, spaces, intents, intent_links, intent_events

---

## Current State & Known Issues

### Working
- All 52+ frontend apps build and render with glass aesthetic
- Daemon compiles with zero warnings
- REST API + WebSocket channels for all domains
- Proposal engine pipeline (Generator → Refiner → Debater → Tagger) wired via PubSub
- Claude CLI integration (runner.ex) with timeout handling
- Session watcher + monitor detecting Claude Code sessions
- Pipes system with 7 stock pipes and 22 triggers
- Second Brain vault watcher + graph builder + system brain state files
- Responsibility scheduler generating tasks from cadences
- Agent system with per-agent supervision, memory compression, and webchat bridge
- Actor/workspace system: 18 actors bootstrapped on startup (1 human + 17 agents), phase cadence, mutual visibility
- Actor-stamped tasks and executions with `actor_id` (defaults to human), REST `?actor_id=` filtering
- Agent ↔ Actor bridge: FK on agents table + slug convention fallback + bidirectional lookup functions
- Wiki intent schematic: 10+ intent pages in vault/wiki/Intents/ synced to DB via Populator
- IntentProjector: reverse sync DB intent changes → wiki pages (non-wiki-sourced intents auto-projected)
- Shared agent context: all agents get :intents (DB tree) + :wiki (intent pages) in every Claude call
- Phase transitions linked to intents: phase_transitions.intent_id FK tracks which intent a phase advance is for
- Canvas with data sources and element management
- Seed data: 4 projects, 4 proposal seeds, 4 responsibilities

### Stubs / Needs Work
- Discord and Telegram channel adapters (need nostrum/ex_gram deps)
- Claude transform in pipes (stub — returns payload unchanged)
- Harvesters (Git, Session, Vault, Usage, BrainDump) — designed but not implemented
- Focus timer — schema exists, no UI or GenServer
- Goals — schema exists, no UI or business logic
- Notes (simple) — schema exists, overlaps with SecondBrain
- Multi-backend AI bridge — designed, files written, not integrated
- Life OS / P2P sync — designed, not started
- Agent tool execution — only `brain_dump:create_item` implemented
- Global shortcuts (Super+Shift+C, Super+Shift+Space) — not wired

### Tech Debt
- `VaultIndex` and `Notes` modules overlap with `SecondBrain` — consolidation needed
- Some channel controllers may not broadcast all mutations
- No E2E tests yet
- Combiner hourly scan not tested with real proposal clusters

---

## Git Conventions

Conventional commits: `feat|fix|refactor|docs|test|chore: description`

Recent history (newest first):
```
d8052cb fix: add new app windows to Tauri capabilities
9e44c7d docs: add implementation logs from parallel agent build
ec6c73b fix: frontend component cleanup — types, imports, empty states
513190e feat: seed projects, proposals, responsibilities + import script
cb06bc2 feat: wire proposal pipeline to PubSub events + enhance SystemBrain
b790a64 feat: add Channels app — Discord-like UI with glass aesthetic
```

---

## Key File Paths

| What | Path |
|------|------|
| Daemon entry | `daemon/lib/ema/application.ex` |
| Router | `daemon/lib/ema_web/router.ex` |
| Claude Runner | `daemon/lib/ema/claude/runner.ex` |
| Frontend entry | `app/src/main.tsx` → `App.tsx` |
| Glass CSS | `app/src/globals.css` |
| App configs | `app/src/types/workspace.ts` (APP_CONFIGS) |
| Window manager | `app/src/lib/window-manager.ts` |
| Design specs | `docs/superpowers/specs/` |
| Implementation plans | `docs/superpowers/plans/` |
| Bridge files (next phase) | `~/shared/inbox-host/vm--ema-bridge-files/` |
| Vault data | `~/.local/share/ema/vault/` |
| DB file | `~/.local/share/ema/ema.db` |
| Session import script | `scripts/import-claude-sessions.exs` |
| Seeds | `daemon/priv/repo/seeds.exs` |
