---
id: RES-nomad
type: research
layer: research
category: p2p-crdt
title: "hashicorp/nomad — workload orchestrator with declarative reschedule policy"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/hashicorp/nomad
  stars: 16407
  verified: 2026-04-12
  last_activity: 2026-04-10
signal_tier: A
tags: [research, p2p-crdt, signal-A, nomad, reschedule, self-healing]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/hashicorp-serf]]", relation: references }
---

# hashicorp/nomad

> Single-binary workload orchestrator with **declarative reschedule policy**. Steal the job-spec model — let executions declare retry behavior as config, not code.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/hashicorp/nomad> |
| Stars | 16,407 (verified 2026-04-12) |
| Last activity | 2026-04-10 |
| Signal tier | **A** |

## What to steal

### 1. The reschedule stanza

```hcl
job "intent-execution" {
  reschedule {
    attempts  = 3
    interval  = "30m"
    delay     = "30s"
    max_delay = "10m"
    unlimited = false
  }
}
```

Declare retry behavior as config, not code. EMA's `Execution` should have a similar `reschedule_policy` field.

### 2. The reconcile loop

`nomad/scheduler/reconcile.go` has the algorithm: detect failed allocations, apply reschedule policy, dispatch to a new node. Read it as the reference implementation for "what happens when the agent's machine dies mid-run."

### 3. Drain + reschedule

Graceful node drain — when a machine goes down for maintenance, allocations migrate first. EMA should support graceful agent migration when machines come and go.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §9` | Add reschedule policy spec to Execution |
| `SCHEMATIC-v0.md` | Dispatcher module gets job-spec |

## Gaps surfaced

- **EMA's execution model has no "what happens when the agent's machine dies mid-run" answer.** Currently the execution just hangs.

## Notes

- Don't port Nomad itself — too much for a personal app.
- Steal the job-spec declarative model and implement it over EMA's existing dispatcher.
- Round 2-A's `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]` is the lighter complement: Nomad reschedules; DBOS resumes.

## Connections

- `[[research/p2p-crdt/hashicorp-serf]]` — failure detection cousin
- `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]` — durable workflow alternative
- `[[research/agent-orchestration/temporalio-temporal]]`

#research #p2p-crdt #signal-A #nomad #reschedule #self-healing
