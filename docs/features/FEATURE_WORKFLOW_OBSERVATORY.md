# Feature: Workflow Observatory

## What It Does

Provides visibility into how work flows through EMA — where ideas originate, what they become, where things get stuck, and what they cost.

Four subsystems:
1. **Genealogy DAG** — traces idea lineage (seed → proposal → child proposals → executions → outcomes)
2. **Intent Logger** — logs the "why" on every dispatch
3. **Friction Map** — heatmap of where work gets stuck
4. **Budget Monitor** — tracks quality degradation from model/token constraints

## Why It Matters

Execution without observation is blind. The observatory answers:
- Where did this idea originate? (Genealogy)
- Why was this dispatched? (Intent Logger)
- What's blocking progress? (Friction Map)
- Are we degrading quality to save tokens? (Budget Monitor)

## How It Works (Technical)

### Genealogy DAG (Partially Existing)

Proposals already track `parent_proposal_id` and `seed_id`. The Combiner creates cross-pollination seeds.

```
Seed A ─→ Proposal 1 ─→ Execution 1 ─→ Result 1
           ↓
          Proposal 1.1 (child) ─→ Execution 2 ─→ Result 2
           
Seed B ─→ Proposal 2
           ↓
          Combiner merges Prop 1 + Prop 2 → Seed C → Proposal 3
```

**Planned:** Explicit `workflow_events` table tracking every state transition as a graph edge.

### Intent Logger

Every dispatch records: who requested it, why (intent), what context was available, which agent was chosen, what the expected output was.

### Friction Map

Extend `Ema.Intelligence.Gap` with time-series data. Track:
- Tasks stuck in a status > N days
- Proposals cycling between statuses
- Agent sessions with high failure rates
- Brain dump items never processed

### Budget Monitor

Extend `Ema.TokenTracker` with quality gradient detection:
- When cheaper models produce lower-quality outputs (user rejects, re-runs needed)
- When token limits cause truncation
- Cost per successful outcome (not just cost per API call)

## Current Status

- ✅ Proposal genealogy (parent_proposal_id, seed_id) — working
- ✅ Combiner cross-pollination — working
- ✅ GapScanner (7 sources, hourly) — working
- ✅ TokenTracker (cost recording, spike detection) — working
- ❌ workflow_events table — not created
- ❌ Intent logging — not implemented
- ❌ Friction map heatmap — not implemented
- ❌ Budget awareness / quality gradient — not implemented
- ❌ Observatory dashboard UI — not implemented

## Implementation Steps

1. Migration: create `workflow_events` table (execution_id, event_type, parent_event_id, payload, timestamp)
2. Create `Ema.Observatory.WorkflowEvent` schema + context
3. Create `Ema.Observatory.Genealogy` — DAG query functions (ancestors, descendants, full lineage)
4. Create `Ema.Observatory.IntentLogger` — hook into Execution.Dispatcher to log intent
5. Create `Ema.Observatory.FrictionMap` — time-series analysis of blocked/stalled items
6. Create `Ema.Observatory.BudgetMonitor` — quality gradient detection
7. Create `EmaWeb.ObservatoryController` — API for all observatory data
8. Build observatory dashboard React components

## Data Structures

### WorkflowEvent (Planned)
| Field | Type | Description |
|---|---|---|
| id | string | Event ID |
| execution_id | string | Parent execution |
| event_type | string | created, dispatched, completed, failed, stalled |
| parent_event_id | string | DAG edge to parent event |
| actor | string | Who/what caused this event |
| intent | string | Why this happened |
| payload | json | Event-specific data |
| inserted_at | datetime | Timestamp |

## API Surface

| Endpoint | Method | Description |
|---|---|---|
| `/api/observatory/events` | GET | List workflow events (filterable) |
| `/api/observatory/genealogy/:id` | GET | Full lineage DAG for an execution |
| `/api/observatory/friction` | GET | Current friction map |
| `/api/observatory/budget` | GET | Budget awareness metrics |

## Next Steps

1. Create workflow_events migration + schema
2. Hook intent logger into execution dispatcher
3. Build friction map from existing gap data + time series
4. Build observatory dashboard
