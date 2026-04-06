# EMA — Full System Context

## Generated: 2026-04-05 (updated with agent audit findings)
## Last verified: 2026-04-06 (live system audit via SSH + MCP + CLI)

### Audit Addendum (2026-04-06)

**Critical findings from live system verification:**

1. **Dispatch engine failure cascade** — `utility` agent stuck in infinite loop generating "analyze N failed tasks" tasks that themselves fail. dispatch-engine.sh Python subprocess at 166% CPU on `index.json`. 54 of 84 tasks are cancelled.

2. **Agent roster reality** — 21 agents in dispatch.db but only 5 have ever run anything: coder (1 success), researcher (1 success), vault-keeper (1 success), ops (1 failure), utility (1 failure). 16 agents have zero history.

3. **OpenClaw still alive** — Gateway serving HTML on agent-vm:18789 despite being archived.

4. **EMA vault path empty on agent-vm** — `~/.local/share/ema/vault/` has 0 files. Wiki pages written to HOST path only. Agent-vm vault is at `~/vault/` (3,036 files).

5. **QMD index stale** — Last updated Mar 13 (23 days ago). Obsidian changes since then invisible to semantic search.

6. **Cron count corrected** — v5 config has 18 crons (not 37). Consolidated from earlier versions.

7. **Zero goals, zero tasks** in EMA API despite 26 executions of real work. All tracking via executions only.

8. **Focus endpoint broken** — MCP calls `GET /api/focus` but no Phoenix route exists.

9. **Local daemon running on host** — localhost:4488 responds (in addition to agent-vm:4488). Two daemons may be running.

10. **MCP server bug** — `ema_brain_dump` tool hardcodes `source: "agent"` which daemon rejects. Fixed in `~/bin/ema-mcp-server.js`.

**Wiki reference:** 26 pages at `~/.local/share/ema/vault/wiki/` (host) covering architecture, agents, apps, tools, operations. Updated 2026-04-06 with audit corrections.

---

## 1. System Overview

EMA (Engineering Memory & Agency) is a personal operating system for a solo developer (Trajan). It orchestrates AI agent sessions, tracks workflow intent, manages a knowledge vault, and provides observability into all running processes. It spans two machines (host desktop + agent-vm), multiple runtimes (Elixir, Python, Node.js, shell scripts), and multiple surfaces (CLI, web UI planned, Discord, dispatch engine).

### How the pieces connect

```
┌──────────────────────────────────────────────────────────────────┐
│  HOST (FerrissesWheel — Linux desktop)                           │
│  ├─ Claude Code sessions (interactive)                           │
│  ├─ Obsidian vault (~/Documents/obsidian_first_stuff/twj1/)      │
│  ├─ QMD semantic search (indexes vault)                          │
│  └─ SSH bridge to agent-vm                                       │
└──────────────────────┬───────────────────────────────────────────┘
                       │ SSH / HTTP
┌──────────────────────▼───────────────────────────────────────────┐
│  AGENT-VM (192.168.122.10 — libvirt KVM)                         │
│  ├─ EMA Daemon (Elixir/Phoenix, port 4488)                       │
│  │   ├─ REST API (28 endpoints + Anthropic proxy)                │
│  │   ├─ WebSocket (babysitter:* channel)                         │
│  │   ├─ Surfaces: Claude CLI, Codex CLI, Gateway, Peers, Ollama  │
│  │   ├─ SecondBrain FTS5 vault indexer                           │
│  │   ├─ Babysitter adaptive cadence system                       │
│  │   ├─ Stream-of-consciousness Discord poster                   │
│  │   └─ Config control plane                                     │
│  ├─ EMA CLI (Python, test harness with mock API)                 │
│  ├─ Dispatch Engine (bash, cron-driven every 1min)               │
│  ├─ Wiki Engine (Node.js, SQLite FTS5, port 4488/8091)           │
│  ├─ ClaudeForge (Discord bot + Next.js web UI, not yet running)  │
│  ├─ MCP Server (Python, port 8899)                               │
│  ├─ EMA Observer (Next.js frontend, port 3200)                   │
│  ├─ Discord webhooks (20+ channels across 2 guilds)              │
│  └─ ~160 shell scripts in ~/bin/                                 │
└──────────────────────────────────────────────────────────────────┘
```

### Critical distinction: Implemented vs Planned

The EMA docs describe a rich system with proposals, intents, tasks, sessions, quality gates, and a full proposal pipeline. **Most of this is planned, not built.** The actual implemented surface is:

| Layer | Implemented | Planned (in docs, not in code) |
|-------|-------------|-------------------------------|
| REST API | Babysitter, sessions/monitor, Claude run/preflight/providers, Surfaces (sessions, dispatch, peers, gateway, discovery), Vault search/tree/stats/reindex, Anthropic proxy | Intent CRUD, Gaps, Proposals, Tasks, Projects, Token usage, Seeds, Engine, Superman, Routing |
| WebSocket | `babysitter:*` only | `tasks:*`, `projects:*`, `agents:lobby`, `intent:live`, `gaps:live`, execution streaming |
| Database | `second_brain_fts.db` (FTS5 only) | Full Ecto schema with 15+ tables (intent_nodes, proposals, tasks, ai_sessions, etc.) |
| Proposal Engine | Not implemented | 8-stage pipeline (Scheduler→Generator→Refiner→Debater→Scorer→Tagger→Combiner→KillMemory) |
| CLI | Mock-only test harness (46 endpoints against in-memory store) | Real CLI hitting daemon API |

---

## 2. Daemon (Elixir/Phoenix)

### 2.1 Application Startup

**File:** `daemon/lib/ema/application.ex`

OTP supervision tree (strategy: `:one_for_one`):

```
Ema.Supervisor
├── Ema.Config.Supervisor          — Config control plane (registry, scanner, collision detector)
├── Ema.Repo                       — Ecto repo (SQLite, but no migrations/tables exist)
├── {Phoenix.PubSub, Ema.PubSub}  — Internal event bus
├── {Task.Supervisor, Ema.Claude.TaskSupervisor}  — Async bridge dispatch
├── Ema.Claude.ProviderRegistry    — AI provider management
├── Ema.Sessions.Supervisor        — Session supervision tree
├── Ema.Sessions.Monitor           — Shadow session monitor
├── Ema.Babysitter.StreamTicker    — Adaptive cadence manager
├── Ema.Babysitter.TakeoverManager — Takeover state machine
├── Ema.Stream.Manager             — Stream-of-consciousness layer
├── Ema.Stream.Babysitter          — Stream babysitter
├── Ema.Surfaces.Supervisor        — Execution surfaces (see below)
├── Ema.SecondBrain.Indexer        — FTS5 vault indexer
└── EmaWeb.Endpoint                — Phoenix HTTP/WS endpoint (port 4488)
```

**Surfaces Supervisor** (strategy: `:rest_for_one`):
```
Ema.Surfaces.Supervisor
├── {Registry, Ema.Surfaces.Registry}     — Named session lookups
├── {DynamicSupervisor, SessionSupervisor} — On-demand Claude/Codex sessions
├── Ema.Surfaces.GatewayClient            — WebSocket to gateway
├── Ema.Surfaces.PeerRegistry             — Peer tracking
├── Ema.Surfaces.SessionPool              — Warm session pool
└── Ema.Surfaces.Discovery                — Boot-time surface enumeration
```

### 2.2 Domain Map

**Surfaces** (`daemon/lib/ema/surfaces/`) — The execution layer. Manages Claude CLI sessions, Codex sessions, gateway connections, peer discovery. This is the most mature subsystem.
- `ClaudeSession` — GenServer wrapping a `claude` CLI process via Erlang Port. Supports multi-turn conversations with `--session-id`, JSON output parsing, token tracking.
- `CodexSession` — Same pattern for OpenAI Codex CLI.
- `GatewayClient` — WebSocket client connecting to the (now-removed) OpenClaw gateway. Still has OpenClaw references.
- `PeerRegistry` — Tracks connected peers for mesh dispatch.
- `Discovery` — On-startup enumeration of all available AI surfaces (Claude CLI, Codex, Ollama, gateway). Still references OpenClaw.
- `SessionPool` — Pre-spawns sessions for fast proxy responses.

**Babysitter** (`daemon/lib/ema/babysitter/`) — Adaptive observability cadence system. The most polished subsystem.
- `StreamTicker` — GenServer managing per-stream cadence with semantic lanes, activity scoring, token pressure, promotion/suppression logic.
- `TakeoverManager` — State machine for operator takeover of stream cadence.
- `ChannelPolicy` — Emission tier decisions (hot/medium/quiet).
- `StreamChannels` — Defines semantic lanes and their metadata.

**Stream** (`daemon/lib/ema/stream/`) — Discord stream-of-consciousness posting.
- `Manager` — Cadence-controlled posting to 7 Discord channels (#system-heartbeat, #pipeline-flow, #agent-thoughts, #intent-stream, #memory-writes, #intelligence-layer, #babysitter-digest).
- `Babysitter` — Stream babysitter integration.
- `ChannelManager` — Channel lifecycle management.

**SecondBrain** (`daemon/lib/ema/second_brain/`) — Vault knowledge layer.
- `Indexer` — FTS5-backed full-text search over vault markdown files. Uses raw Exqlite (not Ecto) because FTS5 virtual tables can't be managed via migrations. Supports search, index, remove, stats.

**Config** (`daemon/lib/ema/config/`) — Runtime configuration control plane.
- `Supervisor`, `Registry`, `Scanner`, `EffectiveConfig`, `CollisionDetector`, `Snapshot`, `Resource` — Manages dynamic configuration with collision detection and snapshots.

**Claude** (`daemon/lib/ema/claude/`) — AI provider management.
- `ProviderRegistry` — GenServer tracking AI providers, dispatching bridge calls, broadcasting results.
- `Runner` — Legacy runner (direct CLI spawn).
- `Shell`, `SystemShell` — Shell execution abstraction.
- `TaskSupervisor` — Task.Supervisor for async dispatch.

**Sessions** (`daemon/lib/ema/sessions/`) — Session monitoring.
- `Supervisor` — Sessions supervision tree.
- `Monitor` — Lightweight in-memory session activity tracking. Shadow comparison mode.

**Campaigns** (`daemon/lib/ema/campaigns/`) — Workflow topology.
- `Flow` — Campaign flow struct for agent coordination topology. Single file, minimal implementation.

**Feedback** (`daemon/lib/ema/feedback/`) — Event broadcasting.
- `Broadcast` — Emits events to Stream.Manager for Discord posting.

**Context** (`daemon/lib/ema/context/`) — Context injection.
- `Injector` — Context assembly for AI prompts.
- `Supervisor` — Context supervision.

**Auth** (`daemon/lib/ema/auth/`) — Empty directory. Auth not yet implemented.

**Provider** (`daemon/lib/ema/provider/`) — Empty directory. Provider abstraction not yet built.

**Subprocess** (`daemon/lib/ema/subprocess/`) — Empty directory. Subprocess management not yet built.

### 2.3 REST API Surface (Complete Endpoint List)

**Babysitter (8 endpoints):**

| Method | Path | Controller Action | Description |
|--------|------|------------------|-------------|
| GET | `/api/babysitter` | `BabysitterController.index` | List all streams with cadence state |
| GET | `/api/babysitter/:stream` | `.show` | Single stream snapshot (lane, cadence, emission policy) |
| PUT | `/api/babysitter/:stream` | `.update` | Update stream config (override cadence) |
| POST | `/api/babysitter/:stream/activity` | `.activity` | Ingest activity event, return updated state |
| POST | `/api/babysitter/:stream/tick` | `.tick` | Force a tick on the stream |
| GET | `/api/babysitter/:stream/takeover` | `.takeover_status` | Takeover state machine status |
| POST | `/api/babysitter/:stream/takeover/activate` | `.takeover_activate` | Activate operator takeover |
| POST | `/api/babysitter/:stream/takeover/release` | `.takeover_release` | Release operator takeover |

**Session Monitor (2 endpoints):**

| Method | Path | Controller Action | Description |
|--------|------|------------------|-------------|
| GET | `/api/sessions/monitor` | `SessionMonitorController.index` | Recent session activity snapshot |
| POST | `/api/sessions/monitor/activity` | `.activity` | Record activity event |

**Claude (3 endpoints):**

| Method | Path | Controller Action | Description |
|--------|------|------------------|-------------|
| GET | `/api/claude/providers` | `ClaudeController.providers` | List registered AI providers |
| POST | `/api/claude/preflight` | `.preflight` | Pre-flight check before AI call |
| POST | `/api/claude/run` | `.run` | Execute an AI prompt through provider registry |

**Surfaces (11 endpoints):**

| Method | Path | Controller Action | Description |
|--------|------|------------------|-------------|
| GET | `/api/surfaces` | `SurfacesController.index` | All discovered surfaces + active sessions |
| POST | `/api/surfaces/discover` | `.discover` | Re-run surface discovery |
| GET | `/api/surfaces/gateway` | `.gateway` | Gateway connection status |
| GET | `/api/surfaces/peers` | `.peers` | List connected peers + self capabilities |
| POST | `/api/surfaces/peers/:peer_id/dispatch` | `.dispatch_to_peer` | Dispatch task to specific peer |
| POST | `/api/surfaces/sessions/claude` | `.create_claude_session` | Start new Claude CLI session |
| POST | `/api/surfaces/sessions/codex` | `.create_codex_session` | Start new Codex CLI session |
| GET | `/api/surfaces/sessions/:id` | `.session_status` | Session status (checks both Claude and Codex) |
| POST | `/api/surfaces/sessions/:id/prompt` | `.send_prompt` | Send prompt to session (sync or async) |
| POST | `/api/surfaces/dispatch` | `.dispatch` | Native gateway dispatch |
| POST | `/api/surfaces/message` | `.send_gateway_message` | Send message via gateway |

**Vault (4 endpoints):**

| Method | Path | Controller Action | Description |
|--------|------|------------------|-------------|
| GET | `/api/vault/search` | `VaultController.search` | FTS5 full-text search. Params: `q`, `space`, `limit` |
| GET | `/api/vault/tree` | `.tree` | Directory listing of vault. Params: `space` |
| GET | `/api/vault/stats` | `.stats` | Index health: document count, db path |
| POST | `/api/vault/index` | `.reindex` | Trigger background re-index of vault |

**Anthropic Proxy (1 endpoint):**

| Method | Path | Controller Action | Description |
|--------|------|------------------|-------------|
| POST | `/v1/messages` | `AnthropicProxyController.create_message` | Anthropic API-compatible proxy. Routes through EMA Surfaces (CLI-backed). |

**Total: 29 implemented REST endpoints.**

### 2.4 WebSocket Channels

**Only one channel is implemented:**

| Topic Pattern | Module | Description |
|--------------|--------|-------------|
| `babysitter:*` | `EmaWeb.BabysitterChannel` | Subscribes to `Ema.PubSub` on the stream topic. Pushes `stream_updated` events with full cadence/emission state. Join returns initial snapshot. |

**File:** `daemon/lib/ema_web/channels/babysitter_channel.ex`
**Socket:** `daemon/lib/ema_web/user_socket.ex` — mounts at `/socket`

### 2.5 PubSub Topics (Internal Event Bus)

| Topic | Publisher | Event Shape | Purpose |
|-------|-----------|-------------|---------|
| `surfaces:discovery` | `Discovery` | `{:discovery_complete, surfaces_map}` | Boot-time surface enumeration complete |
| `surfaces:gateway` | `GatewayClient` | `{:gateway_connected}`, `{:gateway_disconnected}`, `{:gateway_authenticated}`, `{:peers_updated, peers}` | Gateway WebSocket lifecycle |
| `surfaces:dispatch` | `GatewayClient` | `{:dispatch_event, event}` | Task dispatch events from gateway |
| `surfaces:agents` | `GatewayClient` | `{:agent_event, event}` | Agent lifecycle events from gateway |
| `surfaces:messages` | `GatewayClient` | `{:message_received, event}` | Incoming messages from gateway |
| `surfaces:gateway:raw` | `GatewayClient` | `{:gateway_event, type, msg}` | Raw gateway frames (debug) |
| `surfaces:claude:<id>` | `ClaudeSession` | `{:claude_complete, id, result, elapsed_ms}` | Claude session completion |
| `surfaces:codex:<id>` | `CodexSession` | `{:codex_complete, id, result}` | Codex session completion |
| `babysitter:<stream>` | `StreamTicker` | `{:babysitter_stream_updated, rendered}` | Per-stream cadence updates |
| `babysitter:all` | `StreamTicker` | `{:babysitter_stream_updated, rendered}` | All stream updates (fan-out) |
| `bridge:results` | `ProviderRegistry` | `{:bridge_result, ref, result}` | AI provider call results |

**Subscribers:**
- `PeerRegistry` subscribes to `surfaces:gateway`
- `BabysitterChannel` subscribes to `babysitter:<stream>` on join

### 2.6 GenServers and Supervisors

| Module | Type | Purpose | State |
|--------|------|---------|-------|
| `Ema.Config.Supervisor` | Supervisor | Config control plane | Children: Registry, Scanner |
| `Ema.Config.Registry` | GenServer | Dynamic config store | Map of config keys → values |
| `Ema.Claude.ProviderRegistry` | GenServer | AI provider management | Provider list, dispatch refs |
| `Ema.Sessions.Supervisor` | Supervisor | Session tree | Children: Monitor |
| `Ema.Sessions.Monitor` | GenServer | Session activity tracking | Recent events ring buffer |
| `Ema.Babysitter.StreamTicker` | GenServer | Adaptive cadence | Per-stream state: activity, timers, config |
| `Ema.Babysitter.TakeoverManager` | GenServer | Operator takeover FSM | Takeover state per stream |
| `Ema.Stream.Manager` | GenServer | Discord stream posting | Tick counters, incidents, transitions, intents, thoughts |
| `Ema.Stream.Babysitter` | GenServer | Stream babysitter | Babysitter state |
| `Ema.Surfaces.Supervisor` | Supervisor (rest_for_one) | Surfaces tree | 6 children |
| `Ema.Surfaces.SessionSupervisor` | DynamicSupervisor | On-demand sessions | Active Claude/Codex session PIDs |
| `Ema.Surfaces.GatewayClient` | GenServer | Gateway WebSocket | Connection state, auth, peer list |
| `Ema.Surfaces.PeerRegistry` | GenServer | Peer tracking | Known peers, capabilities |
| `Ema.Surfaces.SessionPool` | GenServer | Warm session pool | Pre-spawned session PIDs |
| `Ema.Surfaces.Discovery` | GenServer | Surface enumeration | Discovered surfaces map |
| `Ema.Surfaces.ClaudeSession` | GenServer (dynamic) | Per-session Claude CLI wrapper | Port handle, buffer, token usage, turn count |
| `Ema.Surfaces.CodexSession` | GenServer (dynamic) | Per-session Codex CLI wrapper | Port handle, buffer |
| `Ema.SecondBrain.Indexer` | GenServer | FTS5 vault indexer | Exqlite connection, vault path |
| `Ema.Context.Supervisor` | Supervisor | Context injection | Children: Injector |

### 2.7 Database Schema

**Main DB (`priv/ema_dev.db`):** Exists but has **no tables**. Ecto Repo is started but no migrations have been run. The data model described in `docs/DATA_MODELS.md` (intent_nodes, proposals, tasks, ai_sessions, gaps, token_events, etc.) is **planned for the Ecto layer but not implemented there**.

**Dispatch DB (`~/dispatch/dispatch.db`):** The **real operational state store** — 1.3 MB SQLite database with 14 tables and 84 tasks. This is managed by shell scripts (`dispatch-db.sh`), not by Ecto. See Section 7.3 for full schema.

**Second Brain FTS DB (`priv/second_brain_fts.db`):** Working FTS5 database managed by `Ema.SecondBrain.Indexer` using raw Exqlite (not Ecto).

```sql
CREATE VIRTUAL TABLE vault_fts USING fts5(
  path UNINDEXED,      -- relative path within vault
  title,               -- note title (H1 or frontmatter or filename)
  body,                -- cleaned markdown text (code blocks stripped)
  tags UNINDEXED,      -- space-separated tags from frontmatter
  tokenize = 'porter ascii'
);
```

**Wiki DB (`wiki-engine/wiki.db`):** 15MB SQLite with 5 core tables + FTS triggers: `wiki_spaces`, `wiki_projects`, `wiki_pages`, `wiki_edges`, `wiki_page_versions`, `wiki_pages_fts`.

### 2.8 Feature Flags

| Flag | Location | Default | Purpose |
|------|----------|---------|---------|
| `session_mode` | `config.exs` / `EMA_SESSION_MODE` env | `:shadow` | Session routing: `:shadow` \| `:canary` \| `:primary` \| `:ema_only` |
| `shadow_quality_threshold` | `config.exs` | `0.90` | Quality threshold for shadow comparison |

### 2.9 Configuration

**Compile-time** (`config/config.exs`):
- `Ema.Repo` — SQLite at `priv/ema_dev.db`, pool_size: 5
- `EmaWeb.Endpoint` — Bandit adapter, port 4488, PubSub server
- `vault_path` — `~/vault` (configurable)
- `session_mode` — `:shadow` default
- `claude_shell` — `Ema.Claude.SystemShell`
- `claude_providers` — List of provider configs (claude-cli priority 100, codex-cli priority 90)

**Runtime** (`config/runtime.exs`):
- `ANTHROPIC_API_KEY` — For direct API adapter
- `OPENCLAW_GATEWAY_URL` — **Still references OpenClaw** (default: `http://localhost:18789`). Needs cleanup.
- `EMA_SESSION_MODE` — Override session mode
- `PORT` — HTTP port in prod (default: 4488)
- `SECRET_KEY_BASE` — Required in prod

**Dependencies** (`mix.exs`):
Phoenix 1.7, Ecto + ecto_sqlite3, Bandit, Jason, Req, UUID, Fuse (circuit breaker), Cachex (caching), Quantum (cron), Telemetry, Swoosh (email), Finch, Gun + Cowlib (WebSocket client).

---

## 3. CLI (Current State)

### 3.1 Architecture

**Location:** `cli/` — Pure Python, zero external dependencies (stdlib only).

The CLI has a **dual-layer architecture**:

1. **New HTTP-backed commands** (`main.py` entry point) — talk to the real EMA daemon at `localhost:4488` via `client.py` (stdlib `urllib.request`). These are the production-path commands.
2. **Legacy mock harness** (`cli.py` entry point) — operate entirely against a local JSON file store (`~/.ema_cli_state.json`). These simulate daemon behavior for offline development and testing.

The `ema` script imports `main.py`, which dispatches to HTTP commands first. If the command matches a legacy keyword (`mock`, `shell`, `seed`, `scenario`, etc.), it falls through to the old `cli.py` dispatcher.

**Files:**
- `cli/ema` — Entry point (executable Python script)
- `cli/ema_cli/cli.py` — All commands, dispatch, scenarios, REPL shell
- `cli/ema_cli/store.py` — JSON-backed persistent state store
- `cli/ema_cli/fixtures.py` — Realistic data generators for 18 schemas
- `cli/ema_cli/mock_api.py` — Mock handlers for 46 endpoints
- `cli/ema_cli/output.py` — Formatters: JSON, table, tree, summary (ANSI)
- `cli/ema_cli/commands/seed_data.py` — Bulk seeding
- `cli/tests/test_all.py` — 118 tests

### 3.2 Command Coverage

| Group | Commands |
|-------|----------|
| `proposal` | `create`, `list`, `<id>`, `<id> genealogy`, `<id> approve`, `<id> kill`, `<id> redirect`, `<id> validate` |
| `task` | `create`, `list`, `<id>`, `<id> route`, `<id> assign` |
| `intent` | `create`, `list`, `tree`, `<id> link-task`, `edges create` |
| `gaps` | `list`, `<id> resolve`, `<id> create-task` |
| `token-usage` | Usage summary with bar charts |
| `projects` | `list`, `<id> health` |
| `session` | `list`, `<id> messages`, `<id> fork`, `<id> resume` |
| `providers` | `list`, `<id> health-check` |
| `routing` | `estimate` |
| `seeds` | `list`, `create` |
| `engine` | `pause`, `resume` |
| `superman` | `status`, `index`, `ask`, `gaps`, `intent-graph` |
| `openclaw` | `dispatch`, `dispatch-status` |
| `scenario` | `full-proposal-lifecycle`, `intent-mapping`, `session-continuity`, `token-spike`, `provider-failover` |
| Utility | `seed`, `reset`, `shell` |

**Output formats:** `--format=json` (default), `--format=table`, `--format=tree`, `--format=summary`

### 3.3 Gap Analysis

The CLI has both HTTP-backed commands (that DO hit the daemon) and mock-only commands:

**Commands that hit the real daemon (via `main.py` + `client.py`):**

| CLI Command | Daemon Endpoint | Status |
|-------------|----------------|--------|
| `ema status` | `GET /api/status` | Working |
| `ema metrics` | Multiple endpoints | Working |
| `ema task list/create/show/update` | `GET/POST/PUT /api/tasks` | Working |
| `ema agent ps/list/show` | `GET /api/executions` | Working |
| `ema project list/show` | `GET /api/projects` | Working |
| `ema proposal list/show` | `GET /api/proposals` | Working (read-only) |

**Commands that are mock-only (via `cli.py`):**

| CLI Command | Status |
|-------------|--------|
| `proposal approve/kill/redirect/validate/genealogy` | Mock only — daemon has no proposal lifecycle endpoints |
| `intent *`, `gaps *`, `token-usage`, `seeds *`, `engine *` | Mock only — no daemon endpoints |
| `session fork/resume/messages` | Mock only |
| `superman *` | Mock only (Superman is external) |
| `openclaw *` | Dead code (OpenClaw removed) |
| `desk *` | Mock only (human-in-the-loop decision desk) |
| `routing estimate` | Mock only |

### 3.4 Tech Debt and Limitations

1. **Duplicated arg parser** — `cli.py` and `cli_args.py` both define `Args` + `parse_args()` with slightly different implementations.
2. **`openclaw` command group** — References removed system. Should be deleted or replaced.
3. **Execution ID prefix bug** — `gen_id("exe")` falls back to `obj_` prefix because `exe` not in `_PREFIXES` map.
4. **No schema validation** — Store accepts any dict. Fixture generators are the only schema truth.
5. **Single-file store is a concurrency hazard** — Multiple CLI invocations writing `~/.ema_cli_state.json` simultaneously will corrupt it.
6. **Mock API far richer than HTTP layer** — Mock has full proposal lifecycle (approve, kill, redirect, validate, input gating, genealogy) while HTTP only has read-only list/show.
7. **Large mock_api.py** — 500+ lines covering all domains in a single file.

---

## 4. Frontend (Tauri + React)

### 4.1 Current State: Two Separate Frontends Exist

The `ARCHITECTURE.md` describes a Tauri 2 shell with React 19 frontend. **No Tauri shell exists**, but two web frontends are running:

### 4.2 EMA Observer (`~/projects/frontend-layer/`)

**Running on port 3200** via systemd (`ema-observer.service`). This is a real Next.js 16.1.7 app with:
- **React 19.2.3** + **Zustand** (state management)
- **Recharts** (data visualization / charts)
- **Lucide** icons
- **Tailwind 4** + class-variance-authority
- Active, running in production on agent-vm

This appears to be the monitoring dashboard for EMA — the closest thing to the planned "observatory" described in ARCHITECTURE.md. (Agent audit confirmed it's running, but did not read its source files in detail.)

### 4.3 ClaudeForge (`~/Projects/ema/claudeforge/`)

A separate project for remote Claude Code session management. **Does NOT call EMA daemon endpoints** — has its own Express server on port 3001, its own SQLite DB.

**Screens (4 pages):**
- `/` — Sessions page with ChatView (active Claude Code session, message history, streaming, tool call cards)
- `/tasks` — Kanban board (Backlog, In Progress, Review, Done)
- `/agents` — Agent cards (Claude Code, Codex) with status/session count
- `/system` — System dashboard (CPU/Memory/Disk bars, uptime, errors)

**Zustand Stores (2):**
- `useSessionStore` — projects, sessions, activeSessionId, messages (Map), streamingText (Map)
- `useSystemStore` — health (SystemHealth | null), tasks (TaskRecord[]), errors (capped at 100)

**WebSocket:** Connects to `ws://localhost:3001/ws`, handles 11 event types: session.created/updated/closed/output, message.created, project.created/updated, task.created/updated, system.health/error

**REST API (16 endpoints on own Express server):** getProjects, openProject, closeProject, getSessions, getActiveSessions, getSession, sendMessage, stopSession, resumeSession, getMessages, getTasks, createTask, updateTask, getHealth, getStatus, getEvents

### 4.3 Design System (from ClaudeForge, intended for EMA)

- Background: `#0F0F14` (Void)
- Surface: `#1A1A2E` (cards, panels)
- Primary: `#7B61FF` (Iris Purple)
- Text: `#E8E8F0` (Frost)
- Font: Inter (variable) + JetBrains Mono (code)
- Icons: Lucide React only, strokeWidth 1.5
- Status: Green `#4ADE80` / Amber `#FCD34D` / Rose `#FB7185` / Blue `#38BDF8`

---

## 5. Agent Infrastructure

### 5.1 Agent Lifecycle

There is no formal agent lifecycle management in the daemon. The ARCHITECTURE.md describes `Ema.Agents.Supervisor` with `AgentWorker`, `AgentMemory`, and `ChannelSupervisor`, but **none of this exists in code**.

What exists instead:
- **Surfaces layer** — Can spawn Claude/Codex sessions on demand
- **Dispatch engine** — Shell-based cron system that spawns Claude Code processes
- **Stream manager** — Posts agent activity to Discord

### 5.2 Execution Pipeline (Actual)

```
Dispatch queue (~/dispatch/queue/*.json)
  → dispatch-engine.sh (runs every 1min via cron)
    → Acquires flock
    → Moves task to active/
    → Spawns `claude` CLI process with task context
    → Captures output to results/
    → Moves to done/ or failed/
    → Posts status to Discord webhook
```

The daemon can also spawn sessions via:
```
POST /api/surfaces/sessions/claude  → creates ClaudeSession GenServer
POST /api/surfaces/sessions/:id/prompt  → sends prompt to session
```

### 5.3 OpenClaw Integration (Post-Migration)

OpenClaw has been removed from the system as of 2026-04-06. However, **residual references remain in daemon code**:

- `daemon/config/runtime.exs` — `openclaw_gateway_url` config key
- `daemon/lib/ema/surfaces/discovery.ex` — `discover_openclaw()`, `list_openclaw_agents()`, `check_openclaw_gateway()` functions
- `daemon/lib/ema/surfaces/gateway_client.ex` — WebSocket client that was connecting to OpenClaw gateway
- `daemon/lib/ema/surfaces/supervisor.ex` — Comment: "GatewayClient (WebSocket to OpenClaw)"
- `docs/INTEGRATION_GUIDE.md` — References "EMA dispatch" (sed-replaced from "OpenClaw")
- `cli/ema_cli/cli.py` — `openclaw` command group still exists

These should be cleaned up or repurposed for EMA-native dispatch.

### 5.4 Claude Session Management

**`Ema.Surfaces.ClaudeSession`** (`daemon/lib/ema/surfaces/claude_session.ex`) — The real implementation:

- Wraps `claude` CLI via Erlang Port with `--session-id` for continuity
- Supports: `send_prompt` (sync), `send_prompt_async`, `status`, `resume`, `stop_session`
- Uses `--output-format json` and `--permission-mode bypassPermissions`
- Tracks: turn count, token usage (input/output), session ID, model
- Broadcasts completion on PubSub `surfaces:claude:<id>`
- Timeout handling with Process timers
- Max turns configurable (default: 10)

### 5.5 Babysitter System

The babysitter is the most mature subsystem. It provides adaptive observability:

**StreamTicker** — Manages per-stream cadence with:
- Semantic lanes (what kind of stream: operator_rollup, operations, attention, etc.)
- Cadence buckets (realtime, rapid, steady, default)
- Emission tiers (hot/medium/quiet) chosen dynamically by ChannelPolicy
- Activity scoring from weighted recent samples
- Token pressure awareness
- Idle detection and quieting
- Manual override via PUT endpoint

**TakeoverManager** — Operator can take control of stream cadence, overriding automatic decisions.

**8 REST endpoints + 1 WebSocket channel** — Most complete API surface in the daemon.

---

## 6. Knowledge Layer

### 6.1 Storage Systems

There are **multiple overlapping knowledge stores**:

| Store | Location | Engine | Access | Status |
|-------|----------|--------|--------|--------|
| Host Obsidian vault | `~/Documents/obsidian_first_stuff/twj1/` (host) | Markdown files | Obsidian app, QMD, filesystem MCP | Active, primary |
| Agent-VM vault | `~/vault/` (agent-vm) | Markdown files | EMA daemon FTS5, QMD, scripts | Active, agent-vm primary |
| EMA vault | `~/.local/share/ema/vault/` (agent-vm) | Planned | EMA SecondBrain (planned) | **Not populated** |
| Wiki Engine | `~/Projects/ema/wiki-engine/wiki.db` | SQLite FTS5 | REST API port 4488/8091 | Built but unclear if running |
| Second Brain FTS | `daemon/priv/second_brain_fts.db` | SQLite FTS5 | EMA daemon API | Active, indexes ~/vault/ |

**Key overlap:** The daemon's `SecondBrain.Indexer` indexes `~/vault/` (configurable). The wiki-engine also indexes vault content into its own SQLite DB. QMD on the host provides semantic search over the same content.

### 6.2 Superman Intelligence

**Not part of EMA codebase.** Superman is an external code intelligence server expected at `localhost:3000`. EMA docs describe integration via `Ema.Intelligence.SupermanClient`, but this module doesn't exist in the current daemon code.

Planned capabilities: codebase indexing, semantic search, code modification, flow diagrams, intent graph extraction.

### 6.3 Intent System

**Planned, not implemented.** The intent system (5-level hierarchy from Product → Implementation) is fully specced in DATA_MODELS.md and API_CONTRACTS.md but no database tables, Ecto schemas, or API endpoints exist.

### 6.4 Search Infrastructure

| Engine | Type | Status | Access |
|--------|------|--------|--------|
| EMA FTS5 | Full-text (BM25, porter stemming) | Working | `GET /api/vault/search?q=...` |
| QMD | BM25 + vector + HyDE | Working | MCP server, CLI |
| Wiki Engine FTS5 | Full-text | Built | REST API (if running) |

---

## 7. Infrastructure

### 7.1 Machine Topology

| Machine | Role | Access | IP |
|---------|------|--------|-----|
| FerrissesWheel (host) | Desktop, Obsidian, Claude Code interactive | Physical | N/A |
| agent-vm | EMA daemon, dispatch, agents, all automation | SSH `agent-vm` | 192.168.122.10 |

### 7.2 Deployment Model

**Daemon:** Running as `mix phx.server` in dev mode (PID 210430, Elixir 1.17.3/OTP 27). Listens on localhost:4488 only. Not a systemd service — likely started manually or via tmux.

**Running services on agent-vm:**
- `mcp-server.service` — Python MCP server on port 8899 (`/home/trajan/mcp-server/server.py --http 8899`)
- `ema-observer.service` — Next.js frontend on port 3200 (`/home/trajan/projects/frontend-layer/`)
- `oauth-guardian.timer` — Hourly OAuth refresh

**Cron jobs:** 37 crons running via crontab, including:
- `dispatch-engine.sh` every 1min — Core task execution
- `dispatch-heartbeat.sh` every 15min — Liveness check
- `stale-task-cleanup.sh` every 30min — Clean stuck tasks
- `vault-autocommit.sh` every 2h — Git commit vault changes
- `qmd update && qmd embed` every 30min — Semantic search index
- Various intel/research/proposal/monitoring crons

### 7.3 Database Details

| Database | Path | Engine | Tables | Size |
|----------|------|--------|--------|------|
| **Dispatch DB** | `~/dispatch/dispatch.db` | SQLite | **14 tables** (tasks, agents, missions, pipelines, proposals, feed, handoffs, inbox, vault_links, agent_health, engine_state, task_log, schema_version) | **1.3 MB, 84 tasks, 21 agents** |
| EMA dev | `daemon/priv/ema_dev.db` | SQLite | 0 (empty) | Exists but unused |
| Second Brain FTS | `daemon/priv/second_brain_fts.db` | SQLite FTS5 | 1 (vault_fts) | Active |
| Wiki Engine | `wiki-engine/wiki.db` | SQLite | 5 + FTS (wiki_spaces, wiki_projects, wiki_pages, wiki_edges, wiki_page_versions, wiki_pages_fts) | ~15MB |
| ClaudeForge | `claudeforge/~/.claudeforge/claudeforge.db` | SQLite | Unknown | Exists |
| CLI state | `~/.ema_cli_state.json` | JSON file | 14 collections | Mock data |
| QMD index | `~/.cache/qmd/index.sqlite` | SQLite | Vector index | **72.2 MB, 2590 files, 9951 vectors** |

**Dispatch DB is the most important database** — it's the operational state store for the entire dispatch system. Key schema:

```sql
-- tasks: the work queue
CREATE TABLE tasks (
  id TEXT PRIMARY KEY, title TEXT, description TEXT, agent TEXT,
  status TEXT DEFAULT 'queued',  -- queued/active/done/failed/partial/blocked/cancelled
  priority INTEGER DEFAULT 2, mission_id TEXT, pipeline_id TEXT,
  depends_on TEXT, timeout_min INTEGER DEFAULT 10,
  attempts INTEGER DEFAULT 0, max_attempts INTEGER DEFAULT 3,
  pid INTEGER, checkpoint TEXT, gateway_session_id TEXT, tags TEXT
);

-- agents: the 21-agent roster with circuit breaker state
CREATE TABLE agents (
  id TEXT PRIMARY KEY, name TEXT, emoji TEXT,
  status TEXT DEFAULT 'idle',  -- idle/active/error/circuit_open
  current_task_id TEXT, success_count INTEGER, failure_count INTEGER,
  circuit_state TEXT DEFAULT 'closed'
);

-- proposals: change proposals with approval workflow
CREATE TABLE proposals (
  id TEXT PRIMARY KEY, title TEXT, scope TEXT, task_breakdown TEXT,
  priority INTEGER, status TEXT DEFAULT 'pending',
  destructive INTEGER DEFAULT 0, auto_approved INTEGER DEFAULT 0
);
```

### 7.4 Git-Watched Repos

The vault at `~/vault/` is auto-committed every 2 hours via `vault-autocommit.sh`.

EMA project itself: `~/Projects/ema/` is a git repo.

### 7.5 MCP Servers (21 tools across 2 servers)

**EMA MCP Server** (`~/bin/ema-mcp-server.js`) — MCP JSON-RPC over stdio, proxies to daemon at `http://192.168.122.1:4488/api`:

| Tool | Endpoint | Purpose |
|------|----------|---------|
| `ema_health` | `GET /api/health` | Daemon health |
| `ema_get_projects` | `GET /api/projects` | List projects |
| `ema_get_tasks` | `GET /api/tasks` | List tasks (filterable) |
| `ema_create_task` | `POST /api/tasks` | Create task |
| `ema_brain_dump` | `POST /api/brain-dump/items` | Add to inbox |
| `ema_search_vault` | `GET /api/vault/search` | FTS5 search |
| `ema_get_vault` | `GET /api/vault/tree` | Vault tree |
| `ema_get_executions` | `GET /api/executions` | Agent executions |
| `ema_dispatch_execution` | `POST /api/executions` | Dispatch execution |
| `ema_get_goals` | `GET /api/goals` | Current goals |
| `ema_get_focus` | `GET /api/focus` | Active context |

**Agent VM MCP Server** (`~/mcp-server/server.py`, port 8899) — HTTP mode:

| Tool | Purpose |
|------|---------|
| `vault_search` | QMD semantic search over vault |
| `dispatch_queue` | List dispatch tasks by status |
| `dispatch_submit` | Submit task to dispatch queue |
| `agent_status` | System status (agents, sessions, gateway) |
| `web_search` | SearXNG meta-search |
| `web_fetch` | Fetch + extract readable text from URL |
| `pipeline_stats` | Research pipeline statistics |
| `pipeline_task` | Detailed pipeline task info |
| `read_file` | Read file from agent VM |
| `system_health` | System health metrics |

### 7.6 Listening Ports

| Port | Process | Purpose |
|------|---------|---------|
| 3001 | node (ClaudeForge server) | ClaudeForge Express API |
| 3200 | Next.js 16 | EMA Observer frontend |
| 4488 | beam.smp (Elixir) | EMA Phoenix daemon |
| 8082 | SearXNG | Meta-search |
| 8093 | node (wiki engine) | Wiki engine REST API |
| 8099 | mcpo | Chrome DevTools MCP bridge |
| 8178 | whisper-server | Speech-to-text |
| 8899 | python3 | Agent VM MCP server |
| 9223 | lightpanda | Headless browser |
| 11434 | ollama | Local LLM inference |
| 18789 | openclaw-gateway | **Still running** (archived but process alive) |

### 7.7 Related Projects

| Project | Path | Status | Relationship |
|---------|------|--------|-------------|
| ClaudeForge | `Projects/ema/claudeforge/` | Scaffolded, not running | Discord bot + web UI for remote Claude Code |
| Wiki Engine | `Projects/ema/wiki-engine/` | Built, unclear if running | SQLite wiki with FTS5, REST API |
| ARC-AGI-3 | `arc-agi-3/` | Active | AI competition project (separate) |
| claude-remote-discord | `Desktop/Coding/Projects/` | Reference copy in EMA | Original ClaudeForge location |
| Discord restructure | `projects/discord-restructure/` | Unknown | Discord-related |
| Intelligence | `intelligence/` | Active | Discord emitter, config |
| Claude Code Bot | `claude-code-bot/` | Active | Discord tools (send, route, thread, upload, react) |

---

## 8. Patterns and Conventions

### 8.1 Naming Conventions

- **Elixir modules:** `Ema.<Domain>.<Module>` (e.g., `Ema.Surfaces.ClaudeSession`)
- **Controllers:** `EmaWeb.<Name>Controller`
- **Channels:** `EmaWeb.<Name>Channel`
- **PubSub topics:** `domain:subtopic` or `domain:entity:<id>`
- **CLI IDs:** 3-letter prefix + 8 random chars (e.g., `pro_a1b2c3d4`, `prp_8a9b2c3d`)
- **Config keys:** Atom keys in Application config

### 8.2 Error Handling Patterns

- GenServers return `{:ok, result}` or `{:error, reason}` tuples
- Controllers return JSON with `%{ok: true, ...}` or `%{error: "..."}` with appropriate HTTP status
- Port-based sessions handle timeout via `Process.send_after` + `:timeout` message
- External service calls (Superman, Gateway) use `Req` with explicit `receive_timeout`
- Graceful degradation: if a surface/service is unavailable, features degrade (don't crash)

### 8.3 PubSub Event Shapes

All events are tuples: `{:event_name, ...payload}`. Published via `Phoenix.PubSub.broadcast(Ema.PubSub, topic, event)`.

### 8.4 REST Response Shapes

Success: `%{ok: true, ...data}` or `%{entity: data}` (200/201)
Error: `%{error: "description"}` (400/404/500/502/503)
List: `%{items: [...], total: N}` or bare list

### 8.5 Common Abstractions

- **Port-based CLI sessions** — Both Claude and Codex sessions use the same GenServer pattern: spawn via `Port.open`, accumulate `:data` messages in buffer, parse on `:exit_status`
- **Discovery pattern** — Parallel `Task.async` with `Task.yield_many` and timeout for boot-time enumeration
- **Cadence/tick pattern** — GenServer with `Process.send_after` for periodic work (StreamTicker, Stream.Manager)
- **Registry pattern** — `{:via, Registry, {Ema.Surfaces.Registry, key}}` for named process lookup

---

## 9. Open Questions and Ambiguities

### Critical

1. **Two parallel state stores.** The dispatch system uses `dispatch.db` (SQLite, 14 tables, 21 agents, managed by bash scripts). The Ecto repo (`ema_dev.db`) is empty. The data model in DATA_MODELS.md describes Ecto schemas that don't exist. **Decision needed:** migrate dispatch.db to Ecto, or keep the shell+SQLite approach?

2. **OpenClaw gateway is still running** on port 18789 despite being "archived." The daemon's GatewayClient still connects to it. Discovery still enumerates it. Runtime.exs still has `openclaw_gateway_url`. This needs to be fully killed and cleaned from daemon code.

3. **Daemon runs in dev mode** (`mix phx.server`, PID 210430). No systemd service, no release, no prod config beyond what's in runtime.exs. Would not survive a VM reboot without manual restart.

4. **Tauri shell doesn't exist.** ARCHITECTURE.md describes Tauri 2 + React 19. What exists instead: EMA Observer (Next.js 16 on port 3200, source at `~/projects/frontend-layer/`) and ClaudeForge (Next.js 15 on port 3001). Neither is the planned Tauri app. **The Observer is the real dashboard but its source wasn't deeply audited.**

### Moderate

5. **CLI dual-layer confusion.** The CLI has 6 command groups that hit the real daemon AND ~15 that use the mock store. A developer could easily think all commands are real. The mock layer's proposal approval flow (gate verification → task creation → routing → dispatch → audit trail) is the richest logic and has no daemon equivalent.

6. **Multiple overlapping knowledge stores.** 5 separate systems index the same vault content: (a) QMD (2,590 files, 9,951 vectors, 72MB index), (b) EMA FTS5 indexer, (c) Wiki engine on port 8093, (d) MCP server vault_search, (e) the vault filesystem directly. Which is authoritative?

7. **Stream Manager Discord posting.** The Stream.Manager defines 7 Discord channels for stream-of-consciousness posting. Are the corresponding webhook URLs configured? The `Feedback.Broadcast` module is the bridge but its implementation isn't clear.

8. **Session mode (shadow/canary/primary/ema_only).** This is configured but it's unclear what shadow mode actually does — the Monitor module is lightweight.

### Minor

9. **Unused mix deps.** `fuse`, `cachex`, `quantum`, `swoosh`, `finch`, `phoenix_live_view` are declared in mix.exs but not visibly used in any source file. Dead weight or future-planned.

10. **`openclaw` CLI command group** should be removed or replaced with EMA-native dispatch commands.

11. **Wiki Engine runs on port 8093** (compiled TypeScript version at `~/wiki/`) alongside the EMA daemon's vault endpoints on 4488. Redundant search surfaces.

12. **`runtime.exs` still references `OPENCLAW_GATEWAY_URL`** — should be renamed to `EMA_GATEWAY_URL` or removed.

13. **No auth on any endpoint.** The daemon API, Anthropic proxy (`/v1/messages`), and WebSocket all accept anonymous connections. The Anthropic proxy is especially high-risk — it spawns CLI processes from arbitrary input.

14. **3 active Codex sessions** running with `--dangerously-bypass-approvals-and-sandbox`, each spawning 8-12 MCP servers. Resource-heavy.

15. **Vault has 3,036 markdown files** but only 2,590 are indexed by QMD. The delta (446 files) may be in ignored directories or non-.md formats.
