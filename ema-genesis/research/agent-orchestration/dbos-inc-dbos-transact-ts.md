---
id: RES-dbos-transact-ts
type: research
layer: research
category: agent-orchestration
title: "dbos-inc/dbos-transact-ts — TS-native durable workflows over Postgres/SQLite checkpoints"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-a
source:
  url: https://github.com/dbos-inc/dbos-transact-ts
  stars: 1136
  verified: 2026-04-12
  last_activity: 2026-04-08
  license: MIT
signal_tier: S
tags: [research, agent-orchestration, workflow, durable, typescript, dbos, sqlite]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/temporalio-temporal]]", relation: references }
  - { target: "[[research/agent-orchestration/restatedev-restate]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
---

# dbos-inc/dbos-transact-ts

> **The closest prior art to EMA's actual stack.** TypeScript-native, MIT, no separate workflow server, Postgres-or-SQLite checkpointing. Recommend porting wholesale.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/dbos-inc/dbos-transact-ts> |
| Stars | 1,136 (verified 2026-04-12) |
| Last activity | 2026-04-08 (active) |
| Signal tier | **S** |
| License | MIT |
| Sibling | `dbos-inc/dbos-transact-py` (1,263 stars) — Python version, same model |

## What it is

Lightweight TypeScript durable workflow library. Uses Postgres (or SQLite-compatible store) as the checkpoint store. **No separate workflow server** — it's a library that sits next to your app. Workers are stateless; per-step state lives in the DB; any worker can pick up an interrupted flow.

## What to steal for EMA

### 1. The 3-phase recovery protocol (the crown jewel)

```
1. DETECT — On daemon startup, scan the DB for workflows in PENDING state
            (or via Conductor for multi-node deployments)
2. REPLAY — Re-run the workflow function from the top, but BEFORE each step
            check the DB for a checkpoint. If checkpointed, return cached
            result instead of executing. This gives idempotent re-execution.
3. RESUME — Eventually hit a step with no checkpoint. Execute normally
            from there.
```

EMA's daemon should:
- On boot, scan `executions` table for rows with status `running` and stale heartbeat → mark as PENDING
- On worker pickup, replay through cached steps until reaching the unfinished step
- Resume from that step

This is exactly the missing "agent was 80% done at step 8 of 10, machine died, resume on different node at step 8 not step 0" story EMA canon has been silent on.

### 2. The Conductor pattern

For cross-node deployments, DBOS adds **Conductor** — a lightweight coordinator that detects interrupted workflows on a dead executor and reassigns to a healthy one. EMA's daemon can host this directly: a Node `setInterval` that scans for stale leases and re-dispatches.

### 3. Postgres (or SQLite) as checkpoint store

DBOS doesn't need an external workflow service. The checkpoint table is just a sibling to your app tables. EMA uses SQLite — the **`step_checkpoints` table can live in the same `ema.db` as the `executions` table**. No new infrastructure.

Schema (port directly):
```typescript
step_checkpoints {
  workflow_id: string       // FK to executions
  step_id: string           // hash of (workflow_id, step_index, args)
  step_index: number
  status: 'pending' | 'completed' | 'failed'
  result: JSON              // cached on completion
  args_hash: string         // for replay validation
  recorded_at: timestamp
  worker_id: string         // who claimed this step
}
```

### 4. One DB write per step

Lightweight checkpointing — one row written when a step completes successfully. Plus two writes per workflow lifecycle (PENDING → RUNNING → COMPLETED|FAILED). No multi-row event log per workflow.

### 5. Python sibling for any agent-side tooling

If any EMA agent-side tooling stays in Python (e.g., embedding model, LLM bridge), `dbos-transact-py` is the same model with the same schema. Cross-runtime workflows can share the checkpoint store.

## What it changes about the blueprint

| Canon doc | What changes |
|---|---|
| `AGENT-RUNTIME.md` | Add `step_checkpoints` schema + 3-phase recovery protocol (DETECT → REPLAY → RESUME) |
| `EMA-V1-SPEC.md` execution model | Executions become a parent record with N child step_checkpoints, not a single row |
| `EMA-GENESIS-PROMPT.md §9 P2P` | Add Conductor role for cross-machine reassign |
| `[[_meta/SELF-POLLINATION-FINDINGS]]` | Listed as the recommended replacement for `Ema.Bridge` SmartRouter (the durability layer that the multi-provider router lives inside) |

## Gaps surfaced

- **EMA daemon doesn't scan-for-interrupted on boot.** Crashes leave executions in `running` state forever.
- **No step-checkpoint concept.** `Execution` is currently a single row with `status`; nothing tracks progress within a run.
- **No executor assignment table with heartbeat → reassign logic.** Cross-machine dispatch is a stub.

## Notes

- TypeScript-native, MIT license, no separate server required.
- **Most steal-able pattern for EMA's current SQLite architecture.** Round 2-A's recommendation: this is the one to port wholesale.
- Postgres-first, but SQLite is supported and is what EMA uses anyway.
- Compare with `[[research/agent-orchestration/temporalio-temporal]]` (heavier, more rigorous, Go/Java/TS SDKs) and `[[research/agent-orchestration/restatedev-restate]]` (Rust core, journal-based, exactly-once).

## Connections

- `[[research/agent-orchestration/_MOC]]`
- `[[research/agent-orchestration/temporalio-temporal]]` — heavier alternative with same core pattern
- `[[research/agent-orchestration/restatedev-restate]]` — journal-per-invocation alternative
- `[[research/agent-orchestration/inngest-inngest]]` — TypeScript event-driven alternative
- `[[canon/specs/AGENT-RUNTIME]]`
- `[[canon/specs/EMA-V1-SPEC]]` §execution model
- `[[_meta/SELF-POLLINATION-FINDINGS]]` — SmartRouter replacement entry

#research #agent-orchestration #signal-S #dbos #workflow #durable #typescript #sqlite
