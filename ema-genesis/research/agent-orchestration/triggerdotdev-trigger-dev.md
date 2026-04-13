---
id: RES-trigger-dev
type: research
layer: research
category: agent-orchestration
title: "triggerdotdev/trigger.dev — TypeScript jobs with CRIU-based process checkpointing"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-a
source:
  url: https://github.com/triggerdotdev/trigger.dev
  stars: 14508
  verified: 2026-04-12
  last_activity: 2026-04-11
signal_tier: B
tags: [research, agent-orchestration, signal-B, trigger-dev, criu, snapshot]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/inngest-inngest]]", relation: references }
---

# triggerdotdev/trigger.dev

> TypeScript background jobs framework with **CRIU-based process checkpointing**. Unique angle: snapshot a task's entire process state to disk, restore later on any worker. **Recommend NOT adopting** — the recovery story is weaker than DBOS/Temporal for EMA's needs.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/triggerdotdev/trigger.dev> |
| Stars | 14,508 (verified 2026-04-12) |
| Last activity | 2026-04-11 |
| Signal tier | **B** |

## What to flag (not steal)

### 1. The CRIU pause/resume model

CRIU = Checkpoint/Restore In Userspace. Snapshot the whole process (memory, CPU regs, open fds) to disk, restore on any worker. Orthogonal to journal/event-history models — instead of replaying steps, literally freeze and thaw.

**Don't adopt this for EMA.** CRIU is heavy, Linux-only, fragile with GPU/network sockets.

### 2. The decision EMA needs to make

Replay-based recovery (Temporal/DBOS/Inngest/Restate) vs snapshot-based recovery (Trigger.dev). **EMA should pick replay.** Document the choice explicitly.

### 3. The gap in trigger.dev's recovery

From their docs: **worker crashes mark runs as Crashed without auto-retry.** CRIU powers waits/subtask-boundary resume, not crash recovery. That gap is exactly what EMA can't accept.

## Changes canon

| Doc | Change |
|---|---|
| `AGENT-RUNTIME.md` | Flag as "investigated, not adopted — CRIU too fragile; use replay-based model instead" |

## Gaps surfaced

The decision: replay-based vs snapshot-based recovery. EMA should pick replay.

## Notes

- TypeScript-native, very popular (14.5k stars), but the crash-recovery story is weaker than DBOS/Temporal.
- Keep on the radar but don't build on it.

## Connections

- `[[research/agent-orchestration/inngest-inngest]]` — replay alternative
- `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]` — recommended replacement

#research #agent-orchestration #signal-B #trigger-dev #criu #cautionary
