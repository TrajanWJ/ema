---
id: RES-temporal
type: research
layer: research
category: agent-orchestration
title: "temporalio/temporal — workflow-as-code with deterministic event-history replay"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-a
source:
  url: https://github.com/temporalio/temporal
  stars: 19536
  verified: 2026-04-12
  last_activity: 2026-04-12
  license: MIT
signal_tier: S
tags: [research, agent-orchestration, workflow, durable, temporal, replay]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
---

# temporalio/temporal

> The pattern EMA needs, even if EMA doesn't run Temporal itself. Source of truth is the **immutable Event History** in the Temporal service; workers are stateless caches; sticky queues optimize hot-cache replay; fall-through to any worker after lease timeout. Read the architecture, port the pattern.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/temporalio/temporal> |
| Stars | 19,536 (verified 2026-04-12) |
| Last activity | 2026-04-12 |
| Signal tier | **S** |
| Language | Go (server) + TypeScript SDK (`temporalio/sdk-typescript`, 800+ stars, first-class) |
| License | MIT |

## What it is

Workflow-as-code engine. Workflows are functions that look like normal code; the runtime records every side effect (`activity` call, `sleep`, `signal`, `query`) into an append-only **Event History** keyed by workflow execution ID. On worker crash or replay, the runtime re-executes the workflow function from the top, replaying recorded events deterministically and skipping side effects whose results are already in the history. Resumption can happen on any worker because the history is the truth, not the worker's memory.

## What to steal for EMA

### 1. The Event History schema

EMA's `Execution` row should become an event log:

```typescript
execution_events {
  execution_id: string
  event_index: number       // monotonic per execution
  event_type: 'started' | 'step_started' | 'step_completed' | 'step_failed' |
              'signal_received' | 'timer_fired' | 'completed' | 'failed'
  payload: JSON
  timestamp: timestamp
  worker_id: string?        // which worker recorded this
}
```

Replay protocol: re-run the execution function from event 0; for each new step, check if `step_completed` exists in history → return cached result; otherwise execute and append `step_completed`.

### 2. Sticky Execution + fallback (the cross-machine handoff pattern)

This is the answer to the cross-machine question canon has been silent on:

- **Sticky pinning**: a workflow execution gets pinned to its last worker via a sticky task queue with TTL (default 5s)
- **Hot cache**: the sticky worker keeps the workflow's in-memory state cached
- **Sticky timeout**: if the sticky worker doesn't claim the next task within the TTL, Temporal disables stickiness for that execution and re-enqueues to the **main task queue**
- **Any worker takes over**: any subscribed worker pulls from the main queue, replays the event history deterministically to rebuild state, and resumes execution

For EMA: per-execution event log in SQLite, workers poll a tag-filtered queue, sticky-pin to last executor via a secondary queue with TTL, fall back to main queue if sticky worker misses heartbeat.

### 3. Determinism rules

Workflow code MUST be deterministic on replay (no `Math.random()`, no `Date.now()`, no direct API calls). Side effects go through `activity` calls which are recorded. EMA should adopt the same rule for its workflow definitions: no nondeterminism in the orchestration layer; all I/O through wrapped tool calls.

### 4. The architecture doc to read

`github.com/temporalio/sdk-core/blob/master/arch_docs/sticky_queues.md` is the cleanest written explanation of the protocol. Authored by the same Temporal/Cadence team. Read this file before designing EMA's worker pool.

## What it changes about the blueprint

| Canon doc | What changes |
|---|---|
| `AGENT-RUNTIME.md` cross-machine dispatch | Add event-history log + sticky-queue + fallback pattern |
| `EMA-V1-SPEC.md` execution model | Executions become an event log, not a single row |
| `EMA-GENESIS-PROMPT.md §9` | Handoff semantics: sticky → main queue → any worker |

## Gaps surfaced

- EMA has no event-history schema for executions — just a single row per Execution
- No concept of "replay to rebuild state"
- No sticky-queue fallback semantics
- No executor heartbeat timeout that triggers re-dispatch

## Notes

- Go-native server, but the **TypeScript SDK is first-class** (not a community port). EMA could embed it directly if running a separate workflow service is acceptable.
- Heavier than DBOS for a personal app — DBOS is the lighter choice. Temporal is the gold standard if EMA grows to multi-user team scale.
- Same authors as `[[research/agent-orchestration/cadence-workflow-cadence]]` (Uber's predecessor). Read Temporal's docs, not Cadence's.

## Connections

- `[[research/agent-orchestration/_MOC]]`
- `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]` — lighter SQLite-friendly alternative (recommended for EMA)
- `[[research/agent-orchestration/restatedev-restate]]` — Rust journal-based alternative
- `[[research/agent-orchestration/cadence-workflow-cadence]]` — Uber's predecessor; read for arch docs
- `[[canon/specs/AGENT-RUNTIME]]`
- `[[canon/specs/EMA-V1-SPEC]]`

#research #agent-orchestration #signal-S #temporal #workflow #durable #event-history #replay
