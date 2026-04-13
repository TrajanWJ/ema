---
id: RES-windmill
type: research
layer: research
category: agent-orchestration
title: "windmill-labs/windmill — Postgres-backed workflow engine with tag-based worker routing"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-a
source:
  url: https://github.com/windmill-labs/windmill
  stars: 16218
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: A
tags: [research, agent-orchestration, signal-A, windmill, workflow, tag-routing]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]", relation: references }
  - { target: "[[research/agent-orchestration/temporalio-temporal]]", relation: references }
---

# windmill-labs/windmill

> 16k stars. Postgres-backed workflow engine with **stateless Rust workers + tag-based queues**. The cleanest demonstration of "stateless workers + Postgres state" at medium scale.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/windmill-labs/windmill> |
| Stars | 16,218 (verified 2026-04-12) |
| Last activity | 2026-04-12 |
| Signal tier | **A** |
| License | AGPL-3.0 (viral — steal patterns, not code) |

## What to steal

### 1. Worker tag/capability routing

Flows are tagged. Workers subscribe to tag queues. **EMA needs this for routing agents to the right machine** (laptop vs desktop vs phone) based on capability. Currently EMA dispatches without knowing which machine has which capabilities.

```typescript
// each worker declares its tags
worker.subscribe(['gpu', 'desktop', 'high-memory'])

// each flow declares required tags
flow.requireWorker(['gpu'])
```

### 2. Stateless workers + Postgres queue

Workers hold no state. The Postgres job queue is the source of truth. Per-step state in DB. Any worker can pick up an interrupted flow because both queue and state live in the database.

~50ms queue latency overhead — acceptable for EMA's scale.

### 3. Default TypeScript runtime is Bun

Worth noting for EMA's runtime decision (Node vs Bun vs Deno).

### 4. Self-hostable via Docker Compose / Helm

Single package, no SaaS dependency.

## Changes canon

| Doc | Change |
|---|---|
| `AGENT-RUNTIME.md` cross-machine dispatch | Worker tag/capability-based routing from a central queue |
| `EMA-GENESIS-PROMPT.md §9 P2P` | Tag-based worker selection |

## Gaps surfaced

- EMA has no tag-based routing. Executions are dispatched without knowing capabilities.
- No worker group abstraction.

## Notes

- AGPLv3 is viral — steal patterns, not code.
- Not as rigorous as Temporal/DBOS on step-level determinism, but the architecture is exactly the shape EMA needs at this scale.

## Connections

- `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]`
- `[[research/agent-orchestration/temporalio-temporal]]`

#research #agent-orchestration #signal-A #windmill #tag-routing
