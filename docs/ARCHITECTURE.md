# EMA Architecture

## System Overview

EMA is a Phoenix + React desktop OS that connects thinking to doing. Three layers:

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Tauri + React 19)            │
│  Launchpad → App windows → WebSocket channels → REST     │
├─────────────────────────────────────────────────────────┤
│                    Phoenix Backend (port 4488)            │
│  Router → Controllers → Context Modules → PubSub         │
│  Channels → Presence → GenServers (Intelligence layer)   │
├─────────────────────────────────────────────────────────┤
│                    Data Layer                             │
│  SQLite (Ecto) → SecondBrain (vault) → Superman (.sup/)  │
│  Claude Sessions (.claude/) → Token Tracking              │
└─────────────────────────────────────────────────────────┘
```

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

### Feature Status

| # | Feature | Status | Key Modules |
|---|---------|--------|-------------|
| 1 | Execution Fabric | **Working** | `Executions.Dispatcher`, `AgentSession`, `Claude.Runner` |
| 2 | Workflow Observatory | **Partial** | `Executions.Event` (event sourcing), gaps, tokens |
| 3 | Proposal Intelligence | **Working** | `ProposalEngine.*` (5-stage pipeline) |
| 4 | Decision Memory | **Schema only** | `Decisions` context + controller — no mining/linking |
| 5 | Intent-Driven Analysis | **Partial** | `IntentMap` context — 5-level hierarchy, no Superman wiring |
| 6 | Project Graph | **Working** | `Intelligence.ProjectGraph` — aggregates all data sources |
| 7 | Pattern Crystallizer | **Not started** | Spec at `docs/features/FEATURE_PATTERN_CRYSTALLIZER.md` |
| 8 | Autonomous Reasoning | **Not started** | Spec at `docs/features/FEATURE_AUTONOMOUS_REASONING.md` |

### Build Order (remaining work)

```
Currently working:
  Execution Fabric ✅ → Proposal Intelligence ✅ → Project Graph ✅

Next to build:
  Workflow Observatory (needs execution events — already emitting)
    ↓
  Decision Memory (needs outcome linking)
    ↓
  Intent Analysis + Superman integration
    ↓
  Pattern Crystallizer (needs workflow history)
    ↓
  Autonomous Reasoning (needs all above)
```

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

### WebSocket Channels

Frontend connects via Phoenix channels at `ws://localhost:4488/socket/websocket`.

Each app component joins its relevant channel(s) on mount:
- `BrainDumpApp` → `brain_dump:queue`
- `TasksApp` → `tasks:lobby` or `tasks:{projectId}`
- `ProposalsApp` → `proposals:lobby`
- `AgentsApp` → `agents:lobby`

Real-time sync pattern: REST load on mount → channel join → push events update store.

## Key Modules

### Context Modules (Ecto-backed)

| Module | Schema(s) | Purpose |
|---|---|---|
| `Ema.Projects` | `Project` | Workspace with memory; links tasks/proposals/sessions |
| `Ema.Tasks` | `Task`, `Comment` | Full task management with parent/child, blocking |
| `Ema.Proposals` | `Proposal`, `Seed`, `ProposalTag` | Autonomous ideation pipeline |
| `Ema.Executions` | `Execution`, `Event`, `AgentSession` | Runtime execution tracking |
| `Ema.BrainDump` | `BrainDumpItem` | Zero-friction capture inbox |
| `Ema.Goals` | `Goal`, `Milestone` | Objective tracking with milestones |
| `Ema.SecondBrain` | `Note` | Vault/knowledge base integration |

### Intelligence Layer (GenServers + Analysis)

| Module | Type | Purpose |
|---|---|---|
| `Ema.Intelligence.IntentMap` | Context + queries | 5-level intent hierarchy (Product→Implementation) |
| `Ema.Intelligence.SupermanClient` | HTTP client | Interfaces with Superman codebase indexer |
| `Ema.Intelligence.Gap` | Analysis | Gap detection across 7 sources |
| `Ema.Intelligence.ProjectGraph` | Analysis | Live knowledge graph across all data sources |
| `Ema.ProposalEngine.Generator` | GenServer | Produces proposals from seeds on schedule |
| `Ema.ProposalEngine.Combiner` | GenServer | Cross-pollinates related proposals hourly |
| `Ema.TokenTracker` | GenServer | Records API costs, detects spikes, enforces budgets |

### Automation Layer

| Module | Purpose |
|---|---|
| `Ema.Pipes.Executor` | Evaluates pipe conditions, fires actions |
| `Ema.Pipes.EventBus` | Broadcasts domain events for pipe triggers |
| `Ema.Agents.AgentWorker` | GenServer per agent; manages Claude CLI invocation |
| `Ema.Agents.AgentMemory` | Conversation compression for agent context windows |
| `Ema.ClaudeSessions.SessionWatcher` | Polls .claude/ JSONL every 30s, imports sessions |

## SQLite Schema (Key Tables)

| Table | Key Fields | Notes |
|---|---|---|
| `projects` | id, name, slug, status, description, context, github_url | Workspace anchor |
| `tasks` | id, title, status, priority, effort, project_id, parent_id | With blocking relationships |
| `proposals` | id, title, body, status, score, project_id, seed_id, parent_proposal_id | Genealogy via parent/seed |
| `seeds` | id, prompt, source, project_id, generation | Proposal origin material |
| `executions` | id, title, objective, status, mode, intent_slug, proposal_id, project_slug | Runtime execution objects |
| `execution_events` | id, execution_id, event_type, payload | Event sourcing for executions |
| `agent_sessions` | id, execution_id, agent_id, status, duration_ms, output_path | Agent run tracking |
| `brain_dump_items` | id, content, source, processed, action, project_id | Capture inbox |
| `intent_nodes` | id, title, level, parent_id, project_id, status | 5-level intent hierarchy |
| `gaps` | id, source, gap_type, title, severity, status, project_id | System friction points |
| `token_records` | id, model, input_tokens, output_tokens, cost, scope | API cost tracking |

## Frontend Architecture

```
app/src/
├── App.tsx                     # Route switch — maps 50+ app IDs to components
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
│   └── ...                     # 50+ total app components
├── stores/                     # 60+ Zustand stores (one per domain)
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

Shell.tsx loads 28 stores in parallel on startup via `Promise.all`.
