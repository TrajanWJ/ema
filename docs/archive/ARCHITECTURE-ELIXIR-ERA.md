# EMA Architecture

> **Status:** As-built, April 2026
> **Stack:** Elixir/Phoenix 1.8 daemon + Tauri 2 + React 19 + Zustand + SQLite
> **Port:** Daemon runs on `localhost:4488`

---

## System Overview

EMA is a Phoenix + React desktop OS that connects thinking to doing. Three layers:

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Tauri + React 19)            │
│  Launchpad → 80+ app windows → WebSocket channels → REST │
├─────────────────────────────────────────────────────────┤
│                    Phoenix Backend (port 4488)            │
│  Router (318 routes) → 80 Controllers → 55+ Contexts    │
│  37 Channels → GenServers (Intelligence/Quality/etc.)    │
├─────────────────────────────────────────────────────────┤
│                    Data Layer                             │
│  SQLite (Ecto, 84 schemas, 86 migrations)               │
│  SecondBrain (vault) → Superman (.sup/) → MCP Server     │
│  Claude Sessions (.claude/) → Token Tracking              │
└─────────────────────────────────────────────────────────┘
```

---

## Supervision Tree

The application starts children in `Ema.Application.start/2`. The tree has two tiers: **always-on** children and **conditional** children gated by config flags.

### Always-On Children

| Child | Purpose |
|-------|---------|
| `EmaWeb.Telemetry` | Telemetry event handlers |
| `Ema.Repo` | SQLite database connection |
| `Ecto.Migrator` | Auto-run migrations |
| `DNSCluster` | DNS-based node discovery |
| `Phoenix.PubSub` | In-process pub/sub (name: `Ema.PubSub`) |
| `Ema.Babysitter.Supervisor` | System observability and Discord stream-of-consciousness |
| `Ema.Feedback.Supervisor` | Discord delivery consumers + EMA internal visibility |
| `Registry` (Agents) | Process registry for agent workers |
| `Task.Supervisor` | Named task supervisor (`Ema.TaskSupervisor`) |
| `Ema.Prompts.Loader` | Loads prompt templates from disk |
| `Ema.Prompts.Optimizer` | Prompt A/B testing and optimization |
| `Ema.Agents.Supervisor` | DynamicSupervisor for per-agent process trees |
| `Ema.Agents.NetworkMonitor` | Agent network health monitoring |
| `Ema.Claude.SessionManager` | AI session lifecycle management |
| `Ema.Claude.BridgeDispatch` | Async Claude dispatch with request tracking and retries |
| `Ema.Focus.Timer` | Focus timer GenServer |
| `Ema.Pipes.Supervisor` | Workflow automation (Registry -> Loader -> Executor) |
| `Ema.Ingestor.Processor` | Ingest job processor (URL/file -> vault) |
| `Ema.Intelligence.TokenTracker` | Token usage and cost tracking |
| `Ema.Executions.Dispatcher` | Routes approved proposals to agent execution |
| `Ema.Intelligence.TrustScorer` | Agent trust score computation |
| `Ema.Intelligence.VmMonitor` | VM health monitoring |
| `Ema.Intelligence.CostForecaster` | Token cost forecasting |
| `Ema.Intelligence.SessionMemoryWatcher` | Session memory extraction |
| `Ema.Intelligence.GapScanner` | System gap detection |
| `Ema.Intelligence.ContextIndexer` | Project context indexing |
| `Ema.Intelligence.AgentSupervisor` | Intelligence agent workers |
| `Ema.Intelligence.AutonomyConfig` | Autonomy level configuration |
| `Ema.Intelligence.UCBRouter` | Upper confidence bound routing |
| `Ema.Intelligence.PromptVariantStore` | Prompt variant tracking for A/B |
| `Ema.Intelligence.VaultLearner` | Learns patterns from vault content |
| `Registry` (Projects) | Process registry for project workers |
| `DynamicSupervisor` (Projects) | Per-project context caching workers |
| `Registry` (CLI Manager) | Process registry for CLI session runners |
| `DynamicSupervisor` (CLI Manager) | CLI session runner processes |
| `EmaWeb.Endpoint` | Phoenix HTTP/WS endpoint (last to start) |

### Conditional Children

| Guard | Children | Config Key |
|-------|----------|------------|
| `start_session_store` | `Ema.Persistence.SessionStore` | `:start_session_store` |
| `start_campaign_manager` | `Ema.Campaigns.CampaignManager` | `:start_campaign_manager` |
| `start_quality` | `Ema.Quality.Supervisor` | `:start_quality` |
| `start_orchestration` | `Ema.Orchestration.Supervisor` | `:start_orchestration` |
| `ai_backend == :bridge` | `Ema.Claude.BridgeSupervisor`, `Ema.Claude.ExecutionSupervisor` | `:ai_backend` |
| `start_claude_sessions` | `Ema.ClaudeSessions.Supervisor` | `:start_claude_sessions` |
| `start_cluster` | `Ema.Claude.NodeCoordinator` | `:start_cluster` (default false) |
| `start_canvas` | `Ema.Canvas.Supervisor` | `:start_canvas` |
| `start_second_brain` | `Ema.Superman.Supervisor` | `:start_second_brain` |
| `start_second_brain` | `Ema.SecondBrain.Supervisor` | `:start_second_brain` |
| `start_otp_workers` | `Ema.Responsibilities.Supervisor` | `:start_otp_workers` |
| `proposal_engine.enabled` | `Ema.Vectors.Supervisor`, `Ema.ProposalEngine.Supervisor` | `:proposal_engine` |
| `metamind.enabled` | `Ema.MetaMind.Supervisor` | `:metamind` |
| `evolution_engine` | `Ema.Evolution.Supervisor` | `:evolution_engine` |
| `start_voice` | `Ema.Voice.Supervisor`, `Ema.Discord.Bridge` | `:start_voice` |
| `start_git_watcher` | `Ema.Intelligence.GitWatcher` | `:start_git_watcher` |
| `start_harvesters` | `Ema.Harvesters.Supervisor` | `:start_harvesters` |
| `start_temporal` | `Ema.Temporal.Engine` | `:start_temporal` |
| `start_openclaw` | `Ema.OpenClaw.AgentBridge`, `EventIngester`, `ChannelDelivery` | `:start_openclaw` |
| `openclaw_vault_sync.enabled` | `Ema.Integrations.OpenClaw.VaultSyncSupervisor` | `:openclaw_vault_sync` |
| `mcp_server.enabled` | `Ema.MCP.Server` | `:mcp_server` |

### Post-Boot Tasks

- `Ema.PluginRegistry.init()` — Initializes plugin hook registry
- `Ema.Hooks.init()` — Initializes event hooks
- `Ema.Intelligence.BudgetEnforcer.install()` — Installs fuse circuit breakers
- `Ema.Agents.OpenClawSync.sync()` — Seeds agents (2s delay, async)
- `Ema.SecondBrain.Indexer.reindex_all()` — Populates FTS index (3s delay, async)

---

## Module Organization (55+ Contexts)

### Core CRUD Contexts

| Module | Schema(s) | Purpose |
|--------|-----------|---------|
| `Ema.BrainDump` | `Item` | Inbox capture — quick thoughts, links, ideas |
| `Ema.Tasks` | `Task`, `Comment` | Actionable work items with status transitions |
| `Ema.Projects` | `Project` | Workspaces with linked paths, context docs |
| `Ema.Proposals` | `Proposal`, `Seed`, `ProposalTag` | AI-generated ideas queued for review |
| `Ema.Habits` | `Habit`, `HabitLog` | Daily habits with streak tracking |
| `Ema.Journal` | `Entry` | Daily journal with mood/energy, full-text search |
| `Ema.Settings` | `Setting` | Key-value app configuration |
| `Ema.Workspace` | `WindowState` | Per-app window position/size persistence |
| `Ema.Responsibilities` | `Responsibility`, `CheckIn` | Recurring obligations with health scores |
| `Ema.Goals` | `Goal` | Goal tracking with CRUD + controller |
| `Ema.Focus` | `Session`, `Block` | Focus timer with GenServer (`Ema.Focus.Timer`) |
| `Ema.Notes` | `Note` | Simple notes (separate from SecondBrain vault) |
| `Ema.Canvas` | `Canvas`, `Element`, `CanvasTemplate` | Visual workspaces with live data |
| `Ema.Contacts` | `Contact` | CRM — contacts with tags, status |
| `Ema.Finance` | `Transaction` | Income/expense tracking |
| `Ema.Invoices` | `Invoice` | Invoicing tied to contacts + projects |
| `Ema.Meetings` | `Meeting` | Meeting scheduling with attendees |
| `Ema.Routines` | `Routine` | Repeatable step sequences |
| `Ema.Clipboard` | `Clip` | Shared clipboard with pinning |
| `Ema.FileVault` | `ManagedFile` | File storage with tagging |
| `Ema.Decisions` | `Decision` | Decision log with options, reasoning, outcomes |
| `Ema.Ingestor` | `IngestJob` | External content import pipeline (URL -> vault) |
| `Ema.Org` | `Organization`, `Member`, `Invitation` | Multi-org support |
| `Ema.Spaces` | `Space`, `Member` | Context isolation (Work/Personal/Health/etc.) |
| `Ema.AppShortcuts` | `AppShortcut` | Keyboard shortcut bindings |

### Execution & Automation

| Module | Schema(s) | Purpose |
|--------|-----------|---------|
| `Ema.Executions` | `Execution`, `Event`, `AgentSession` | Runtime execution tracking with event sourcing |
| `Ema.Pipes` | `Pipe`, `PipeAction`, `PipeTransform`, `PipeRun` | Workflow automation engine |
| `Ema.Campaigns` | `Campaign`, `CampaignRun`, `Flow` | Multi-step campaign orchestration |
| `Ema.Pipeline` | `CampaignFlow` | Pipeline analytics |
| `Ema.Routing` | — | Intent classification and routing |

### AI & Intelligence

| Module | Key Components | Purpose |
|--------|---------------|---------|
| `Ema.Claude` | `Runner`, `SessionManager`, `BridgeDispatch`, `BridgeSupervisor` | Claude CLI integration, session management, async dispatch |
| `Ema.Claude.Adapters` | `ClaudeCLI`, `CodexCLI`, `Ollama`, `OpenRouter` | Multi-provider AI adapters |
| `Ema.ClaudeSessions` | `SessionWatcher`, `SessionMonitor`, `SessionParser` | Import and track host Claude Code sessions |
| `Ema.Agents` | `AgentWorker`, `AgentMemory`, `NetworkMonitor` | Per-agent supervision with memory compression |
| `Ema.ProposalEngine` | `Scheduler`, `Generator`, `Refiner`, `Debater`, `Tagger`, `Combiner`, `KillMemory` | 5-stage autonomous proposal pipeline |
| `Ema.Intelligence` | 40+ modules | Token tracking, trust scoring, gap scanning, intent mapping, context indexing, project graph, session memory, UCB routing, autonomy config, vault learning |
| `Ema.MetaMind` | `Pipeline`, `Researcher`, `Reviewer`, `Interceptor` | Prompt research and quality pipeline |
| `Ema.Orchestration` | `RoutingEngine`, `AgentFitnessStore`, `SpecializationAutotune` | Agent orchestration and fitness tracking |
| `Ema.Quality` | `QualityGradient`, `FrictionDetector`, `BudgetLedger`, `ThreatModelAutomaton`, `AutonomousImprovementEngine` | Quality monitoring and autonomous improvement |
| `Ema.Vectors` | `Embedder`, `Index` | Vector embeddings for semantic search |
| `Ema.Prompts` | `Loader`, `Optimizer`, `Prompt`, `PromptTemplate` | Prompt management with A/B testing |

### Knowledge & Vault

| Module | Key Components | Purpose |
|--------|---------------|---------|
| `Ema.SecondBrain` | `VaultWatcher`, `GraphBuilder`, `SystemBrain`, `Indexer` | Vault sync, wikilink graph, FTS indexing |
| `Ema.Superman` | `Context`, `Fallback`, `IntentParser`, `KnowledgeGraph` | Code intelligence and codebase understanding |
| `Ema.Memory` | `ContextAssembler`, `SessionEntry`, `UserFact`, `CrossPollination` | Session memory, user facts, cross-project learning |
| `Ema.Persistence` | `SessionStore`, `DccRecord` | DCC primitive persistence |

### System & Observability

| Module | Key Components | Purpose |
|--------|---------------|---------|
| `Ema.Babysitter` | `StreamTicker`, `SessionObserver`, `SessionResponder`, `AnomalyScorer`, `PatternMatcher`, `VisibilityHub`, `ChannelManager`, `ActiveSprintMonitor` | System observability, Discord stream-of-consciousness |
| `Ema.Feedback` | `Consumer`, `DiscordDelivery`, `Broadcast` | Discord delivery + internal feedback visibility |
| `Ema.Evolution` | `SignalScanner`, `Proposer`, `Applier`, `InstructionParser` | Self-modifying behavior rules |
| `Ema.Temporal` | `Engine`, `Rhythm`, `EnergyLog` | Temporal patterns — energy/focus tracking |
| `Ema.Voice` | `VoiceCore`, `CommandParser`, `Conversation`, `TtsEngine` | Voice command processing |
| `Ema.Discord` | `Bridge` | Discord bot bridge |
| `Ema.Harvesters` | `GitHarvester`, `SessionHarvester`, `VaultHarvester`, `UsageHarvester`, `BrainDumpHarvester` | Automated data harvesting |
| `Ema.CliManager` | `CliTool`, `CliSession` | CLI tool/session management |
| `Ema.MCP` | `Server`, `Tools`, `Resources`, `Protocol`, `RecursionGuard` | MCP server for external AI tool access |
| `Ema.OpenClaw` | `AgentBridge`, `EventIngester`, `ChannelDelivery` | OpenClaw gateway integration |
| `Ema.Integrations.OpenClaw` | `VaultSyncSupervisor`, `SyncEntry` | External vault sync from OpenClaw instances |

---

## Feature Interconnection

```
Brain Dump ──→ Tasks ──→ Executions ──→ Agent Sessions
    │              │          │               │
    ▼              ▼          ▼               ▼
Proposals ◄── IntentMap   Pipes         Claude Sessions
    │              │          │               │
    ▼              ▼          ▼               ▼
Seeds ────→ Combiner    EventBus        Project Graph
                                     (aggregates everything)
```

---

## Data Flow

### Brain Dump → Execution Pipeline

```
User input
  → BrainDump.create_item/1
  → PubSub broadcast "brain_dump:created"
  → (manual or pipe-driven) BrainDump.process_item/2
  → Creates Task or Proposal
  → If Task: Task lifecycle (backlog → todo → in_progress → done)
  → If Proposal: Proposal pipeline (queued → pending → approved/killed)
  → If approved: Execution.create/1
  → Execution.Dispatcher delegates to AgentWorker
  → AgentWorker invokes Claude CLI
  → Results stored in agent_sessions table
  → SessionWatcher imports from .claude/ JSONL
  → Harvested results → Vault notes / Task updates / PR links
```

### PubSub Topology

| Topic Pattern | Publisher | Subscribers | Events |
|---|---|---|---|
| `brain_dump:queue` | BrainDumpController | BrainDumpChannel | item_created, item_processed |
| `tasks:lobby` | Tasks context | TasksChannel | task_created, task_updated, task_deleted |
| `tasks:{project_id}` | Tasks context | TasksChannel (filtered) | task_created, task_updated |
| `proposals:lobby` | Proposals context | ProposalsChannel | proposal_created, proposal_updated, status_changed |
| `executions:lobby` | Executions context | ExecutionsChannel | execution_created, status_changed, event_added |
| `agents:lobby` | AgentWorker | AgentsChannel | agent_response, status_changed |
| `agent_chat:{id}` | AgentWorker | AgentChatChannel | message, tool_call, tool_result |
| `vault:updates` | SecondBrain | VaultChannel | note_created, note_updated |
| `pipes:events` | Pipes.EventBus | PipeChannel | event_fired, pipe_triggered |
| `dashboard:today` | DashboardController | DashboardChannel | stats_updated |
| `gaps:updates` | GapScanner | GapChannel | gap_found, gap_resolved |

---

## Web Layer

### Router

All routes under `/api`. 318 route definitions across 80 controllers.

**Major endpoint groups:**

| Group | Controller(s) | Route Count | Key Operations |
|-------|--------------|-------------|----------------|
| Projects | `ProjectController` | 7 | CRUD + context + context_fragments |
| Tasks | `TaskController` | 8 | CRUD + transition + comments + scope-advice |
| Proposals | `ProposalController` | 12 | CRUD + approve/redirect/kill/cancel + pipeline + lineage + cost |
| Seeds | `SeedController` | 7 | CRUD + toggle + run-now |
| Agents | `AgentController`, `AgentChannelController` | 12 | CRUD + chat + conversations + channels + network status |
| Executions | `ExecutionController` | 9 | CRUD + approve/cancel/complete + events + agent-sessions + diff + intent-status |
| Vault | `VaultController` | 9 | Tree, CRUD, move, search, graph + neighbors + orphans |
| Focus | `FocusController` | 12 | Timer control (start/stop/pause/resume/break) + sessions + history |
| Intelligence | Multiple | 20+ | Git sync, gaps, intent map, memory, tokens, VM health |
| Evolution | `EvolutionController` | 12 | Rules CRUD + activate/rollback/version + signals + scan + propose |
| Superman | `SupermanController` | 13 | Context, index, ask, gaps, flows, apply, intent, simulate, autonomous, build |
| Campaigns | `CampaignController` | 9 | CRUD + run/advance + run detail |
| Organizations | `OrgController` | 10 | CRUD + invitations + members + join |
| Finance | `FinanceController`, `InvoiceController` | 10 | Transactions + invoices + send/mark-paid |
| Quality | `QualityController` | 5 | Report, friction, gradient, budget, threats |
| Orchestration | `OrchestrationController` | 3 | Stats, fitness, route |
| Babysitter | `BabysitterController` | 4 | State, config, nudge, tick |
| Feedback | `FeedbackController` | 3 | Index, status, emit |
| Webhooks | `WebhookController`, `TelegramController`, `DiscordWebhookController` | 5 | GitHub, Slack, Telegram, Discord |

### WebSocket Channels (37 channels)

```
agent_chat, agent_lobby, agent_network, brain_dump, canvas,
channels, claude_session, cli_manager, dashboard, dispatch_board,
evolution, execution, focus, gap, goal, habits, intelligence,
intent, journal, memory, metamind, notes, openclaw, org, pipes,
project, prompts, proposal, responsibility, session, settings,
superman, task, temporal, vault, voice, workspace
```

---

## Frontend Architecture

```
app/src/
├── App.tsx                     # Route switch — maps 80+ app IDs to components
├── components/
│   ├── layout/                 # Shell, Dock, Launchpad, AmbientStrip, AppWindowChrome
│   ├── executions/             # Execution tracking (HQ surface)
│   ├── proposals/              # Proposal pipeline + detail view
│   ├── tasks/                  # Task board
│   ├── agents/                 # Agent fleet + chat
│   ├── vault/                  # Second Brain file browser
│   ├── project-graph/          # Force-directed knowledge graph
│   ├── contacts-crm/           # CRM
│   ├── finance-tracker/        # Income/expense
│   ├── invoice-billing/        # Invoicing
│   ├── ingestor/               # Content import UI
│   ├── evolution/              # Behavior rule management
│   ├── quality/                # Quality monitoring
│   ├── orchestration/          # Agent orchestration
│   ├── babysitter/             # System observability
│   └── ...                     # 80+ total app component directories
├── stores/                     # 72 Zustand stores (one per domain)
├── lib/
│   ├── api.ts                  # REST client (Tauri HTTP plugin)
│   └── ws.ts                   # Phoenix WebSocket singleton
├── types/
│   └── workspace.ts            # APP_CONFIGS — app metadata, dimensions, accents
└── styles/
    └── globals.css             # Glass morphism design system
```

### Store Pattern

Every store follows the same contract:
1. `loadViaRest()` — initial data fetch via REST (called by Shell on mount)
2. `connect()` — join WebSocket channel for real-time updates (optional)
3. Domain-specific actions and selectors
4. Zustand `create()` with `(set, get)` pattern

---

## Database

SQLite at `~/.local/share/ema/ema.db` via `ecto_sqlite3`.

- **84 Ecto schemas** across 55+ context modules
- **86 migrations** (March 29 – April 11, 2026)
- String IDs with 3-letter prefix + 8 random chars (e.g., `pro_a1b2c3d4`)

See `docs/DATA_MODELS.md` for full schema documentation.

---

## AI Bridge Architecture

**Status:** Bridge is active (`ai_backend: :bridge` in `config/config.exs`). `BridgeSupervisor` starts on app boot.

**Active features:** SmartRouter (multi-account rotation), QualityGate (response scoring), cost tracking (SQLite), governance audit logging, circuit breakers (soft/hard trip at 3/5 failures). Falls back gracefully to `Runner.run/2` if Bridge GenServer is unavailable.

### Provider Adapters

| Adapter | Transport | Notes |
|---------|-----------|-------|
| Claude CLI | Process spawn, `--print --output-format stream-json` | Primary adapter |
| Codex CLI | PTY wrapper via `codex exec --full-auto` | OpenAI Codex |
| Ollama | HTTP API with streaming | Local models |
| OpenRouter | HTTP with SSE streaming | Dynamic model listing |

### Routing Strategies

- **balanced** — Weighted score: 40% cost + 30% speed + 30% quality
- **cheapest** — Minimize cost per token
- **fastest** — Minimize latency
- **best** — Maximize quality score
- **round_robin** — Rotate across providers
- **failover** — Primary with ordered fallbacks

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
| Vault data | `~/.local/share/ema/vault/` |
| DB file | `~/.local/share/ema/ema.db` |
| Migrations | `daemon/priv/repo/migrations/` (86 files) |
| Seeds | `daemon/priv/repo/seeds.exs` |
