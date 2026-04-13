# HUMAN-OPS SESSION MANIFEST — 2026-04-13

## What changed

### Renderer

- added a new `Desk` app at `apps/renderer/src/components/desk/DeskApp.tsx`
- wired the new route in `apps/renderer/src/App.tsx`
- added `desk` app config in `apps/renderer/src/types/workspace.ts`
- added a launchpad tile/status entry in `apps/renderer/src/components/layout/Launchpad.tsx`

### New renderer state adapters

- `apps/renderer/src/stores/calendar-store.ts`
  - live adapter for `services/core/calendar`
- `apps/renderer/src/stores/user-state-store.ts`
  - live adapter for `services/core/user-state`
- `apps/renderer/src/stores/human-ops-store.ts`
  - backend-first store for the `human-ops` day object, with local fallback cache

### New renderer types

- `apps/renderer/src/types/calendar.ts`
- `apps/renderer/src/types/user-state.ts`
- `apps/renderer/src/types/human-ops.ts`

### Backend continuation

- `services/core/human-ops/**`
  - real day-object ledger under `/api/human-ops/day/:date`
  - derived daily-brief helper in the service layer
  - `GET /api/human-ops/brief/:date` route for a compiled daily read model

### Docs and intent

- `docs/HUMAN-OPS.md`
- `docs/HUMAN-OPS-IMPLEMENTATION-PLAN.md`
- `docs/HUMAN-OPS-SESSION-MANIFEST-2026-04-13.md`
- `ema-genesis/intents/INT-HUMAN-OPS-BOOTSTRAP/README.md`

## What is usable now

- quick capture into Brain Dump from Desk
- inbox triage from Desk
- pick and pin today’s tasks
- set one current `now` task
- link one active goal to the day
- create human commitments / focus blocks for today
- record operator check-ins against live user-state
- see derived recovery prompts
- keep a daily note and review note tied to the current day, goal, and task, backed by the new `human-ops` day object
- use Desk as the shared day surface for human priorities and agent agenda
- open `Executions`, `Proposals`, `Agents`, and `Feeds` directly from the Desk agent-workflow section

## What is explicitly bridged or deferred

- the renderer still keeps local fallback cache, but the day object is backend-backed now
- responsibilities remain a derived concept, not a first-class live backend object
- weekly review is still a next-stage implementation
- journal/focus/habits/responsibilities surfaces were not upgraded or blessed as current truth
- the daily brief exists as a backend helper and route, but it is not yet a broader product contract beyond the Human Ops slice

## Why this shape was chosen

- it reuses live EMA objects instead of reviving stale shells
- it gives the operator one place to start using EMA immediately
- it reduces split-brain by making the “human support” layer answer to real tasks, goals, commitments, and state
