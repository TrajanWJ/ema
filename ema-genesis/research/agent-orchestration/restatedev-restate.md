---
id: RES-restate
type: research
layer: research
category: agent-orchestration
title: "restatedev/restate — Rust durable execution server with journal-per-invocation replay"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-a
source:
  url: https://github.com/restatedev/restate
  stars: 3719
  verified: 2026-04-12
  last_activity: 2026-04-10
  license: BSL (Business Source License) → Apache after 4 years
signal_tier: S
tags: [research, agent-orchestration, workflow, durable, restate, journal, exactly-once]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/temporalio-temporal]]", relation: references }
  - { target: "[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]", relation: references }
---

# restatedev/restate

> Cleanest journal-based model in the durable workflow space. First-class TypeScript SDK. Self-hostable as single binary. Closest existing OSS thing to what EMA's P2P resumable execution vision needs.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/restatedev/restate> |
| Stars | 3,719 (verified 2026-04-12) |
| Last activity | 2026-04-10 |
| Signal tier | **S** |
| Language | Rust (core) + TypeScript SDK (first-class) + Java + Python |
| License | BSL (commercial restrictions for hosted competitors; OK for self-host) |

## What it is

Distributed durable workflow server in Rust. **Journal-per-invocation** model: every side effect (RPC call, DB write, timer, sleep, sub-workflow call) is recorded in a durable journal with its result. On crash or restart, Restate replays the journal, skipping completed entries and resuming from the first unrecorded step. Cross-node handoff uses a Raft-style consensus log so a journal is readable by any node after election. Idempotency keys dedupe user-visible effects.

## What to steal for EMA

### 1. The journal entry schema

Each step gets one journal row:

```typescript
journal_entry {
  invocation_id: string
  entry_index: number
  op: 'invoke' | 'sleep' | 'awakeable' | 'state_get' | 'state_set' | 'output_set'
  args_hash: string         // for idempotency dedup
  result: JSON              // populated on completion
  status: 'pending' | 'completed' | 'failed'
  recorded_at: timestamp
  node_id: string           // which Restate node owns this
}
```

EMA should adopt this exact schema for the agent tool-call layer. Every Claude API call, every file write, every shell exec gets a journal entry. On replay, the runtime checks the journal first and only re-executes past the last recorded entry.

### 2. Hash-based idempotency dedup

Every operation has an `args_hash`. Repeat ops with the same hash are deduped to a single execution. This is the safety net against double-execution after a crash mid-write. EMA's tool calls should hash `(tool_name, args_canonical_json)` and check the journal before execution.

### 3. Consensus log for cross-node agreement

Restate uses Raft for the journal log replication. Two nodes agree on the order of journal entries via majority quorum. For EMA's "P2P-optimistic, not strictly-consistent" ethos this is heavier than needed — but the **read pattern** (any node can replay from any node's journal once it has the bytes) is what matters. EMA can use simpler replication (Loro-based or Syncthing-folder-of-journals) and still get the resume semantics.

### 4. Single-binary self-host

Restate ships as one Rust binary you can run as a sidecar to your app. EMA could run a Restate sidecar and have the daemon delegate workflow execution to it via the TypeScript SDK. Avoids reimplementing the journal protocol.

### 5. Idempotency keys for user-visible effects

Beyond hash-based step dedup, Restate supports explicit idempotency keys for "send this email exactly once even across retries" semantics. EMA's agent tool calls should expose this — every "send email" tool takes an optional `idempotency_key`, and the journal keeps a `(idempotency_key, result)` map.

## What it changes about the blueprint

| Canon doc | What changes |
|---|---|
| `AGENT-RUNTIME.md` | Adopt the journal entry schema for tool calls. Add hash-based idempotency dedup. |
| `EMA-V1-SPEC.md` execution model | Step-level journaling vs current row-based |
| `EMA-GENESIS-PROMPT.md §9 P2P` | Cross-node read pattern: any node replays from any node's journal |

## Gaps surfaced

- EMA has no journal/log abstraction for agent tool calls
- No hash-based dedup of repeat ops
- No consensus model for cross-node execution agreement (worth debating EMA's P2P-optimistic vs strictly-consistent stance)

## Notes

- **First-class TypeScript SDK** — direct fit for EMA's stack
- **BSL license** is restrictive for hosted competitors; fine for EMA self-host
- Round 2-A's secondary recommendation after DBOS — DBOS is lighter, Restate is more rigorous
- Worth running locally and reading the journal schema even if EMA doesn't depend on it

## Connections

- `[[research/agent-orchestration/_MOC]]`
- `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]` — lighter SQLite-friendly alternative (Round 2-A's primary rec)
- `[[research/agent-orchestration/temporalio-temporal]]` — Go-server alternative with TS SDK
- `[[canon/specs/AGENT-RUNTIME]]`
- `[[canon/specs/EMA-V1-SPEC]]`

#research #agent-orchestration #signal-S #restate #workflow #durable #journal #typescript
