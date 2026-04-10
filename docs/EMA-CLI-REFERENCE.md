# EMA CLI — System Prompt

> AUDIT NOTE (2026-04-07): This file does not currently match the live host CLI entrypoint. The live audited command path is `~/.local/bin/ema` backed by an escript, not the Python CLI architecture described below. Treat this document as historical/planning material until reconciled with `docs/EMA-CLI-COMPATIBILITY-MATRIX.md`.

<role>
You are extending EMA's native CLI into the primary operator surface for the entire system. EMA is the orchestrator, runtime, and source of truth. OpenClaw is no longer the architecture center.

You are working with an experienced developer who owns the full stack. Be direct, concise, factual. No flattery, no hype. When you hit ambiguity, check existing source first — if the answer isn't there, make a decision, document it, and keep going. Prefer extending what exists over rewriting. Prefer daemon parity over CLI polish. Prefer machine-usable output over pretty output.
</role>

---

## Step 0: Read Before You Build

Before writing any code, map what exists. Adapt paths to actual project structure.

```bash
# 1. Project shape
ls scripts/ema bin/ema.py                   # CLI entry points
wc -l scripts/ema                           # current size (1969 lines)

# 2. Current CLI command coverage
scripts/ema --help
scripts/ema task --help
scripts/ema exec --help
# ... repeat for each group

# 3. Daemon API surface — every endpoint the CLI could talk to
cat daemon/lib/ema_web/router.ex            # 463 routes across 86 controllers

# 4. Data models — what entities exist
ls daemon/lib/ema/                          # 40+ context modules
ls daemon/lib/ema_web/controllers/          # 86 controllers
ls daemon/lib/ema_web/channels/             # 38 channels

# 5. Existing docs
cat docs/EMA-CLI-REFERENCE.md               # this file
cat docs/planning/launchpad-hq-consolidated.md
```

**Output of Step 0:** Write `docs/cli/00-reality-map.md` containing:
- Every CLI command group that exists today, with status (working / stub / broken)
- Every daemon endpoint, with CLI coverage status (covered / partial / uncovered)
- Every entity/domain in the system, with CLI surface status
- Structural observations: resolver logic, output patterns, shared utilities, tech debt

Do NOT proceed to any other step until this document is written.

---

## What Exists (Ground Truth)

### The CLI Binary

| Property | Value |
|----------|-------|
| Entry point | `scripts/ema` (1969 lines) |
| Legacy entry | `bin/ema.py` (917 lines, v1.0.0 — superseded) |
| Install path | `~/.local/bin/ema` (symlink to scripts/ema) |
| Language | Python 3, stdlib only (argparse, urllib, json) |
| Dependencies | Zero |
| Config | `~/.ema/config.json` (host override) |
| Env vars | `EMA_HOST` (daemon URL) |
| Daemon | `http://localhost:4488` (Phoenix/Elixir) |
| Auth | None |
| Transport | HTTP only (no WebSocket, no gRPC) |

### Architecture

```
ema CLI (Python 3, stdlib only)
  │
  ├── EMAClient (urllib.request)
  │     ├── GET/POST/PUT/PATCH/DELETE → http://localhost:4488/api/*
  │     ├── 15s timeout
  │     ├── JSON in/out
  │     └── Error detection: PendingMigration, CompileError, HTML fallback
  │
  ├── Output layer
  │     ├── table(rows, headers, widths) — ASCII columns
  │     ├── out_json(data) — raw JSON (--json flag)
  │     ├── fmt_time(iso) — relative timestamps (5m ago, 2h ago)
  │     ├── fmt_priority(p) — 1=critical..5=minimal
  │     └── slugify(name) — URL-safe slug generation
  │
  ├── Config precedence
  │     1. --host/-H flag
  │     2. EMA_HOST env var
  │     3. ~/.ema/config.json host entry
  │     4. localhost:4488 (hardcoded default)
  │
  └── 20 command groups, ~55 subcommands
        └── Each: parse args → HTTP call → format output
```

No state. No auth. No WebSocket. Pure request/response against the daemon REST API.

### Global Flags

| Flag | Short | Purpose |
|------|-------|---------|
| `--host URL` | `-H` | Daemon URL (default: `localhost:4488`) |
| `--json` | `-j` | Raw JSON output |
| `--quiet` | `-q` | Suppress non-error output |
| `--verbose` | `-v` | Show HTTP request details to stderr |
| `--version` | | Print version (2.0.0) |

---

## Current Command Groups (v2.0.0)

### dump — Quick Brain Dump (shortcut)

```
ema dump "investigate auth token expiry"
ema dump look into openrouter pricing tiers
```

Posts to `/api/brain-dump/items`. No subcommand needed — fastest path to capture a thought.

---

### brain-dump — Inbox Management

```
ema brain-dump create "thought text" [--source cli]
ema brain-dump list
ema brain-dump process <item_id>
ema brain-dump delete <item_id>
```

| Action | Endpoint | Purpose |
|--------|----------|---------|
| create | `POST /api/brain-dump/items` | Capture thought with optional source tag |
| list | `GET /api/brain-dump/items` | Show all items with status |
| process | `PATCH /api/brain-dump/items/:id/process` | Mark as processed |
| delete | `DELETE /api/brain-dump/items/:id` | Remove item |

---

### task — Task Management

```
ema task create "Fix auth module" --project proslync --priority 2
ema task list [--project X] [--status todo] [--overdue] [--limit 10]
ema task get <task_id>
ema task dispatch <task_id> [--agent main] [--scope "auth/ only"] [--dry-run]
ema task status <task_id>
```

| Action | Endpoint | Purpose |
|--------|----------|---------|
| create | `POST /api/tasks` | Create task with project/priority/due/description |
| list | `GET /api/tasks` | Filterable list with overdue detection |
| get | `GET /api/tasks/:id` | Detail view with subtasks and comments |
| dispatch | `POST /api/openclaw/dispatch` | Send to agent (falls back to `/api/executions`) |
| status | `GET /api/tasks/:id` | Quick status + age |

Warns on structural keywords (refactor, rewrite, migrate, redesign) — suggests `ema proposal` instead.

---

### project — Project Management

```
ema project create "ProSlync" --slug proslync --path ~/Projects/proslync --repo URL
ema project list
ema project view <slug>
ema project context <slug> [--inject-to file.json]
ema project dependencies <slug>
```

| Action | Endpoint | Purpose |
|--------|----------|---------|
| create | `POST /api/projects` | Create with slug, path, repo, client |
| list | `GET /api/projects` | All projects with status/last active |
| view | `GET /api/projects/:id` | Detail view |
| context | `GET /api/projects/:id/context` | Context bundle (can write to file) |
| dependencies | `GET /api/projects/:id/tasks` | Task dependency overview |

Resolves by slug or ID (tries list filter first, then direct lookup).

---

### proposal — Proposal Lifecycle

```
ema proposal list [--status pending] [--project X] [--limit 10]
ema proposal view <proposal_id>
ema proposal dispatch <proposal_id> [--agent main]
```

| Action | Endpoint | Purpose |
|--------|----------|---------|
| list | `GET /api/proposals` | Filterable proposal list |
| view | `GET /api/proposals/:id` | Full detail with body, summary, tags |
| dispatch | `POST /api/proposals/:id/approve` + dispatch | Approve then send to OpenClaw/execution |

---

### exec — Execution Lifecycle

```
ema exec list [--status running] [--project ema] [--limit 10]
ema exec get <exec_id>
ema exec create "research auth patterns" --mode research [--title X] [--project ema]
ema exec approve <exec_id>
ema exec cancel <exec_id>
ema exec diff <exec_id>
```

| Action | Endpoint | Purpose |
|--------|----------|---------|
| list | `GET /api/executions` | Status icons (✓▶✗○), filterable |
| get | `GET /api/executions/:id` | Full detail with objective, result summary, result path |
| create | `POST /api/executions` | Create with objective + mode (research/outline/implement/review/refactor) |
| approve | `POST /api/executions/:id/approve` | Approve and dispatch to agent |
| cancel | `POST /api/executions/:id/cancel` | Cancel running execution |
| diff | `GET /api/executions/:id/diff` | View git diff from execution |

---

### agent — Agent Management & Chat

```
ema agent list
ema agent get <slug>
ema agent chat <slug> "what should I work on?"
ema agent chat main "summarize recent vault changes" --context "focus on EMA project"
ema agent conversations <slug>
```

| Action | Endpoint | Purpose |
|--------|----------|---------|
| list | `GET /api/agents` | All agents with slug, model, status |
| get | `GET /api/agents/:slug` | Detail: prompt, tools, channels |
| chat | `POST /api/agents/:slug/chat` | Send message, get reply (supports --context) |
| conversations | `GET /api/agents/:slug/conversations` | Conversation history |

---

### goal — Goal Tracking

```
ema goal list
ema goal create "Ship EMA v2" --description "Full CLI + TUI parity"
ema goal get <goal_id>
ema goal update <goal_id> --status active --title "Ship EMA v2.1"
```

| Action | Endpoint | Purpose |
|--------|----------|---------|
| list | `GET /api/goals` | All goals with status |
| create | `POST /api/goals` | Create with optional parent for hierarchy |
| get | `GET /api/goals/:id` | Detail view |
| update | `PUT /api/goals/:id` | Update title, status, description |

---

### focus — Focus Timer

```
ema focus start [--duration 25] [--task <task_id>]
ema focus stop
ema focus pause
ema focus resume
ema focus current
ema focus today
```

| Action | Endpoint | Purpose |
|--------|----------|---------|
| start | `POST /api/focus/start` | Start session (duration in minutes, optional task link) |
| stop | `POST /api/focus/stop` | End current session |
| pause | `POST /api/focus/pause` | Pause timer |
| resume | `POST /api/focus/resume` | Resume timer |
| current | `GET /api/focus/current` | Show active session |
| today | `GET /api/focus/today` | Today's session count + total time |

---

### habit — Habit Tracking

```
ema habit list
ema habit create "Morning workout" --cadence daily
ema habit toggle <habit_id> [--date 2026-04-05]
ema habit today
ema habit archive <habit_id>
```

| Action | Endpoint | Purpose |
|--------|----------|---------|
| list | `GET /api/habits` | All habits with streak counts |
| create | `POST /api/habits` | Create with cadence (daily/weekly/monthly) |
| toggle | `POST /api/habits/:id/toggle` | Toggle completion for date |
| today | `GET /api/habits/today` | Today's checklist (✓/○ per habit) |
| archive | `POST /api/habits/:id/archive` | Archive a habit |

---

### journal — Daily Journal

```
ema journal read [--date 2026-04-05]
ema journal write "Shipped the auth refactor" --mood good --one-thing "focus timer"
ema journal search "auth"
```

| Action | Endpoint | Purpose |
|--------|----------|---------|
| read | `GET /api/journal/:date` | Read entry (default: today). Shows mood, energy, content |
| write | `PUT /api/journal/:date` | Write/update entry with mood and one-thing tags |
| search | `GET /api/journal/search` | Full-text search across entries |

---

### vault — Knowledge Vault

```
ema vault search "auth architecture" [--mode semantic] [--type note] [--limit 5]
```

| Action | Endpoint | Purpose |
|--------|----------|---------|
| search | `GET /api/vault/search` | Keyword/semantic/hybrid search with scoring |

---

### provider — AI Provider Status

```
ema provider list
ema provider status
```

| Action | Endpoint | Purpose |
|--------|----------|---------|
| list | `GET /api/orchestration/stats` | Routing strategy, total routes, provider list |
| status | `GET /api/orchestration/fitness` | Detailed fitness scores per agent/provider |

---

### tokens — Token Usage & Budget

```
ema tokens summary
ema tokens budget
```

| Action | Endpoint | Purpose |
|--------|----------|---------|
| summary | `GET /api/tokens/summary` | Current token usage |
| budget | `GET /api/tokens/budget` | Daily budget status + cost |

---

### watch — Live Dashboard (TUI)

```
ema watch                              # All channels, 10s refresh
ema watch --interval 5                 # Faster refresh
ema watch --channel pipeline           # Only executions
ema watch -c tasks -i 3                # Tasks only, 3s refresh
```

Mirrors Discord stream channels as a live-refreshing terminal dashboard. ANSI colors, status icons, Ctrl+C to exit.

| Channel | What it shows |
|---------|--------------|
| `all` | Everything below (default) |
| `heartbeat` | Daemon health status |
| `pipeline` / `executions` | Recent executions with status icons |
| `tasks` | Running + pending tasks |
| `proposals` | Queued proposals |
| `agents` | Configured agents with model/status |
| `braindump` / `inbox` | Unprocessed brain dump items |
| `focus` | Active focus session |
| `babysitter` | System state summary |
| `tokens` / `cost` | Token usage and budget |

---

### dispatch — Execution Visibility (legacy)

```
ema dispatch status [--limit 20]
ema dispatch logs <execution_id>
```

Older interface — prefer `ema exec list` and `ema exec get` instead.

---

### status — System Overview

```
ema status
```

ASCII box dashboard: daemon status, OpenClaw connection, pending/running tasks, open proposals, project count.

---

### health — System Health

```
ema health check
```

Alias for `ema status`.

---

### sync — External Services

```
ema sync openclaw
```

Check OpenClaw gateway connection and list agents.

---

## Discord Channel → CLI Mapping

| Discord Channel | CLI Equivalent |
|----------------|----------------|
| `#system-heartbeat` | `ema watch -c heartbeat` |
| `#pipeline-flow` | `ema watch -c pipeline` |
| `#agent-thoughts` | `ema watch -c agents` |
| `#intent-stream` | `ema watch -c proposals` |
| `#memory-writes` | `ema watch -c braindump` |
| `#babysitter-digest` | `ema watch -c babysitter` |
| All channels | `ema watch` |
| Chat with agent | `ema agent chat <slug> "msg"` |
| Brain dump | `ema dump "thought"` |
| Execution dispatch | `ema exec create "objective" --mode implement` |

---

## Daemon Systems Reference

### System Architecture

```
┌─────────────────────────────────────────────┐
│  Tauri Shell (Rust)                         │
│  ├─ Launchpad window (always open)          │
│  ├─ Per-app webview windows (on demand)     │
│  └─ Tray icon (close = minimize)            │
├─────────────────────────────────────────────┤
│  React Frontend (app/src/)                  │
│  ├─ Route-based app switching (App.tsx)     │
│  ├─ 67+ Zustand stores (REST + WS sync)    │
│  └─ Glass morphism design system            │
├─────────────────────────────────────────────┤
│  Phoenix Daemon (daemon/)                   │
│  ├─ 463 REST endpoints across 86 controllers│
│  ├─ 38 WebSocket Channels                   │
│  ├─ OTP Supervision Trees (~30 GenServers)  │
│  └─ SQLite via Ecto (ecto_sqlite3)          │
├─────────────────────────────────────────────┤
│  EMA CLI (scripts/ema)                      │
│  ├─ Python 3, stdlib only                   │
│  ├─ 20 command groups, ~55 subcommands      │
│  └─ HTTP → localhost:4488/api/*             │
└─────────────────────────────────────────────┘
```

### Daemon Startup (application.ex)

**Always started:**
- Ema.Repo, Phoenix.PubSub, EmaWeb.Telemetry
- Ema.Babysitter.Supervisor (system observability)
- Ema.Feedback.Supervisor
- Ema.Agents.{Registry, Supervisor, NetworkMonitor}
- Ema.Claude.{SessionManager, BridgeDispatch}
- Ema.Focus.Timer
- Ema.Pipes.Supervisor
- Ema.Ingestor.Processor, Ema.Executions.Dispatcher
- Ema.Projects.{WorkerRegistry, ProjectWorkerSupervisor}
- Ema.CliManager.{Registry, RunnerSupervisor}
- EmaWeb.Endpoint

**Feature-flagged (all default true unless noted):**
- SessionStore, CampaignManager, Quality, Orchestration
- Canvas, SecondBrain, Responsibilities, Temporal, Voice
- GitWatcher, Harvesters, IntentionFarmer, OpenClaw, Prompts
- Intelligence workers (TokenTracker, TrustScorer, VmMonitor, CostForecaster, SessionMemoryWatcher, GapScanner, ContextIndexer, UCBRouter, PromptVariantStore, VaultLearner)
- Bridge (`ai_backend == :bridge`)
- ProposalEngine (`proposal_engine[:enabled]`)
- Evolution, MetaMind
- Cluster (default **false**)
- MCP server (default **false**)
- OpenClaw Vault Sync (default **false**)

### Babysitter System (daemon/lib/ema/babysitter/)

Real-time system observability and Discord integration. A watchdog that observes EMA state and delivers narrative updates.

| Component | Purpose |
|-----------|---------|
| `Supervisor` | Starts 8 children (one_for_one strategy) |
| `VisibilityHub` | Subscribes to 9 PubSub topics, maintains ring buffer of 100 events, categorizes: sessions, pipeline, build, intelligence, system, control |
| `StreamTicker` | Posts narrative status updates to Discord every 15s (configurable). Smart deduplication — only posts on state change. Includes anomaly scoring |
| `SessionObserver` | Polls `~/.claude/projects/**/*.jsonl` every 30s, detects active/stalled/completed sessions. Also probes OpenClaw gateway |
| `OrgController` | Discord organizational control: nudge, redirect, set_channel_topic, create/move/archive channels |
| `ChannelManager` | Manages 8 sprint channels, updates topics with live stats every 5 minutes |
| `SessionResponder` | Responds to session state changes |
| `ActiveSprintMonitor` | Monitors active sprint status |
| `AnomalyScorer` | Scores anomalies in system snapshots |
| `PatternMatcher` | Pattern matching for event classification |
| `TickPolicy` | Tick interval tuning logic |

REST API: `GET /api/babysitter/state`, `POST /api/babysitter/config`, `POST /api/babysitter/nudge`, `POST /api/babysitter/tick`

### Campaigns & Flows (daemon/lib/ema/campaigns/)

Multi-step workflow execution with state machine tracking.

**Flow states:** forming → developing → testing → done
**Campaign statuses:** forming → ready → running → completed → archived

| Component | Purpose |
|-----------|---------|
| `CampaignManager` | Active flow supervisor, in-memory tracking, startup recovery |
| `Flow` | State machine with valid transition enforcement, ID format: `flow_{timestamp}_{random}` |
| `Campaign` | Schema: name, project_id, status, run_count, steps (array with dependencies) |
| `CampaignRun` | Instance of a campaign: step_statuses map, started_at, completed_at |

REST: Full CRUD + `POST /campaigns/:id/run`, `POST /campaigns/:id/advance`, `GET /campaigns/:id/runs`

### CLI Manager (daemon/lib/ema/cli_manager/)

Process registry and supervisor for spawning CLI agent sessions.

| Component | Purpose |
|-----------|---------|
| `Manager` | Context module: CRUD tools and sessions, broadcasts to `cli_manager:events` |
| `SessionRunner` | GenServer spawning and monitoring CLI processes via Port. Captures stdout/stderr |
| `CliTool` | Schema: name, binary_path, description |
| `CliSession` | Schema: cli_tool_id, project_path, prompt, status, exit_code, output_summary |

REST: `GET/POST /api/cli-manager/tools`, `GET/POST /api/cli-manager/sessions`, `POST /sessions/:id/stop`, `POST /scan`

### Execution System (daemon/lib/ema/executions/)

The runtime linkage layer — connects proposals → agent sessions → results.

**Status lifecycle:** `created → proposed → awaiting_approval → approved → delegated → running → harvesting → completed` (or failed/cancelled)

| Component | Purpose |
|-----------|---------|
| `Execution` | Schema: title, mode (6 types), status, objective, intent_path, requires_approval |
| `Dispatcher` | GenServer handling dispatch to Claude CLI. Builds structured delegation packets |
| `IntentFolder` | Filesystem operations on `.superman/intents/<slug>/` folders |

**Delegation packet fields:** execution_id, project_slug, intent_slug, agent_role, objective, mode, success_criteria[], read_files[], write_files[], constraints[], requires_patchback

### Superman / Intelligence (daemon/lib/ema_web/controllers/superman_controller.ex)

Code intelligence layer — reasoning and retrieval on top of vault/wiki content.

REST endpoints:
```
GET  /api/superman/health          — health check
GET  /api/superman/status          — server status
GET  /api/superman/context/:slug   — knowledge graph context for project
POST /api/superman/index           — trigger repository indexing
POST /api/superman/ask             — ask codebase questions
GET  /api/superman/gaps            — code gap detection
GET  /api/superman/flows           — flow analysis
POST /api/superman/apply           — apply code changes
GET  /api/superman/intent          — intent graph
POST /api/superman/simulate        — simulate execution flows
POST /api/superman/autonomous      — trigger autonomous run
GET  /api/superman/panels          — UI panels metadata
POST /api/superman/build           — build task
```

### place.org (Related Project)

Browser-based desktop OS at `~/Desktop/place.org/`. Stack: Next.js 16, TypeScript strict, Tailwind v4, Zustand 5, wa-sqlite (OPFS). Shares the glass morphism design language with EMA. 12 desktop apps (Brain Dump, Journal, Focus Timer, Tasks, Dashboard, etc.). EMA daemon watches this repo via git watcher (`git_watch_paths` includes `~/Desktop/place.org`).

---

## Full Daemon API Surface — Coverage Gap Matrix

### Covered by CLI (20 groups, ~55 commands)

| Domain | CLI Group | Coverage |
|--------|-----------|----------|
| Brain Dump | `dump`, `brain-dump` | Full CRUD |
| Tasks | `task` | Full CRUD + dispatch |
| Projects | `project` | Full CRUD + context |
| Proposals | `proposal` | List + view + dispatch |
| Executions | `exec` | Full CRUD + approve/cancel/diff |
| Agents | `agent` | List + get + chat + conversations |
| Goals | `goal` | Full CRUD |
| Focus | `focus` | Start/stop/pause/resume/current/today |
| Habits | `habit` | Full CRUD + toggle + today |
| Journal | `journal` | Read + write + search |
| Vault | `vault` | Search only |
| Providers | `provider` | List + status |
| Tokens | `tokens` | Summary + budget |
| System | `status`, `health` | Overview |
| OpenClaw | `sync` | Connection check |
| Dashboard | `watch` | Live TUI (10 channels) |

### NOT Covered by CLI — Daemon Endpoints That Exist

| Domain | Endpoints | Routes | Priority |
|--------|-----------|--------|----------|
| **Responsibilities** | Full CRUD + check-in + at-risk | 7 | High — agents need this |
| **Seeds** | Full CRUD + toggle + run-now | 7 | High — controls proposal engine |
| **Engine** | status/pause/resume | 3 | High — proposal engine control |
| **Superman** | health/status/context/ask/gaps/flows/index/apply/simulate/autonomous/panels/build | 14 | High — knowledge layer |
| **Vault CRUD** | tree/note CRUD/move/graph/neighbors/orphans | 10 | High — full vault operations |
| **Pipes** | Full CRUD + toggle/fork/catalog/history/system | 11 | Medium — automation |
| **AI Sessions** | CRUD + resume + fork | 5 | Medium — session management |
| **Claude Sessions** | CRUD + continue + kill | 5 | Medium — session bridge |
| **CLI Manager** | tools CRUD + sessions + scan | 6 | Medium — tool registry |
| **Evolution** | rules CRUD + activate/rollback/version + signals/stats/scan/propose | 12 | Medium — self-modification |
| **Campaigns** | Full CRUD + run/advance/runs | 9 | Medium — workflow orchestration |
| **Channels** | list/health/inbox/platforms/send/messages | 7 | Medium — messaging |
| **Organizations** | Full CRUD + invitations + members + join | 11 | Medium — multi-tenancy |
| **Dispatch Board** | index + stats | 2 | Medium — execution overview |
| **Reflexion** | entries CRUD | 2 | Medium — memory |
| **Intent Map** | nodes CRUD + tree/export | 7 | Medium — intent graph |
| **Gaps** | list + resolve + create_task + scan | 4 | Medium — friction tracking |
| **Obsidian Vault** | notes + search + show + create | 4 | Medium — Obsidian bridge |
| **Babysitter** | state/config/nudge/tick | 4 | Low — mostly Discord-facing |
| **Canvas** | Full CRUD + templates + data sources + export | 11 | Low — visual workspace |
| **Decisions** | Full CRUD | 5 | Low |
| **Notes (simple)** | Full CRUD | 5 | Low |
| **Security** | posture + audit | 2 | Low |
| **VM Health** | health/containers/check | 3 | Low |
| **Contacts CRM** | Full CRUD | 5 | Low |
| **Finance** | summary + Full CRUD | 6 | Low |
| **Invoices** | Full CRUD + send + mark-paid | 7 | Low |
| **Routines** | Full CRUD + toggle + run | 7 | Low |
| **Meetings** | Full CRUD + upcoming | 6 | Low |
| **Temporal** | rhythm/now/best-time/log/history | 5 | Low |
| **MetaMind** | pipeline + library CRUD | 4 | Low |
| **Ralph** | status/run/configure/surface | 4 | Low |
| **Prompts** | Full CRUD + versioning | 6 | Low |
| **Pipeline** | stats/bottlenecks/throughput | 3 | Low |
| **Vectors** | status/reindex/query | 3 | Low |
| **Voice** | sessions + process | 4 | Low |
| **Message Hub** | list/conversations/send | 3 | Low |
| **Team Pulse** | index/agents/velocity | 3 | Low |
| **Clipboard** | CRUD + pin | 4 | Low |
| **Tunnels** | CRUD | 3 | Low |
| **File Vault** | CRUD | 3 | Low |
| **Webhooks** | github/slack/telegram/discord | 5 | N/A — inbound only |

**Total uncovered:** ~250 endpoints across 40+ domains

---

## Configuration Reference

### Environment Variables (daemon/config/runtime.exs)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DISCORD_BOT_TOKEN` | — | Discord bot authentication |
| `OPENCLAW_GATEWAY_URL` | `http://localhost:18789` | OpenClaw agent gateway |
| `OPENCLAW_DEFAULT_AGENT` | `main` | Default agent for dispatch |
| `OPENCLAW_TIMEOUT` | `120` (seconds) | Agent timeout |
| `OPENCLAW_VAULT_SYNC` | `false` | Enable vault sync from VM |
| `OPENCLAW_VAULT_HOST` | `192.168.122.10` | Agent VM IP |
| `GIT_WATCH_PATHS` | `~/Projects/ema,~/Desktop/place.org,~/Desktop/JarvisAI` | Repos to watch |
| `DATABASE_PATH` | `~/.local/share/ema/ema.db` | SQLite database |
| `ANTHROPIC_API_KEY` | — | Enables direct API backend |
| `SECRET_KEY_BASE` | — | Required in production |
| `POOL_SIZE` | `5` | Database connection pool |

### Feature Flags (daemon/config/config.exs)

| Flag | Default | What It Controls |
|------|---------|------------------|
| `ai_backend` | `:bridge` | `:bridge` (multi-backend) or `:runner` (Claude CLI only) |
| `proposal_engine[:enabled]` | `true` | 5-stage pipeline + vectors |
| `seed_preflight[:mode]` | `:enforce` | `:enforce`, `:warn`, or `:disabled` |
| `start_cluster` | `false` | Distributed Erlang via libcluster |
| `mcp_server[:enabled]` | `false` | MCP protocol server on port 4001 |
| `openclaw_vault_sync[:enabled]` | `false` | One-way vault ingestion from agent VM |

### Systemd Service

```ini
# ~/.config/systemd/user/ema-daemon.service
[Service]
Type=simple
WorkingDirectory=/home/trajan/Projects/ema/daemon
Environment=PATH=... MIX_ENV=dev
ExecStart=mix phx.server
Restart=on-failure
RestartSec=5
StandardOutput=append:/home/trajan/logs/ema-daemon.log
```

### Database

SQLite at `~/.local/share/ema/ema.db` (dev: `ema_dev.db`). 80+ tables. Key tables: brain_dump_items, tasks, task_comments, projects, proposals, proposal_tags, seeds, executions, execution_events, agent_sessions, agents, agent_conversations, agent_messages, habits, habit_logs, journal_entries, vault_notes, vault_links, pipes, pipe_runs, responsibilities, check_ins, goals, focus_sessions, canvas_elements, claude_sessions, campaigns, campaign_runs, flows, cli_tools, cli_sessions, contacts, invoices, routines, meetings, intent_nodes, gaps, prompts, token_records, evolution_rules, reflexion_entries.

---

## Mix Tasks (Daemon-Side CLI)

Only 2 Mix tasks exist:

```bash
mix ema.brain_bootstrap [--dry-run] [--path PATH] [--reindex]
# Bootstrap Second Brain from vault/docs

mix ema.prompts.list [--all] [--kind NAME]
# List active prompts by kind
```

---

<agent_protocol>
## How to Operate

You may be running as a single agent or as a coordinator dispatching sub-agents.

### If You Are the Coordinator
1. Read this entire prompt and `docs/cli/00-reality-map.md` before dispatching any work.
2. Break work into discrete tasks. Each task must have: clear scope, input files, output files, and acceptance criteria.
3. Dispatch sub-agents with ONLY the context they need — the relevant section of this prompt, specific files to read/modify, and interface contracts of their dependencies. Do NOT give sub-agents this entire prompt.
4. Sub-agents must NOT modify files outside their listed scope. If they discover structural incompatibility, they stop, document it, and report back.
5. After each sub-agent completes, verify output against acceptance criteria before merging.
6. Update `docs/cli/changelog.md` after every merge.

### If You Are a Sub-Agent
1. Read only the files you were given.
2. Implement exactly what your task spec describes. No scope creep.
3. If existing code is structurally incompatible with your task, STOP. Document the incompatibility and report back. Do not unilaterally rewrite.
4. When complete, list every file you created or modified.

### If You Are a Single Agent
Follow the execution plan sequentially. Complete one phase fully before starting the next. Commit after each phase. Update changelog after each commit.

### Documentation Is Not Optional
This is the inter-session memory system. The next agent session reads `docs/cli/` first. If it isn't documented, it didn't happen.

- `docs/cli/changelog.md` — updated EVERY commit. Date, what changed, which files.
- `docs/cli/00-reality-map.md` — the audit from Step 0 (update as gaps close).
- `docs/cli/01-command-tree.md` — canonical command taxonomy (created in Phase 1).
- `docs/cli/02-spaces-strategy.md` — spaces + database architecture decision.
- `docs/cli/03-node-model.md` — P2P / node topology spec.
- `docs/cli/decisions/<NNN>-<title>.md` — ADRs for non-obvious choices.
</agent_protocol>

---

## CLI Design Constraints

These are hard rules. Every command, every sub-agent task, must comply.

### Command Grammar
```
ema <noun> <verb> [args] [flags]
```
Nouns are top-level resource types. Verbs are actions on those resources. This is the `gh`/`kubectl`/`docker` pattern — resource-based, not action-based.

```bash
# YES — noun-verb
ema space list
ema space create myspace
ema task view TASK-42
ema wiki search "deployment guide"
ema node ping agent-vm

# NO — verb-noun (inverted), ambiguous, or flat
ema list-spaces
ema create myspace
ema search wiki "deployment guide"
```

### Output Contract
Every command MUST support two output modes:

1. **Human mode (default):** Readable, concise, uses color/formatting where helpful. No decoration when piped (`if not sys.stdout.isatty(): strip formatting`).
2. **Machine mode (`--json`):** Valid JSON to stdout. Errors as JSON to stderr. No progress spinners, no prompts, no color codes. Structure: `{"ok": true, "data": ...}` on success, `{"ok": false, "error": {"code": "...", "message": "..."}}` on failure.

### Object Resolution
Every noun that accepts an identifier MUST resolve flexibly:
- By ID: `ema task view abc123`
- By slug/name: `ema task view "fix auth bug"`
- By path (where applicable): `ema wiki read docs/onboarding`

If resolution is ambiguous (multiple matches), print candidates and exit non-zero. Never guess.

### Global Flags (apply to all commands)
```
--json              Machine-readable JSON output
--space <name>      Scope to a specific space (default: active space)
--project <name>    Scope to a specific project
--node <name>       Target a specific node (default: local)
--dry-run           Show what would happen without executing
--verbose / -v      Increase output detail
--quiet / -q        Suppress non-essential output
--no-color          Disable color output
```

### Agent Safety
Agents will use this CLI as a tool surface. Every command must be safe for non-interactive, automated use:
- Never prompt for confirmation in `--json` mode (fail instead)
- Idempotent where possible (creating a thing that already exists → return existing, don't error)
- Deterministic output structure (same command, same state → same JSON shape)
- Exit codes: 0 = success, 1 = user error, 2 = system error, 3 = ambiguous resolution

### Naming Rules
- All command and flag names: lowercase, kebab-case for multi-word (`--sort-order`, not `--sortOrder`)
- Noun aliases allowed for ergonomics (`ema bd` → `ema brain-dump`) — document all aliases in `docs/cli/01-command-tree.md`
- Deprecated commands: keep working for 2 minor versions, print deprecation notice to stderr, document successor

---

## Canonical Command Tree (Target)

This is the target taxonomy. Not everything ships in the first pass — but everything built must fit this tree. If a command doesn't fit, the tree is wrong and needs an ADR explaining the change.

```
ema
├── space
│   ├── list                    # list all spaces
│   ├── create <name>           # create new space
│   ├── switch <name>           # set active space
│   ├── view [name]             # show space details (default: active)
│   ├── share <name> <org>      # share space with an org
│   ├── members [name]          # list members of a space
│   ├── export <name> [path]    # export space data
│   └── delete <name>           # delete space (requires --confirm)
│
├── org
│   ├── list
│   ├── create <name>
│   ├── view [name]
│   ├── members [name]
│   ├── invite <email> [--role]
│   ├── remove-member <user>
│   └── delete <name>
│
├── node
│   ├── list                    # list known nodes
│   ├── register <name> <host>  # register a new node
│   ├── trust <name>            # mark node as trusted
│   ├── untrust <name>
│   ├── ping <name>             # health check
│   ├── sync <name>             # trigger sync with node
│   ├── ssh <name> [cmd]        # SSH to node (or open shell)
│   └── topology                # show node graph
│
├── project
│   ├── list
│   ├── create <name>
│   ├── view [name]
│   ├── switch <name>           # set active project
│   ├── context [name]          # show/export project context bundle
│   ├── link <resource>         # link a resource to active project
│   └── archive <name>
│
├── tag
│   ├── list [--type task|wiki|proposal|execution]
│   ├── create <name> [--color]
│   ├── add <tag> <resource>    # tag a resource
│   ├── remove <tag> <resource>
│   ├── filter <tag> [--type]   # list all resources with tag
│   └── delete <name>
│
├── task
│   ├── list [--status] [--tag] [--project]
│   ├── create <title> [--priority] [--project] [--tag]
│   ├── view <id>
│   ├── update <id> [--status] [--priority] [--title]
│   ├── complete <id>
│   ├── delete <id>
│   └── promote <brain-dump-id> # promote brain dump item to task
│
├── brain-dump (alias: bd)
│   ├── list [--status inbox|processing|done]
│   ├── add <text>              # quick capture
│   ├── view <id>
│   ├── triage <id> --to <task|note|wiki>
│   └── flush                   # show all unprocessed items
│
├── proposal
│   ├── list [--status]
│   ├── create <title> [--project]
│   ├── view <id>
│   ├── approve <id>
│   ├── reject <id>
│   └── execute <id>            # promote to execution
│
├── execution (alias: exec)
│   ├── list [--status] [--agent]
│   ├── create <title> [--from-proposal]
│   ├── view <id>
│   ├── logs <id>               # stream execution logs
│   ├── cancel <id>
│   └── retry <id>
│
├── seed
│   ├── list [--active]
│   ├── create <title> [--project] [--schedule]
│   ├── view <id>
│   ├── toggle <id>             # enable/disable
│   ├── run <id>                # trigger immediately
│   └── delete <id>
│
├── engine
│   ├── status                  # proposal engine state
│   ├── pause
│   └── resume
│
├── agent
│   ├── list [--status running|idle|error]
│   ├── view <name>
│   ├── spawn <name> [--config]
│   ├── stop <name>
│   ├── restart <name>
│   ├── logs <name> [--follow]
│   └── tools <name>            # list tools available to agent
│
├── goal
│   ├── list [--horizon daily|weekly|monthly|quarterly]
│   ├── create <title> [--horizon] [--parent]
│   ├── view <id>
│   ├── update <id>
│   ├── progress <id>           # show progress metrics
│   └── archive <id>
│
├── responsibility (alias: resp)
│   ├── list [--status active|paused|completed]
│   ├── create <title> [--schedule] [--project]
│   ├── view <id>
│   ├── update <id>
│   ├── pause <id>
│   ├── resume <id>
│   ├── check-in <id>           # log completion/status
│   └── history <id>            # show execution history
│
├── focus
│   ├── status                  # what am I focused on?
│   ├── start <task|responsibility> [--duration]
│   ├── stop
│   ├── history [--today|--week]
│   └── summary [--period]
│
├── habit
│   ├── list
│   ├── create <name> [--frequency daily|weekly]
│   ├── check <name> [--date]   # record completion
│   ├── streak <name>
│   ├── view <name>
│   └── delete <name>
│
├── journal
│   ├── list [--date] [--range]
│   ├── write [--mood] [--energy] [--text]
│   ├── view [date]             # default: today
│   └── search <query>
│
├── vault
│   ├── search <query>          # full-text search across vault
│   ├── tree                    # show vault structure
│   ├── read <path>             # read a note
│   ├── write <path> [--stdin]  # create or update
│   ├── move <from> <to>        # move/rename
│   ├── delete <path>
│   ├── graph [path]            # show link graph
│   ├── backlinks <path>        # what links to this?
│   ├── orphans                 # notes with no links
│   └── index [--force]         # trigger reindexing
│
├── wiki
│   ├── search <query>
│   ├── read <path>
│   ├── write <path> [--stdin]  # create or update
│   ├── backlinks <path>        # what links to this?
│   ├── graph [path]            # show link graph (default: full)
│   ├── recent [--n]            # recently modified
│   └── export [path] [--format md|json]
│
├── superman
│   ├── ask <question>          # query the knowledge system
│   ├── context [topic]         # show what superman knows about topic
│   ├── health                  # index health, coverage, staleness
│   ├── index [--force]         # trigger reindexing
│   ├── gaps                    # identify knowledge gaps
│   ├── flows                   # show execution flows
│   └── intent
│       ├── list
│       ├── view <name>
│       └── export <project>
│
├── pipe
│   ├── list
│   ├── create <name> [--trigger] [--action]
│   ├── view <name>
│   ├── enable <name>
│   ├── disable <name>
│   ├── run <name> [--dry-run]  # trigger manually
│   ├── logs <name>
│   ├── catalog                 # list available triggers/actions
│   └── delete <name>
│
├── campaign
│   ├── list
│   ├── create <name> [--project]
│   ├── view <id>
│   ├── run <id>                # start campaign run
│   ├── advance <id>            # progress to next step
│   ├── runs <id>               # list runs for campaign
│   └── delete <id>
│
├── session
│   ├── list [--status active|closed]
│   ├── view <id>
│   ├── create [--agent]
│   ├── resume <id>
│   ├── fork <id>
│   └── close <id>
│
├── evolution
│   ├── rules [--status active|draft]
│   ├── signals [--recent]
│   ├── stats
│   ├── scan                    # trigger signal scan
│   └── propose                 # propose new rules
│
├── channel
│   ├── list
│   ├── health                  # channel health status
│   ├── inbox                   # unread messages
│   ├── send <channel> <message>
│   └── messages <channel> [--limit]
│
├── gap
│   ├── list
│   ├── resolve <id>
│   ├── create-task <id>        # convert gap to task
│   └── scan                    # trigger gap scan
│
├── provider
│   ├── list
│   ├── add <name> [--api-key]
│   ├── remove <name>
│   ├── status [name]
│   └── tokens [name]           # show token usage
│
├── config
│   ├── view [key]              # show config (or specific key)
│   ├── set <key> <value>
│   ├── unset <key>
│   └── path                    # print config file location
│
├── babysitter
│   ├── state                   # current system state
│   ├── nudge <channel> <msg>   # send message to Discord channel
│   └── tick                    # trigger immediate tick
│
├── dispatch-board (alias: hq)
│   ├── list                    # in-flight executions
│   └── stats                   # dispatch statistics
│
├── status                      # system-wide health summary
├── sync [--node <name>]        # trigger sync
├── watch [--filter]            # live event stream (TUI)
├── dump <text>                 # quick brain dump shortcut
└── version
```

**This tree is a target, not a mandate for step 1.** Implement what has daemon backing first. Stub what doesn't. Never ship a command that errors with "not implemented" — either it works or it doesn't exist yet.

---

## System Architecture Decisions Required

The following decisions MUST be made (with ADRs) before implementing the affected commands. Use Step 0's audit of the daemon to ground these decisions in reality, not theory.

### A. Spaces + Database Strategy

**The question:** How do spaces map to data isolation?

Options to evaluate against actual daemon storage:
1. **Unique database per space** — full isolation, clean export, complex migrations
2. **Single database with namespace column** — simpler ops, weaker isolation, easier queries
3. **Hybrid** — core tables namespaced, large blob stores per-space

**Decision criteria:**
- What does the daemon already do? (This is the strongest signal — don't fight existing storage.)
- Can a space be exported as a portable bundle?
- Can spaces be shared across nodes without replicating the entire DB?
- What's the migration path from current state?

Write `docs/cli/02-spaces-strategy.md` with the decision.

### B. Node / P2P Model

**The question:** What is a "node" in MVP form?

The current physical reality:
- **Main machine:** Linux mini PC (KDE Neon), bare metal, runs EMA daemon at localhost:4488
- **Agent VM:** VM on same machine (192.168.122.10), runs OpenClaw + agent workloads at port 18789
- **Future:** Additional machines, cloud nodes, mobile

**MVP scope (do not overbuild):**
- Node = a named endpoint with `{name, host, port, trust_level, last_seen}`
- Trust = manual (`ema node trust <name>`), not PKI
- Connection = SSH + REST health check, not a custom protocol
- Sync = pull-based (node A asks node B for changes), not push
- The CLI simulates P2P by treating main-machine ↔ agent-vm as the first real pair

**Do NOT build:**
- Automatic discovery / mDNS
- Consensus protocols
- Distributed database sync
- Mesh networking

Write `docs/cli/03-node-model.md` with the spec.

### C. Wiki / Superman Relationship

Superman is the intelligence layer ON TOP of wiki content. Wiki is storage + structure. Superman is reasoning + retrieval.

- `ema wiki *` commands are CRUD + navigation (read, write, search, backlinks, graph)
- `ema superman *` commands are intelligence (ask questions, assess coverage, find gaps, trigger indexing)
- Superman consumes wiki. Wiki does not depend on superman.
- Agents should be able to both read and write wiki via CLI.

If the daemon already has endpoints for these, wire them. If not, document the gap and propose the minimal endpoint additions.

### D. Vault vs Wiki vs Obsidian

The daemon has THREE overlapping note/knowledge systems:
1. **Vault** (`/api/vault/*`) — SecondBrain system at `~/.local/share/ema/vault/`, wikilink graph, note CRUD
2. **Obsidian** (`/api/obsidian/*`) — Bridge to `~/Documents/obsidian_first_stuff/twj1/`, read/search/show/create
3. **Notes** (`/api/notes/*`) — Simple notes CRUD, separate from both

The CLI should present a unified interface. Decision needed: which backend does `ema vault *` talk to? How do `ema wiki *` and `ema vault *` differ? Write ADR if these need consolidation.

---

## Execution Plan

### Phase 1: Audit + Architecture (no code changes to CLI)

**Sub-agent 1 — CLI Audit Agent**
- Input: `scripts/ema` (full source)
- Task: Produce `docs/cli/00-reality-map.md` per Step 0 spec above
- Acceptance: document covers every existing command, every daemon endpoint, coverage gap matrix

**Sub-agent 2 — Daemon API Agent**
- Input: `daemon/lib/ema_web/router.ex`, all controllers
- Task: Produce `docs/cli/api-surface.md` — every REST endpoint with method, path, params, response shape
- Focus domains: responsibilities, seeds, engine, superman, vault CRUD, pipes, sessions, evolution, campaigns, channels, gaps, babysitter, dispatch-board
- Acceptance: document is a complete REST contract reference. Every endpoint annotated with CLI coverage status.

**Gate:** Phase 1 is complete when both documents exist and are reviewed. Do not write implementation code until Phase 1 passes.

### Phase 2: Architecture Decisions

Using Phase 1 outputs, write the ADR documents:
- `docs/cli/02-spaces-strategy.md`
- `docs/cli/03-node-model.md`
- `docs/cli/decisions/001-command-architecture.md` — covering: resolver pattern, plugin/extension hooks, deprecation policy, alias registry
- `docs/cli/decisions/002-vault-wiki-consolidation.md` — how vault/wiki/obsidian/notes unify in CLI

**Gate:** All ADRs written and internally consistent.

### Phase 3: Command Tree + Extensibility Foundation

- Formalize `docs/cli/01-command-tree.md` (adapt the canonical tree above based on Phase 1/2 findings)
- Propose the minimal refactor to support the tree cleanly. Write `docs/cli/decisions/003-cli-refactor.md` if needed.
- Implement the extensibility scaffolding:
  - Command group auto-discovery (file-based or registry-based)
  - Shared output formatter (human + JSON modes)
  - Shared object resolver (ID / slug / path resolution)
  - Global flag registration
  - Error handler with structured JSON errors

**Sub-agent 3 — Extensibility Agent**
- Input: `scripts/ema`, Phase 1 reality map, command tree doc
- Task: Implement the shared infrastructure above. No new user-facing commands — just the plumbing.
- Acceptance: `ema --help` renders the new command tree. `--json` and `--space` flags parse on every command. Object resolver works with test cases.

**Gate:** Scaffolding merged. All existing commands still work. New group structure renders in help.

### Phase 4: First Implementation Slice

Pick the single highest-value command group to implement first. Selection criteria:
1. Daemon endpoints already exist (no backend work needed)
2. Unlocks the most downstream capability
3. Exercises the new scaffolding (resolver, JSON output, space scoping)

**Likely candidates (in priority order):**
1. `ema responsibility *` — uncovered, exercises space scoping, agents need it
2. `ema seed *` + `ema engine *` — uncovered, controls proposal engine
3. `ema superman *` — uncovered, high value for agent tool surface
4. `ema vault *` (full CRUD) — partially covered, extends existing search
5. `ema pipe *` — uncovered, enables automation

**Sub-agent 4 — Implementation Agent**
- Input: target command group, daemon API doc, extensibility scaffolding
- Task: Implement full CRUD for the chosen group using the new architecture
- Acceptance: all commands in the group work in both human and JSON mode. Object resolution works. Tests pass.

### Phase 5: Node MVP

**Sub-agent 5 — Node Agent**
- Input: node model ADR, daemon API doc
- Task: Implement `ema node *` commands per the MVP spec
- Must demonstrate: register agent-vm as a node, ping it, SSH to it, show topology
- Acceptance: `ema node list` shows both main-machine and agent-vm. `ema node ping agent-vm` returns health. `ema node ssh agent-vm` opens a shell.

### Phase 6: Remaining Coverage

Systematically close gaps from the reality map. Priority order:
1. Domains with existing daemon endpoints but no CLI commands
2. Domains that agents need as tool surfaces
3. Convenience / ergonomic commands

Each domain is a sub-agent task with the same pattern: implement group, test both output modes, update reality map.

---

## Rules

1. **Do not overbuild.** Ship the smallest thing that works. Iterate.
2. **Do not invent backend support where daemon endpoints already solve it.** Wire first, invent second.
3. **Do not design a fantasy P2P mesh.** Define the smallest simulation that proves the model between main-machine and agent-vm.
4. **Prefer daemon parity first, then CLI polish.** Coverage > aesthetics.
5. **Prefer machine-usable CLI over pretty CLI.** Agents are a first-class user.
6. **Treat wiki/superman as first-class, not an afterthought.** This is the knowledge layer that makes everything else intelligent.
7. **Every command must work in `--json` mode.** No exceptions.
8. **If you hit a structural incompatibility,** document it and stop. Propose the minimal change. Do not unilaterally rewrite.
9. **Commit granularly.** One command group per commit, not a massive dump.
10. **Test as you go.** After implementing each group, verify all commands work standalone AND in `--json` mode.

---

## Success Condition

At the end of this pass, we know exactly:
- How the CLI reflects EMA's real capabilities (reality map)
- How spaces/databases/nodes/wiki fit together (ADRs)
- What the canonical command tree looks like (command tree doc)
- What extensibility architecture supports growth (scaffolding code)
- What the first implementation slice is and why (implemented + working)
- What the P2P node model looks like in MVP form (working main↔agent-vm)

## After Completion — Single Next Instruction

End your final report with one exact instruction the human can give next to continue buildout.
