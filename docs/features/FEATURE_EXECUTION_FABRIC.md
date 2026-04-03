# Feature: Execution Fabric + DCC Engine

## What It Does

The connective tissue between thinking and doing. Transforms brain dump items into tracked, delegated, completed work with schema-based output routing.

**Pipeline:** Brain Dump → Triage → Task/Proposal → Execution → Agent Session → Result → Vault

**DCC (Dynamic Composition Contracts):** Agents declare output schemas. The DCC engine routes outputs to the correct consumer, enables multi-agent synthesis (Agent A output + Agent B output → synthesized result), and persists workflow sessions across restarts.

## Why It Matters

Without execution fabric, EMA is a collection of apps that don't talk to each other. This is the nervous system. Every other feature depends on the execution pipeline being robust.

## How It Works (Technical)

### Current Implementation

- `Ema.BrainDump` — CRUD for inbox items. Fields: content, source, processed, action, project_id
- `Ema.Tasks` — Task lifecycle with parent/child and blocking. Status: backlog → todo → in_progress → review → done
- `Ema.Executions` — Runtime objects linking intent → proposal → agent session → result. Event-sourced via `execution_events` table
- `Ema.Agents.AgentWorker` — GenServer per agent, manages Claude CLI invocation
- `Ema.Pipes.Executor` — Condition evaluation + action firing for automation pipes
- `Ema.Pipes.EventBus` — Domain event broadcasting for pipe triggers

### Planned: DCC Engine

```elixir
defmodule Ema.Pipes.DccBlock do
  use GenServer
  
  # A DCC block waits for N inputs matching declared schemas,
  # then executes a synthesis function
  defstruct [:contract_id, :required_schemas, :synthesis_fn, :collected_inputs, :state]
  
  # When all required inputs arrive → execute synthesis → emit output
end
```

### Planned: Schema Router

```elixir
defmodule Ema.Pipes.SchemaRouter do
  # Agents declare their output schema at registration
  # When agent produces output, router matches schema → routes to waiting DCC blocks
  # Unmatched outputs go to a dead-letter queue for review
end
```

## Current Status

- ✅ Brain dump capture/process working
- ✅ Task CRUD with full lifecycle
- ✅ Execution tracking with event sourcing
- ✅ Agent worker with Claude CLI invocation
- ✅ Pipe automation (condition → action)
- ❌ Schema routing not implemented
- ❌ DCC blocks not implemented
- ❌ Workflow session persistence not implemented

## Implementation Steps

1. Create `Ema.Pipes.SchemaRouter` — registry of agent output schemas, matching logic
2. Create `Ema.Pipes.DccBlock` GenServer — collects inputs, fires synthesis
3. Create `workflow_sessions` migration — persists in-progress workflows
4. Extend `Pipes.Executor` to support schema-routed outputs
5. Add schema declaration to `AgentWorker` registration
6. Wire EventBus events through schema router

## Data Structures

### Execution
| Field | Type | Description |
|---|---|---|
| id | string | Unique ID |
| title | string | Human-readable name |
| objective | string | What this execution aims to achieve |
| status | enum | created, approved, delegated, running, completed, failed, cancelled |
| mode | string | Execution mode (e.g., "agent", "manual", "pipe") |
| intent_slug | string | Link to Superman intent folder |
| proposal_id | string | Origin proposal (nullable) |
| project_slug | string | Parent project |
| brain_dump_item_id | string | Origin brain dump item (nullable) |

### DCC Contract (Planned)
| Field | Type | Description |
|---|---|---|
| contract_id | string | Unique contract ID |
| required_schemas | list | List of input schemas that must arrive |
| synthesis_fn | function | How to combine inputs |
| timeout_ms | integer | Max wait time for all inputs |
| output_schema | map | Schema of the synthesized output |

## API Surface

| Endpoint | Method | Description |
|---|---|---|
| `/api/executions` | GET | List executions (filterable by status, project) |
| `/api/executions/:id` | GET | Show execution detail |
| `/api/executions` | POST | Create new execution |
| `/api/executions/:id/approve` | POST | Approve an execution |
| `/api/executions/:id/cancel` | POST | Cancel an execution |
| `/api/executions/:id/events` | GET | Event history |
| `/api/executions/:id/agent-sessions` | GET | Linked agent sessions |

## Next Steps

1. Build SchemaRouter + DccBlock (Phase 2 keystone)
2. Add workflow session persistence
3. Wire into Proposal Intelligence for auto-execution of approved proposals
