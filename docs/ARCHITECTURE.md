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
Proposals ◄── IntentMap   Pipes/DCC    Claude Sessions
    │              │          │               │
    ▼              ▼          ▼               ▼
Seeds ────→ Combiner    EventBus ──→ Workflow Events
    │                                        │
    ▼                                        ▼
Pattern Crystallizer ◄──── Workflow Observatory
                                     │
                                     ▼
                              Project Graph
                           (aggregates everything)
```

### Dependency Graph (build order)

```
1. Execution Fabric + DCC     (foundation — everything routes through this)
   ↓
2. Workflow Observatory        (needs execution events to observe)
   ↓
3. Proposal Intelligence       (needs observatory data for validation)
   ↓
4. Decision Memory             (needs proposal outcomes to link decisions)
   ↓
5. Intent-Driven Analysis      (needs decision memory for precedent)
   ↓
6. Autonomous Reasoning        (needs all above to make autonomous choices)
   ↓
7. Pattern Crystallizer        (needs workflow data to detect patterns)
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
app/
├── src/
│   ├── App.tsx              # Router — maps app IDs to components
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Launchpad.tsx    # Home screen with app tiles
│   │   │   ├── Shell.tsx        # Window chrome wrapper
│   │   │   └── AppTile.tsx      # Individual tile component
│   │   ├── brain-dump/          # Brain dump capture + inbox
│   │   ├── tasks/               # Kanban board + task detail
│   │   ├── proposals/           # Proposal cards + pipeline view
│   │   ├── agents/              # Agent grid + chat interface
│   │   ├── vault/               # Second Brain file browser + editor
│   │   ├── project-graph/       # Force-directed knowledge graph ← NEW
│   │   └── ...
│   ├── stores/                  # Zustand stores (one per domain)
│   │   ├── graph-store.ts       # Project graph state ← NEW
│   │   └── ...
│   ├── lib/
│   │   ├── api.ts               # REST client (Tauri HTTP plugin)
│   │   └── ws.ts                # Phoenix WebSocket client
│   └── types/
│       └── workspace.ts         # App config definitions
└── package.json
```

### Store Pattern

Every store follows the same contract:
1. `loadViaRest()` — initial data fetch via REST
2. `connect()` — join WebSocket channel for real-time updates (optional)
3. Domain-specific actions and selectors
4. Zustand `create()` with `(set, get)` pattern
