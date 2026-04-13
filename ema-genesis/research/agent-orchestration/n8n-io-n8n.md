---
id: RES-n8n
type: research
layer: research
category: agent-orchestration
title: "n8n-io/n8n — popular self-hosted workflow with FRAGILE crash recovery (cautionary tale)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-a
source:
  url: https://github.com/n8n-io/n8n
  stars: 183719
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: B
tags: [research, agent-orchestration, signal-B, n8n, cautionary-tale]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]", relation: references }
---

# n8n-io/n8n

> 183k stars. Popular self-hosted workflow automation. **The cautionary tale**: "Save Execution Progress" exists but is fragile. Don't ship EMA's recovery story without the full protocol.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/n8n-io/n8n> |
| Stars | 183,719 (verified 2026-04-12) |
| Last activity | 2026-04-12 |
| Signal tier | **B** (mostly cautionary) |

## What to learn (not steal)

### 1. Naive node-level checkpointing isn't enough

n8n has a "Save Execution Progress" per-workflow setting that stores node-level data so a failed run can resume from the failing node. Sounds good. **But:**
- Rapid worker restarts mark otherwise-successful workflows as crashed (n8n skips recovery on the second restart)
- Underlying design is Redis-queue + DB-persisted partial execution, NOT event-log + deterministic replay
- No idempotency keys

**Lesson:** "save progress per node" without deterministic replay + idempotency + proper detection is a half-measure that creates false-crash states.

### 2. The market expectation

183k stars means the user expectation for "self-hosted workflow with recovery" is already set. EMA can differentiate on **doing it correctly**.

### 3. UX baseline

The visual workflow editor is the dominant UX in this space. EMA's Pipes vApp will be compared to this.

## Changes canon

| Doc | Change |
|---|---|
| `AGENT-RUNTIME.md` | Add a note explaining why node-level checkpointing without replay determinism is insufficient. Link as the negative example. |

## Gaps surfaced

- Validates that a naive "save last completed node" approach isn't enough. EMA needs either journal replay or step-checkpoint detection with proper PENDING scan on boot.

## Notes

- TypeScript codebase, technically readable. Architecture is not what EMA wants.
- Useful as a UX / install-base benchmark.

## Connections

- `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]` — what EMA should do instead

#research #agent-orchestration #signal-B #n8n #cautionary
