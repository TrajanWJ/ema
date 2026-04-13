---
id: DEC-006
type: canon
subtype: decision
layer: canon
title: "quality / routing / evolution CLI features — conceptually preserved, implementation deferred to v2"
status: active
created: 2026-04-12
updated: 2026-04-12
author: recovery-wave-1
decided_by: human
connections:
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: derived_from }
  - { target: "[[intents/INT-RECOVERY-WAVE-1/README]]", relation: references }
tags: [decision, canon, locked, deferred, cli, v2]
---

# DEC-006 — Deferred CLI Feature Groups

> **Status:** Locked 2026-04-12. Codifies which old-build CLI feature groups are *conceptually preserved* for v2 without blocking Bootstrap v0.1.

## Context

The session rejected P1 (locking the 14-noun CLI surface as a hard canon contract) but kept the softer rule: **all 14 feature groups must remain implementable in the new build**. That leaves the question of *when* each ships. Three of them are high-complexity, low-priority-for-v1, and would dominate the engineering budget if attempted early.

## The Decision

Three old-build CLI feature groups are **conceptually preserved but deferred to v2**:

### 1. `quality` — execution quality analytics

Old verbs: `quality report | friction | gradient | budget | threats | improve`.

**What it does:** Analyzes the historical execution record to surface friction points, completion gradients, budget overruns, and threat signals. Generates `improve` suggestions.

**Why defer:** Requires a statistically meaningful execution history. v1 won't have one. Shipping the analytics before the data is re-deriving without inputs.

**v2 scaffolding note:** The `execution` table (per `[[_meta/SELF-POLLINATION-FINDINGS]]` Data Models section) must already record the fields needed: `started_at`, `completed_at`, `outputs`, `decisions`, `learnings`, `step_journal`. These fields are in scope for v1 for other reasons (DBOS checkpoints), so the quality analytics will be computable on v2 day one.

### 2. `routing` — multi-provider LLM routing fitness

Old verbs: `routing status | fitness | dispatch`.

**What it does:** Tracks per-provider (Claude, Codex, Gemini, ...) success rates, cost, latency, and output quality. Fitness function selects the best provider for a given intent kind.

**Why defer:** v1 ships with a single LLM provider (`[[canon/specs/EMA-V1-SPEC]]` §10). Multi-provider routing is meaningless without multiple providers.

**v2 scaffolding note:** Keep the `AgentSession { provider, ... }` field generalized (per Appendix A.13) so v2 fitness code has the history to score against from the moment the second provider lands.

### 3. `evolution` — self-modification rule engine

Old verbs: `evolution rules | signals | stats | scan | propose | activate | rollback`.

**What it does:** Monitors EMA itself for drift/decay signals, proposes self-modifications, activates them behind a rollback boundary. EMA's self-improvement loop.

**Why defer:** The **self-building** research layer (`[[research/self-building/]]`) is where this gets designed. Without a locked design, implementing the evolution engine means building the wrong thing. v1 ships *without* self-modification; evolution comes after the foundation is stable enough to be worth evolving.

**v2 scaffolding note:** The `proposals` pipeline (Appendix A.4) already accepts seeds from many sources. A `system:evolution` trigger in the Pipes registry is the natural entry point when the engine is ready. Do not add the trigger until there's a consumer.

## What This Changes

- No new code in v1 for these three feature groups.
- Their CLI verbs are **available namespaces** in the new TS CLI — if a future intent wants to ship a v1-scoped subset (e.g. `ema quality report --days=7` as a read-only stub), it can do so without collision.
- The execution schema, AgentSession schema, and Pipes registry are all designed with these v2 features in mind so v2 day one isn't a migration.

## What This Does NOT Change

- The other 11 feature groups (`vault`, `intent`, `proposal`, `session`, `health`, `test`, `pipe`, `campaign`, `channel`, `ai-session`, `superman`) are in scope for v1, with implementation priority set by the other streams in `[[intents/INT-RECOVERY-WAVE-1/README]]`.
- P1 denial holds: the verb grammar is not a hard contract. New verbs can be added; old ones can be renamed. This decision just marks three *feature groups* as v2-phase.

## Connections

- `[[_meta/SELF-POLLINATION-FINDINGS]]` Appendix A.1 — source verb inventory
- `[[canon/specs/EMA-V1-SPEC]]` §10 — what v1 actually ships
- `[[intents/INT-RECOVERY-WAVE-1/README]]` — the intent this decision is executed under

#decision #canon #locked #deferred #cli #v2 #recovery-wave-1
