---
id: GAC-QUEUE-MOC
type: moc
layer: intents
title: "GAC Queue — Map of Content"
status: active
created: 2026-04-12
updated: 2026-04-12
author: system
tags: [moc, gac, intents, queue]
connections:
  - { target: "[[_meta/CANON-STATUS]]", relation: references }
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: references }
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
---

# GAC Queue — Map of Content

> Gaps, Assumptions, and Clarifications surfaced by Round 1 + 2 + 3 cross-pollination research. Ranked by how badly they hurt Bootstrap v0.1 if left unresolved.

## How GAC cards work

Each card poses a question that the canon doesn't currently answer, with 4-6 pre-filled options. The user picks `[A]` / `[B]` / `[C]` / `[D]` (or `[1]` defer / `[2]` skip), and the answer becomes a canon decision. Some cards reference research nodes that informed the options.

This is the **Blueprint Planner vApp operated manually** as the bootstrap v0.1 process — exactly as `[[canon/specs/BLUEPRINT-PLANNER]]` predicts.

## Already resolved (locked in canon/decisions/)

| Card | Question | Resolution |
|---|---|---|
| - | Genesis vs V1-SPEC scope | `[[_meta/CANON-STATUS]]` — Genesis maximalist canon wins (Q1=B) |
| - | Graph engine TBD | `[[DEC-001]]` — derived Object Index over markdown (escape valve updated to TypeDB 2026-04-12) |
| - | CRDT vs file-sync | `[[DEC-002]]` — Syncthing for vault, Loro for structured data |
| - | Aspiration detection | `[[DEC-003]]` — empty niche confirmed, EMA stakes claim |
| GAC-001 | Cross-machine dispatch | **answered 2026-04-12** — deferred v2, DBOS target |
| GAC-002 | Concurrent agent coordination | **answered 2026-04-12** — deferred v2, 3-tier split |
| GAC-003 | Agent runtime state machine | **answered 2026-04-12** — 7-state + heartbeat [D]; heartbeat skeleton lives in `workers/src/agent-runtime-heartbeat.ts` + `services/core/actors/` (pty targets deferred) |
| GAC-004 | Intent exit_condition + scope | **answered 2026-04-12** — kind-aware mandatory [D]; `validateIntentForKind` wired at `services/core/intents/service.ts` create path (EXE-003) |
| GAC-005 | Typed edge grammar | **answered 2026-04-12** — frontmatter primary + inline sugar [C] |
| GAC-007 | Nested spaces — flat or nested | **answered 2026-04-12** — flat MVP, parent_id reserved v2 [D] (shipped in `services/core/spaces/`) |
| GAC-010 | User state awareness | **answered 2026-04-12** — mode enum + 7-signal heuristic [D] (shipped in `services/core/user-state/`) |
| - | GACCard backend primitive | `[[DEC-004]]` — Blueprint operationalized |
| - | Actor work lifecycle | `[[DEC-005]]` — `idle/plan/execute/review/retro` locked |
| - | Deferred CLI feature groups | `[[DEC-006]]` — `quality/routing/evolution` deferred to v2 |
| - | Unified intents schema + Three Truths | `[[DEC-007]]` — renumbered from DEC-004 in EXE-002; intents+intent_links+intent_events delivered in EXE-003 |
| - | Daily validation ritual | `[[DEC-008]]` — renumbered from DEC-005 in EXE-002 |
| - | EMA Voice canon | `[[canon/specs/EMA-VOICE]]` — register, names, slugs |

## Intent seam closed — 2026-04-12 (EXE-003)

The intent dangling reference that blocked everything downstream is closed. `services/core/intents/` now ports `Ema.Intents` (SELF-POLLINATION S-TIER PORT #1) to TypeScript:

- `intents` + `intent_phase_transitions` + `intent_links` + `intent_events` tables (DEC-007)
- `validateIntentForKind` called at `createIntent` — GAC-004 scope enforcement is live code
- `attachExecution / attachActor / attachSession` + `getRuntimeBundle / getIntentTree` — agent context assembly surface
- 8 MCP tools: `intents_{list,show,create,transition_phase,update_status}` + `get_intent_tree`, `get_intent_runtime`, `attach_intent_{execution,actor,session}`
- Fastify router under `/api/intents` + `GET /tree` and `GET /:slug/runtime` + attachment verbs
- Services-side `node:fs.watch` filesystem mirror (hand-rolled YAML) + `workers/src/intent-watcher.ts` cross-process twin gated on `EMA_WORKERS_WATCH_INTENTS=1`
- `PHASE_TRANSITION_DDL` from `shared/schemas/actor-phase.ts` is now applied (it had been an orphan export since that file landed)

Downstream wires closed the same session:

- `services/core/executions/executions.service.createExecution()` rejects dangling `intent_slug` references, calls `attachExecution()` after insert, publishes `executions:created` on the pipe bus
- `services/core/proposals/intention-farmer.proposalsForIntent(slug)` mints seed proposals from an intent's runtime bundle (stub path; full 5-stage pipeline tracked as `[[intents/INT-PROPOSAL-PIPELINE]]`)
- `workers/src/agent-runtime-heartbeat.ts` registers a `system:bootstrap` target that polls `/api/intents?status=active` so the runtime-state wire runs end-to-end with one real target at boot

## Open GAC Queue (3 remaining)

| # | Card | Question | Status |
|---|---|---|---|
| 6 | [[intents/GAC-006/README\|GAC-006]] | @ema/core SDK API surface | pending |
| 8 | [[intents/GAC-008/README\|GAC-008]] | Identity layer (HALO-style) | pending |
| 9 | [[intents/GAC-009/README\|GAC-009]] | Workflow resumability primitive | pending |

## Connections

- [[_meta/CANON-STATUS]]
- [[canon/specs/BLUEPRINT-PLANNER]]
- [[research/_moc/RESEARCH-MOC]]
- [[_meta/CANON-DIFFS]]

#moc #gac #intents #queue
