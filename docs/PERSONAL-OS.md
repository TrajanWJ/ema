# EMA Personal OS

Date: 2026-04-13
Status: current product model for the human operating layer

## Session Context / Self-Location

- Branch: `main`
- HEAD: `f43b17dea988e9f70368c7d9f9ad95160c574478`
- Worktree: dirty before this pass; many unrelated renderer, services, CLI, and shared-package changes already existed
- This pass does not reactivate dormant `loop_*` systems or invent a second planning store

## Authoritative Sources For This Pass

Use these in this order when extending the human operating layer:

1. `services/core/backend/manifest.ts`
2. `docs/backend/SOURCE-OF-TRUTH.md`
3. `services/core/human-ops/*`
4. `services/core/{brain-dump,tasks,goals,calendar,user-state}/*`
5. `apps/renderer/src/components/desk/DeskApp.tsx`
6. `apps/renderer/src/stores/human-ops-store.ts`

Older life-surface docs and renderer shells are lower-trust than the active backend and current Desk implementation.

## Reusable Surfaces Audit

### Real and strong

- `Desk`
  - `apps/renderer/src/components/desk/DeskApp.tsx`
  - home surface for daily operations
- `Brain Dump`
  - `services/core/brain-dump/*`
  - `apps/renderer/src/components/brain-dump/*`
  - live capture and inbox
- `Goals`
  - `services/core/goals/*`
  - `apps/renderer/src/components/goals/*`
  - real operational objective layer
- `Calendar`
  - `services/core/calendar/*`
  - `apps/renderer/src/stores/calendar-store.ts`
  - real schedule ledger for human and agent blocks
- `Tasks`
  - `services/core/tasks/*`
  - `apps/renderer/src/components/tasks/*`
  - real action ledger
- `User State`
  - `services/core/user-state/*`
  - `apps/renderer/src/stores/user-state-store.ts`
  - real load/drift/focus signal layer

### Real but weak or partial

- `Projects`
  - useful context, not the human home surface
- `Executions`
  - useful observability and result history, not the daily operator shell
- `Notes / Wiki / Vault`
  - mixed trust; not strong enough yet to anchor the operating model

### Duplicate, misleading, or stale if treated as operational truth

- `Journal`
  - renderer exists; do not treat as current truth surface
- `Focus`
  - renderer exists; not a trustworthy backend authority today
- `Responsibilities`
  - renderer exists; not a live first-class backend object today
- `Habits`
  - same issue

## Current Personal OS Model

EMA Personal OS is the human-operating layer built on the active backend spine:

`intent canon -> operational objects -> human_ops_day -> daily_brief -> Desk`

### First-class objects

- `intent`
  - semantic truth
  - canon-backed
- `goal`
  - operational ownership/objective
  - SQLite-backed
- `calendar_entry`
  - human commitments and agent virtual blocks
  - SQLite-backed
- `task`
  - concrete action
  - SQLite-backed
- `execution`
  - work-run ledger and result evidence
  - SQLite-backed
- `brain_dump item`
  - unstructured capture
  - SQLite-backed inbox
- `user_state`
  - operator mode, focus, energy, distress, drift
  - SQLite-backed
- `human_ops_day`
  - persisted day context for Desk only
  - SQLite-backed
  - fields:
    - `date`
    - `plan`
    - `linked_goal_id`
    - `now_task_id`
    - `pinned_task_ids`
    - `review_note`

### Derived objects

- `daily_brief`
  - backend read model over:
    - inbox
    - actionable tasks
    - overdue tasks
    - pinned tasks
    - now task
    - active goals
    - human schedule
    - agent schedule
    - user-state
    - recovery prompts
- `inbox`
  - unprocessed brain-dump subset
- `today`
  - day object plus daily brief
- `recovery queue`
  - derived prompts from overload, overdue work, stale inbox, and at-risk commitments
- `agent agenda`
  - grouped agent calendar blocks for the day

### Objects not first-class yet

- `journal entry`
- `focus session`
- `responsibility`
- `review`
- `reminder`

They may become real later, but they are not current storage truth.

## Ownership Model

- Human-owned:
  - `human_ops_day`
  - human `goal`
  - human `calendar_entry`
  - `user_state`
  - `brain_dump item`
  - most `task`
- Agent-owned:
  - agent `goal`
  - agent `calendar_entry` buildout blocks
  - many `execution` rows
- Shared:
  - `intent`
  - `execution` lineage
  - linked notes/context later

## Daily Experience

The intended reduced IA is:

1. `Desk / Today`
2. `Capture / Inbox`
3. `Goals`
4. `Agenda`
5. `Review`
6. `Notes / Context`
7. `Agent Work`

Today, the usable center is still `Desk`, with other surfaces supporting it.

### Desk layout

- Left column:
  - capture
  - inbox triage
  - recovery prompts
- Middle column:
  - now decision
  - pinned tasks
  - daily note
- Right column:
  - check-in
  - human commitments
  - goal linking
  - agent agenda
- Bottom:
  - recent wins
  - active goals

### Empty and overload states

- empty inbox:
  - show that capture is still the landing pad
- no tasks:
  - route to inbox or task creation
- overload:
  - reduce scope to one task and one block
- no commitments:
  - explicitly tell the user the day is unprotected

## Core Workflows

### 1. Frictionless capture

- User dumps text into Desk or Brain Dump
- Item lands in `brain_dump`

### 2. Inbox triage

- Item becomes:
  - real task
  - archive
  - delete

### 3. Clarify into commitment

- Task is pinned or selected as `now`
- Optional goal is linked
- A real calendar block can be created from the task

### 4. Decide what matters today

- `human_ops_day` stores:
  - linked goal
  - pinned tasks
  - now task
  - daily note

### 5. Scheduling and rescheduling

- Human commitments live in `calendar_entries`
- Agent phased work also lives in `calendar_entries`
- Desk shows both without hiding agent work in a separate subsystem

### 6. What should I do now?

- `daily_brief.next_action_label` resolves in this order:
  - current now-task
  - overdue task
  - pinned task
  - suggested task
  - inbox processing

### 7. Focus

- Current truthful focus representation:
  - now-task
  - human focus block

### 8. Reflection

- Daily note is not detached from action
- It is part of the persisted day object

### 9. Recovery

- Recovery prompts use:
  - distress
  - scattered/crisis mode
  - overdue tasks
  - inbox pressure
  - missing commitment blocks
  - at-risk commitments

### 10. Agent delegation awareness

- Agent work is visible through agent schedule blocks
- Human and agent work share one planning frame through goals and calendar

## Cross-Pollination Rules

- Brain dump items must be promotable into real tasks
- Linked goal must shape day context and commitment creation
- Calendar blocks should surface linked goal/task context
- User-state must affect recovery guidance
- Agent buildouts must appear beside human commitments, not in a hidden subsystem
- Completed tasks and executions become review input, not dead rows

## What This Pass Implemented

- a backend-real `human_ops_day` object at `/api/human-ops/day/:date`
- a derived `daily_brief` read model at `/api/human-ops/brief/:date`
- a derived `agenda` read model at `/api/human-ops/agenda/:date`
- real inbox-to-task promotion at `/api/brain-dump/items/:id/task`
- Desk now reads from backend day/brief instead of local-only planner state
- Desk now shows agent agenda alongside human commitments
- Agenda now acts on the same `calendar_entries` ledger for reschedule, complete, and cancel

## Explicit Deferrals

Do not build these as first-class truth surfaces yet:

- journal backend
- focus session backend
- responsibilities backend
- standalone reminder backend
- detached notes-first planner

Those should only be added when they can answer to the same backend spine instead of splitting it.
