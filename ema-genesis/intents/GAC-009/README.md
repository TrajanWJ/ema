---
id: GAC-009
type: gac_card
layer: intents
title: "Workflow resumability — should EMA pick DBOS, Inngest, or build its own?"
status: pending
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-a
category: gap
priority: medium
connections:
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
  - { target: "[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]", relation: derived_from }
  - { target: "[[research/agent-orchestration/inngest-inngest]]", relation: derived_from }
  - { target: "[[research/agent-orchestration/temporalio-temporal]]", relation: derived_from }
  - { target: "[[research/agent-orchestration/restatedev-restate]]", relation: derived_from }
---

# GAC-009 — Workflow resumability primitive

## Question

EMA agents run multi-step tasks. Currently if the daemon crashes mid-run, the execution is lost. Round 2-A confirmed the consensus protocol (durable log + replay + sticky queues + heartbeat lease). **Which library does EMA depend on?**

## Context

Four real candidates ranked by fit with EMA's TypeScript+SQLite stack:

| Repo | Stars | Stack | Fit |
|---|---|---|---|
| `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]` | 1,136 | TS + Postgres/SQLite | **Best fit** |
| `[[research/agent-orchestration/inngest-inngest]]` | 5,189 | Self-host single-binary + SQLite | Good fit |
| `[[research/agent-orchestration/restatedev-restate]]` | 3,719 | Rust core + TS SDK | Strong but heavier |
| `[[research/agent-orchestration/temporalio-temporal]]` | 19,536 | Go server + TS SDK | Most rigorous, heaviest |

The pattern is the same in all four; the dependency footprint differs.

## Options

- **[A] Depend on DBOS-transact-ts**: TypeScript-native, MIT, no separate server, SQLite-friendly. Library that sits next to your app. Round 2-A's primary recommendation.
  - **Implications:** Adds one npm dependency. Schema gains `step_checkpoints` table. Replay protocol works out of the box.
- **[B] Depend on Inngest**: Single-binary self-host with SQLite bundled. Lightest infrastructure footprint. TS-native.
  - **Implications:** Adds a sidecar process (the Inngest server). More moving parts than DBOS but cleaner step memoization API.
- **[C] Depend on Restate**: Rust core, first-class TS SDK, single-binary self-host. Most rigorous (journal-per-invocation + Raft consensus).
  - **Implications:** Adds a sidecar binary. BSL license. Best correctness guarantees but overkill for v1.
- **[D] Build it ourselves**: Implement the consensus protocol (DBOS pattern) directly in TypeScript over EMA's existing SQLite. ~500 LOC.
  - **Implications:** No external dependency. Full control. Risk: subtle bugs in the resume protocol that the libraries already solved.
- **[1] Defer**: V1 doesn't need resumability; ship without it.
- **[2] Skip**: Single-machine v1 with manual restart on crash.

## Recommendation

**[A] DBOS-transact-ts** when the EMA daemon's worker layer is built. Reasoning: TS-native, MIT license, no sidecar, SQLite-friendly, the pattern is the same as the heavier alternatives. Build for [D] only if DBOS later proves untenable.

## What this changes

`AGENT-RUNTIME.md` gains a "Workflow Resumability" section + DBOS as a named dependency. `Execution` schema gains a `step_checkpoints` child table.

## Connections

- `[[canon/specs/AGENT-RUNTIME]]`
- `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]`
- `[[research/agent-orchestration/inngest-inngest]]`
- `[[research/agent-orchestration/restatedev-restate]]`
- `[[research/agent-orchestration/temporalio-temporal]]`
- `[[_meta/SELF-POLLINATION-FINDINGS]]` — Bridge SmartRouter REPLACE entry

#gac #gap #priority-medium #workflow-resumability #dbos
