# Backend Deduplication Decisions

This file collapses the current backend to one active model per duplicated concept.

## Intent

- Active
  - `shared/schemas/intents.ts`
  - `services/core/intents/*`
- Future
  - `shared/schemas/intent.ts`
  - `services/core/intent/*`
- Ignore for now
  - `loop_intents`

Reason: the pluralized intent service is the active filesystem-backed mirror and is populated in the current runtime DB.

## Execution

- Active
  - `shared/schemas/executions.ts`
  - `services/core/executions/*`
- Future
  - `shared/schemas/execution.ts`
  - `services/core/execution/*`
- Ignore for now
  - `loop_executions`

Reason: the pluralized execution service is the only execution ledger wired into routes, websocket handlers, and the current DB.

## Planning

- Active
  - `shared/schemas/goals.ts`
  - `shared/schemas/calendar.ts`
  - `services/core/goals/*`
  - `services/core/calendar/*`
- Future
  - automation layered on top of the same goals/calendar ledger
- Ignore for now
  - old `meetings` CRUD as the main planning model
  - `temporal` heuristics as storage truth
  - `calendar driver` as the active scheduler foundation

Reason: the current backend needs one operational planning layer. Goals hold owned objectives; calendar entries hold scheduled human commitments and agent virtual blocks.

## Proposal

- Active
  - `shared/schemas/proposal.ts`
  - `services/core/proposal/*`
- Supporting inputs
  - `services/core/proposals/*`
- Ignore for now
  - renderer-era queue semantics and any second live proposal store

Reason: durable proposals are now part of the active backend loop. The old plural proposal package remains an input-harvesting layer, not a competing runtime owner.

## Review

- Active
  - `shared/schemas/review.ts`
  - `services/core/review/*`
- Upstream source
  - `services/core/chronicle/*`
- Ignore for now
  - implicit promotion from Chronicle straight into proposals, intents, or canon without a durable decision record

Reason: Chronicle is the provenance layer; Review is the decision layer on top of it. Decisions and promotion receipts now have one explicit backend owner.

## Backend Loop

- Active
  - canon/filesystem -> runtime intent mirror -> durable proposals -> executions -> results
- Future
  - `services/core/loop/*` as a supervisor over the same proposal/execution lifecycle
- Ignore for now
  - treating bootstrap loop entities as a second live backend spine

Reason: the live route wiring now includes durable proposals, but the intent and execution ledgers are still the pluralized runtime surfaces.

## CLI

- Active
  - `cli/src/index.ts`
- Deprecated/noise
  - `scripts/ema`
  - legacy wrappers under `bin/`

Reason: the packaged TypeScript CLI currently runs through `cli/src/index.ts`.

## Runtime / Session Control

- Active
  - `services/core/runtime-fabric/*`
  - `ema runtime ...`
  - renderer `Terminal` app
- Future
  - richer node-pty/xterm.js transport and replay on the same contract
- Ignore for now
  - `SessionsApp`
  - `Claude Bridge`
  - `Agent Bridge`
  - `Cli Manager`

Reason: the tmux-backed runtime fabric is now the single active path for tool detection, session launch, prompt dispatch, screen capture, and input relay. The older session surfaces remain historical shells unless intentionally migrated.

## Docs

- Active
  - `docs/backend/*`
  - `README.md`
  - `CLAUDE.md`
  - `ema-genesis/_meta/*`
- Historical only
  - old architecture and migration docs that describe legacy systems as current

Reason: future agents need one current backend truth set, not a pile of partially-true narratives.
