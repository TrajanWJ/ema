---
id: EXE-001
type: execution
layer: executions
title: "GAC schema stubs — typed edges, SDK facade, spaces, identity, user-state, runtime heartbeat"
status: completed
created: 2026-04-12
updated: 2026-04-12
author: reality-reconciliation-pass
completed_at: 2026-04-12
connections:
  - { target: "[[_meta/BLUEPRINT-REALITY-DISCREPANCIES]]", relation: fulfills }
  - { target: "[[intents/GAC-005/README]]", relation: fulfills }
  - { target: "[[intents/GAC-006/README]]", relation: fulfills }
  - { target: "[[intents/GAC-007/README]]", relation: fulfills }
  - { target: "[[intents/GAC-008/README]]", relation: fulfills }
  - { target: "[[intents/GAC-010/README]]", relation: fulfills }
  - { target: "[[intents/GAC-003/README]]", relation: derived_from }
  - { target: "[[canon/decisions/DEC-005-actor-phases]]", relation: references }
tags: [execution, gac, schema, sdk, runtime, wave-1, reality-reconciliation]
---

# EXE-001 — GAC schema stubs + runtime heartbeat skeleton

Reality reconciliation pass, one session after the 10-GAC audit that
closed the Round 1 gap list. Surface-level fix for the 6 GACs the audit
flagged as "missing with cheap schema stubs explicitly recommended,"
plus the runtime-classifier + heartbeat-worker skeleton for GAC-003.

The preceding audit table (see conversation history) showed 0 of 10
Round-1 GACs fully resolved in the `apps/services/workers` code, 2
partial (GAC-003 schema-only, GAC-004 schema+validator but no dispatcher
enforcement), 8 missing. This execution closes the cheap end of that
list in one uncontroversial batch.

## What was added

### Schema stubs (uncontroversial, additive)

| GAC | File | Change |
|---|---|---|
| GAC-005 | `shared/schemas/common.ts` | `emaLinkTypeSchema` (6-value enum including `aspiration_of`), `emaLinkSchema`, `emaLinksField`, `spaceIdField`. Helpers reused by every node schema. |
| GAC-005 | `shared/schemas/intents.ts` | `ema_links` optional field added via `emaLinksField`. |
| GAC-005 | `shared/schemas/proposals.ts` | `ema_links` optional field. |
| GAC-005 | `shared/schemas/executions.ts` (new) | Zod mirror of the ad-hoc `ExecutionRecord` service row, with `ema_links` and `space_id` present from day one. |
| GAC-007 | `shared/schemas/spaces.ts` (new) | Flat-MVP `spaceSchema` with `id / name / slug / description / members / settings`. **No `parent_space_id`.** Nested spaces explicitly deferred to v2 per the Round 2-B negative prior art (Mattermost, Rocket.Chat, Anytype). |
| GAC-007 | `shared/schemas/{intents,proposals,executions}.ts` | `space_id: spaceIdField` (optional) on all three entity schemas. |
| GAC-008 | `shared/schemas/agents.ts` | `identity_pubkey?: string` stub. No validation that depends on it — v2 HALO migration will be additive. |
| GAC-010 | `shared/schemas/user-state.ts` (new) | `userStateSchema` with `actor_id, mood, energy, focus, distress_score, source, last_assessed`. Axes normalized to `[0, 1]`. No observer code yet. |
| GAC-010 | `shared/schemas/agents.ts` | `current_state_id?: string` stub referencing the latest `UserState` row. |
| — | `shared/schemas/index.ts` | Exports for the new modules and helpers. |

### `@ema/core` SDK facade (GAC-006)

- `shared/sdk/index.ts` (new) — `createEmaClient({ baseUrl, token? })`
  returning an `ema` object with domain namespaces: `intents`,
  `proposals`, `executions`, `brainDump`, `vault`, `canon`, `agents`,
  `spaces`, `userState`, `events`, plus a raw `request<T>()` escape hatch.
- Every method maps to an `/api/...` route on the services daemon.
  Endpoints that do not yet exist are marked `@pending` in the JSDoc —
  the signature is stable so vApps can import today; the call returns
  the daemon's HTTP error until the route lands.
- `shared/package.json` exports `./sdk`; `shared/tsconfig.json` includes
  `sdk/**/*.ts`; `shared/index.ts` re-exports `createEmaClient`,
  `EmaClient`, `EmaClientOptions` so both `@ema/shared` and
  `@ema/shared/sdk` import paths work.

### Runtime heartbeat skeleton (GAC-003)

- `services/core/actors/runtime-classifier.ts` (new) — pure
  `classifyRuntimeState(snapshot)` function. Seven-state output matches
  `agentRuntimeStateSchema`. Pattern set ported in spirit (not code) from
  agent_farm's pane classifier: `context-full` / `error` / `blocked`
  regex banks, `crashed` from `processAlive === false`, `paused` from
  explicit user flag, `idle` vs `working` from a pluggable idle timeout.
- `services/core/actors/runtime-poller.ts` (new) — `RuntimePoller` class
  with `registerTarget / unregisterTarget / start / stop / tick`. Only
  fires an `onTransition` callback when the classified state actually
  changes, so the WS bus doesn't drown in no-op ticks. Module-level
  `runtimePoller` singleton for in-process consumers.
- `services/core/actors/routes.ts` + `actors.router.ts` (new) — Fastify
  auto-registered `POST /api/agents/runtime-transition`. Validates the
  body against `agentRuntimeStateSchema` and re-broadcasts on the
  Phoenix WS bus as topic `agents:runtime`, event `state_transition`.
- `workers/src/agent-runtime-heartbeat.ts` (new) — out-of-process
  heartbeat worker. Owns its own pty-target registry and ticks every
  `EMA_HEARTBEAT_INTERVAL_MS` (default 1000). On transition it POSTs to
  `EMA_SERVICES_URL` (default `http://127.0.0.1:4488`). Classifier logic
  is duplicated inline because `@ema/workers` does not depend on
  `@ema/shared`; the canonical source for the enum is still
  `shared/schemas/actor-phase.ts` and the two must stay in sync.
- `workers/src/startup.ts` — registers `agent-runtime-heartbeat` in the
  default worker set.

## What was not done (explicit non-goals)

- **No pty wrapper.** `AGENT-RUNTIME.md` promises an Electron
  puppeteer-style xterm.js + node-pty + tmux runtime. That work is its
  own intent. Today the heartbeat's target registry is empty — ticks are
  cheap no-ops until real pty adapters land via `registerAgentTarget()`.
- **GAC-004 dispatcher scope enforcement.** The schema side is already
  done (`validateIntentForKind`); the write-time glob wrapper is next on
  the queue, not in this execution.
- **Intent routes.** `/api/intents` is not yet registered. The SDK calls
  it by design — the facade is correct, the daemon route follows.
- **Vault / canon routes.** SDK signatures exist; routes are pending.
- **Cross-pollination sources.** Codeman ghost-session recovery,
  Palinode KEEP/UPDATE/MERGE/SUPERSEDE/ARCHIVE DSL verbs, SilverBullet
  Object Index, Task-Anchor dispatcher enforcement — all are queued as
  next-priority items but out of scope for this batch.

## Verification

- `cd shared && pnpm typecheck` → clean
- `cd services && npx tsc --noEmit` → clean
- `cd workers && npx tsc --noEmit` → clean

Renderer/apps workspaces were not re-checked; all shared-schema edits
are additive (new optional fields, new exports) so no existing inferred
types narrowed. Any break would be from a pre-existing issue unrelated
to this batch.

## Canon changes required (follow-ups, not done here)

- `DEC-002-crdt-filesync-split.md` should state the Syncthing vs Loro
  boundary explicitly (Syncthing for human-edited markdown in the vault,
  Loro/Automerge for structured intents/tasks/canvas). The user
  surfaced this in the same conversation that produced this execution.
  Flagged here, not modified — DEC-002 is a locked canon node.
- `AGENT-RUNTIME.md` still needs the "Agent State Machine" section
  referencing `agentRuntimeStateSchema` directly. Untouched because it
  is an active canon node.
- `BLUEPRINT-REALITY-DISCREPANCIES.md` is now stale in several places
  (intents.ts, actor-phase.ts, gac-card.ts, and the four services-core
  subsystems it lists as empty). A refresh pass should follow.

## Next intents (surfacing new work discovered mid-implementation)

1. **INT-GAC-004-SCOPE-ENFORCEMENT** — wire the write-time glob wrapper
   that enforces `Intent.scope` at dispatch time. Depends on the
   Dispatcher entry-point existing in `workers/` or `agent-runtime/`.
2. **INT-GAC-003-PTY-TARGETS** — build the first real
   `AgentTarget`/`RuntimeTarget` adapter on top of node-pty + xterm.js.
   Blocked by AGENT-RUNTIME canon still being paper-only.
3. **INT-SDK-VAPP-PROOF** — wire `createEmaClient` into the three
   highest-traffic vApps (brain-dump, proposals, intents) as proof of
   concept for the facade. The user named this as the next priority
   after the schema stubs.
4. **INT-CANON-REFRESH-BLUEPRINT-REALITY** — rerun the reality pass
   against the now-built services/core subsystems and retire the stale
   sections of `BLUEPRINT-REALITY-DISCREPANCIES.md`.
5. **INT-DEC-002-CRDT-FILESYNC-BOUNDARY** — update (or confirm)
   DEC-002 states Syncthing vs Loro boundary explicitly.

## Cross-pollination cues (deferred until their own intents)

Queued for the next wave, not implemented here but surfaced for the
record so they are visible in the graph:

- **Codeman** (Ark0N, 299⭐) — ghost-session discovery on boot.
  Belongs in `workers/src/session-watcher.ts`. Closest match for EMA's
  missing session-recovery story.
- **Palinode** (Paul-Kyle, 18⭐) — 5-verb DSL
  (KEEP/UPDATE/MERGE/SUPERSEDE/ARCHIVE) for LLM-maintained markdown.
  Target: `services/core/blueprint/`.
- **SilverBullet** — Object Index + Space Lua DQL over markdown.
  Resolves DEC-001's "graph engine TBD" — not a DB, an indexer.
- **Task-Anchor-MCP** — mandatory exit_condition + scope + drift
  detection. GAC-004 dispatcher side's reference implementation.
- **emdash** — competitive threat. If EMA's moat is the wiki/research
  knowledge layer, prioritize Blueprint + graph engine over terminal
  orchestration features.
