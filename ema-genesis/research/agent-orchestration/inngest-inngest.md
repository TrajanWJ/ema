---
id: RES-inngest
type: research
layer: research
category: agent-orchestration
title: "inngest/inngest — TypeScript event-driven workflows with step.run memoization"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-a
source:
  url: https://github.com/inngest/inngest
  stars: 5189
  verified: 2026-04-12
  last_activity: 2026-04-11
signal_tier: S
tags: [research, agent-orchestration, signal-S, inngest, workflow, durable, step-memoization]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]", relation: references }
---

# inngest/inngest

> Event-driven durable step functions for TypeScript/Python/Go. **Single binary self-host with SQLite out of the box.** The lightest-weight pragmatic choice for EMA's workflow layer.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/inngest/inngest> |
| Stars | 5,189 (verified 2026-04-12) |
| Last activity | 2026-04-11 |
| Signal tier | **S** |

## What to steal

### 1. step.run memoization

```typescript
inngest.createFunction(
  { id: "process-intent" },
  { event: "intent.created" },
  async ({ event, step }) => {
    const analysis = await step.run("analyze", () => analyzeIntent(event.data));
    const proposal = await step.run("generate-proposal", () => generate(analysis));
    await step.run("save", () => save(proposal));
  }
);
```

Each `step.run` has a hashed ID. Result is persisted externally. On re-execution after crash, the SDK looks up the hash, injects stored results, **skips completed steps**.

EMA needs the same: hash step args, persist `{hash: result}`, on resume inject and skip.

### 2. Single-binary self-host with SQLite

Since v1.0, Inngest ships as a single binary bundled with SQLite. Postgres supported via `--postgres-uri` since Jan 2025. **Most pragmatic self-host story** for EMA's desktop scale.

### 3. State lives in the service, not the function

Because state lives in the Inngest service (not the function process), re-execution can happen on **any** infrastructure: serverless, different VM, whatever. EMA's daemon can spawn a worker on any machine.

### 4. TypeScript-first

Native fit for EMA's stack.

## Changes canon

| Doc | Change |
|---|---|
| `AGENT-RUNTIME.md` | Add step_id hashing convention for idempotent agent tool calls |

## Gaps surfaced

- EMA has no step-hash → result cache. Tool calls inside an agent run are fire-and-forget with no memoization across restarts.

## Notes

- Most pragmatic self-host story of the workflow engines (single binary + SQLite).
- Caveat: as of Feb 2026, container requires INNGEST_SIGNING_KEY.
- **Worth evaluating as an embedded sidecar** even if not the final choice.

## Connections

- `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]` — Postgres-checkpoint cousin
- `[[research/agent-orchestration/triggerdotdev-trigger-dev]]` — TS background-jobs cousin

#research #agent-orchestration #signal-S #inngest #workflow #step-memoization
