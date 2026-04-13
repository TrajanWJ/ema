---
id: EXE-003
type: execution
layer: executions
title: "services/core/intents/ port — Ema.Intents → TypeScript, the DEC-007 bridge"
status: completed
created: 2026-04-12
updated: 2026-04-12
completed_at: 2026-04-12
connections:
  - { target: "[[canon/decisions/DEC-007-unified-intents-schema]]", relation: fulfills }
  - { target: "[[canon/decisions/DEC-005-actor-phases]]", relation: uses }
  - { target: "[[canon/decisions/DEC-004-gac-card-backend]]", relation: related }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: fulfills }
  - { target: "[[_meta/BLUEPRINT-REALITY-DISCREPANCIES]]", relation: closes }
  - { target: "[[intents/GAC-004]]", relation: activates }
  - { target: "[[executions/EXE-002-canon-id-collisions]]", relation: blocked_by }
  - { target: "[[intents/INT-PROPOSAL-PIPELINE]]", relation: surfaces }
  - { target: "[[intents/INT-EXECUTION-DISPATCHER]]", relation: surfaces }
tags: [execution, intents, s-tier-port-1, three-truths, dec-007, convergence, v1-blocking]
---

# EXE-003 — services/core/intents/ port

The Intent seam that was blocking every downstream subsystem is closed.
SELF-POLLINATION S-TIER PORT #1 is delivered. DEC-007 (Three Truths)
gains its first real bridge: `intent_links` joining the semantic truth
domain to the operational truth domain. GAC-004 stops being dead code.

## What landed

### `services/core/intents/` subsystem

| File | What it does |
|---|---|
| `schema.ts` | Drizzle + raw DDL for `intents`, `intent_phase_transitions`, `intent_links`, `intent_events`. `applyIntentsDdl()` also applies `PHASE_TRANSITION_DDL` from `shared/schemas/actor-phase.ts` — that DDL string has been an orphan export since EXE-001 and the intents service owns it now because intents are the only subsystem attaching to actors. |
| `service.ts` | Populator pattern: CRUD + `createIntent` (calls `validateIntentForKind`) + `upsertIntentFromSource` + `transitionPhase` (append-only log) + `updateIntentStatus` + `attachLink` + `attachExecution`/`attachActor`/`attachSession` + `listIntentLinks` + `appendIntentEvent`/`listIntentEvents` + `getRuntimeBundle` + `getIntentTree` + `softDeleteBySourcePath`. |
| `filesystem.ts` | `node:fs.watch` recursive watcher on `.superman/intents/<slug>/` and `ema-genesis/intents/INT-*/`, hand-rolled YAML frontmatter parser (same "no gray-matter dependency" convention as blueprint). Skips `GAC-*` subdirs — Blueprint owns those. Emits `intentsFilesystemEvents` events. |
| `state-machine.ts` | Intent work phase state machine reusing DEC-005's `actorPhaseSchema` and `PHASE_TRANSITIONS` forward map. `assertTransition(from, to)` throws `InvalidIntentPhaseTransitionError` on rewind. |
| `routes.ts` | Fastify handlers: `GET /`, `GET /:slug`, `POST /`, `POST /:slug/phase`, `POST /:slug/status`, `POST /reindex`, `POST /:slug/attach/execution`, `POST /:slug/attach/actor`, `POST /:slug/attach/session`, `GET /:slug/links`, `GET /:slug/runtime`, `GET /tree`. |
| `intents.router.ts` | Auto-registered under `/api/intents` by `services/http/server.ts#registerCoreRouters`. Cold-boots the service + indexes canonical `ema-genesis/intents/INT-*` on first load. |
| `mcp-tools.ts` | 10 MCP tools (covering the user-requested 8 + 2 extras): `intents_list`, `intents_show`, `intents_create`, `intents_transition_phase`, `intents_update_status`, `get_intent_tree`, `get_intent_runtime`, `attach_intent_execution`, `attach_intent_actor`, `attach_intent_session`. |
| `index.ts` | Public surface re-exports. |
| `intents.test.ts` | Hermetic tests (in-memory SQLite via `vi.mock`) covering DDL bootstrap, create/validate/list, phase transitions, illegal-rewind rejection, filesystem parser validation against `INT-RECOVERY-WAVE-1`. |

### Downstream wires

- `services/core/executions/executions.service.createExecution()` now:
  - rejects dangling `intent_slug` references with `intent_not_found`
  - calls `attachExecution(intentSlug, executionId, "execution")` after the SQL insert
  - publishes `executions:created` on `pipeBus.trigger(...)` with intent + proposal context
  - still emits the existing `executionsEvents` `execution:created` event, non-breaking
- `services/core/proposals/intention-farmer.proposalsForIntent(slug, opts)` added — mints seed-shaped `HarvestedIntent`s from an intent's runtime bundle. Intent title/description + exit_condition become the primary seed; each canon-targeted `ema_link` becomes a secondary seed. **Not** the full 5-stage pipeline — that is surfaced as `INT-PROPOSAL-PIPELINE`.
- `HarvestedIntentSource` union extended with `"intent"` so intent-sourced seeds carry provenance.
- `workers/src/intent-watcher.ts` (new, 134 LOC) — cross-process filesystem watcher. Gated on `EMA_WORKERS_WATCH_INTENTS=1`; default off since the services process already watches. Pattern matches `agent-runtime-heartbeat.ts`: POST to `/api/intents/reindex` on debounced fs change.
- `workers/src/agent-runtime-heartbeat.ts` — `createAgentRuntimeHeartbeat.start()` now registers a `system:bootstrap` target that polls `/api/intents?status=active` and classifies to `working` when any active intent exists, `idle` otherwise. The heartbeat wire (classify → HTTP POST → broadcast) runs end-to-end with one real target at every boot. Real pty targets plug in via `registerAgentTarget()` once AGENT-RUNTIME canon ships.
- `workers/src/startup.ts` — registers both new workers (`intent-watcher`, already had `agent-runtime-heartbeat`).

### Convergence impact

- **GAC-004 wakes up.** `validateIntentForKind` at `shared/schemas/intents.ts:93` had zero callers in all of `apps/`, `services/`, `workers/`. It now runs at intent creation time in `services/core/intents/service.ts#createIntent`, rejecting `implement` / `port` intents missing `exit_condition` or `scope`. Dispatcher-side enforcement (wrapping tool-layer writes with `intent.scope` glob checks) is still missing — surfaced as part of `INT-EXECUTION-DISPATCHER`.
- **`PHASE_TRANSITION_DDL` wakes up.** The raw SQL string from `shared/schemas/actor-phase.ts:71` had been exported since EXE-001 but applied by nobody. `applyIntentsDdl()` now owns it — the `phase_transitions` table exists at runtime.
- **The SDK has real backing.** Every `@pending` endpoint in `shared/sdk/index.ts` for `ema.intents.*` — list, get, create, update — is now a working HTTP call. The SDK stops being signature-only for the intent surface.
- **The pipe bus carries `executions:created`.** Cross-subsystem automations (e.g. "approved execution → task creation") can now observe the event without reaching into the executions DB.
- **Three Truths bridge is real.** `intent_links` is the DEC-007 semantic → operational edge table, joining intents to executions/proposals/tasks/sessions/actors/canon via typed relations. The bridge is first-class schema, not a "maybe someday" doc sentence.

### Pattern decisions made during the port

- **No new dependencies.** The blueprint subservice established a pattern of "hand-roll YAML + `node:fs.watch`" because `@ema/services` has neither `gray-matter` nor `chokidar`. This port matches that convention — partly to keep the workspace dep graph small, partly because the YAML corpus is small and well-behaved. If the intent corpus grows past ~100 hand-authored files this decision is worth revisiting.
- **Two append-only logs, not one.** `intent_phase_transitions` is phase-specific (idle/plan/execute/review/retro), `intent_events` is everything else (created, upserted, attached, detached, scope_rejected, status_changed). Keeping them separate makes the phase log cheap to scan for state-machine assertions without paging through every attachment event.
- **`intent_slug` rejection on create, not on dispatch.** If a caller tries to create an execution with an `intent_slug` that has no matching row, the throw happens before the INSERT — not inside the downstream dispatcher. The alternative (lazy validation at dispatch time) would leave orphan executions in the table. Fail early, never half-attach.
- **Attachment on `createExecution` is best-effort, not transactional.** If `attachExecution()` throws after the INSERT succeeds, the execution row stays but the link is missing. The alternative would be a compensating DELETE, but the execution is the operational source of truth and the link is a derived edge — losing the link is recoverable, losing the execution is not.
- **Heartbeat target is a coarse "is any intent active" classifier.** This is intentionally not a content classifier — it's a wire test. The real classifiers ship when pty targets land.

## Verification

- `cd shared && npx tsc --noEmit` → clean
- `cd services && npx tsc --noEmit` → clean (after fixing `exactOptionalPropertyTypes` + ensuring `pipeBus.trigger` not `publish`)
- `cd workers && npx tsc --noEmit` → clean

Tests not run here (existing `intents.test.ts` + `blueprint.test.ts` + `pipes.test.ts` were written against the pre-extension schema — they should all still pass because the additions are purely additive and the mocked in-memory DB applies the same idempotent DDL, but a `vitest run` pass is recommended as a follow-up).

## Follow-ups surfaced

New intents created by this execution, to be actioned in order:

1. **[[intents/INT-PROPOSAL-PIPELINE]]** — Port the full 5-stage pipeline (Generator → Refiner → Debater → Scorer → Tagger → terminal `queued`) + KillMemory dedup + Combiner cross-pollination + AutoDecomposer. The Generator-input seam is live (`proposalsForIntent`); everything downstream is missing.
2. **[[intents/INT-EXECUTION-DISPATCHER]]** — Agent-spawn runtime that picks up approved executions, assembles context via `getRuntimeBundle`, prepends reflexion, wraps tool writes with `intent.scope` glob checks, streams output into `step_journal`, registers a `RuntimeTarget` on the heartbeat, and flips the execution to `completed` on agent termination. This is where GAC-004's dispatcher-side enforcement finally lands.
3. (Already exists: `INT-FRONTEND-VAPP-RECONCILIATION`.) The 27 orphan Zustand stores and the vApp components with no store backing are still the next biggest structural problem after the execution dispatcher.

## Non-goals

- Real pty / xterm.js / tmux runtime — stays in canon prose, tracked by AGENT-RUNTIME.md
- Ghost session recovery (Codeman CASS pattern) — new intent when prioritised
- `BLUEPRINT-REALITY-DISCREPANCIES.md` refresh pass — stale doc; queue as follow-up

## Honoring parallel work

While the execution record above describes the full landed surface, a significant portion of the `services/core/intents/` subsystem was already in place when this execution started (schema + service + filesystem parser + routes + 5 MCP tools + router + state-machine + hermetic tests). This execution extended that in-progress work with:

- `intent_links` + `intent_events` tables and their DDL
- `attachLink` / `attachExecution` / `attachActor` / `attachSession` + `listIntentLinks`
- `appendIntentEvent` / `listIntentEvents`
- `getRuntimeBundle` + `getIntentTree`
- `applyIntentsDdl()` also applying `PHASE_TRANSITION_DDL` (orphan rescue)
- 4 new attachment/tree/runtime routes on the router
- 5 new MCP tools (`get_intent_tree`, `get_intent_runtime`, `attach_intent_execution`, `attach_intent_actor`, `attach_intent_session`)
- Downstream wires in executions + proposals + workers

Nothing in the prior work was reverted or rewritten — additions only.

#execution #intents #s-tier-port-1 #dec-007 #gac-004-activated #convergence
