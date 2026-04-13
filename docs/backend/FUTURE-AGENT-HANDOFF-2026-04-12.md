# Future Agent Handoff — Backend Normalization + Proposal Convergence

## What Changed

- Added an explicit backend manifest in code:
  - `services/core/backend/manifest.ts`
  - `services/core/backend/backend.router.ts`
- Replaced implicit router directory scanning with manifest-driven router registration in `services/http/server.ts`.
- Normalized the active backend documentation under `docs/backend/`.
- Activated the durable proposal lifecycle in the real backend path:
  - `/api/proposals` is now owned by `services/core/proposal/*`
  - `services/core/proposals/*` remains a supporting harvester/input layer only
  - approved proposals can start executions in the active `executions` ledger
- Added an operational planning layer:
  - `/api/goals` for human and agent goals
  - `/api/calendar` for human schedule and agent virtual planning blocks
  - `POST /api/calendar/buildouts` for explicit phased agent buildouts

## What Is Authoritative Now

- `docs/backend/*` for current backend architecture truth
- `/api/backend/manifest` for machine-readable backend truth
- active runtime services under:
  - `services/core/intents/*`
  - `services/core/blueprint/*`
  - `services/core/goals/*`
  - `services/core/calendar/*`
  - `services/core/proposal/*`
  - `services/core/executions/*`
  - `services/core/spaces/*`
  - `services/core/user-state/*`

## What Is Intentionally Still Deferred

- `services/core/loop/*` as the supervising orchestration layer
- full actor runtime
- large frontend rewiring
- treating vault/wiki as live backend truth
- renaming historical `loop_*` proposal tables to cleaner runtime names

## Where To Plug In New Capability

- New semantic entities
  - only if they clearly belong beside intent/GAC canon and have a source-of-truth story
- New operational state
  - via SQLite-backed services with explicit ownership
- Planning and scheduling
  - use `goals` for owned objectives and `calendar_entries` for scheduled commitments or phased buildouts
- New proposal automation
  - through `services/core/proposal/*`, optionally fed by `services/core/proposals/*` harvesters
- New interface behavior
  - against existing backend contracts or `/api/backend/manifest`

## What Not To "Fix" Prematurely

- Do not migrate everything to `loop_*` just because it looks cleaner.
- Do not preserve both pluralized and singularized proposal systems as equally active.
- Do not treat harvested seeds as a second live proposal model.
- Do not reintroduce old `meetings`, `temporal`, or `calendar-driver` code as competing planning write paths.
- Do not widen the backend contract to match stale frontend expectations.
- Do not treat legacy docs as code truth.
