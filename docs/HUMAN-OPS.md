# HUMAN-OPS

Superseded as the primary product-model doc by [docs/PERSONAL-OS.md](./PERSONAL-OS.md). This file remains useful as the earlier grounding pass that led to the backend-real Personal OS slice.

## Purpose

This pass defines the first honest EMA layer for helping the operator stay cognitively tractable: capture loose input, turn it into commitments and tasks, decide what matters now, notice overload, and recover when the day slips.

This is not a detached planner app. The model is anchored to live EMA objects where they already exist and now includes a backend-backed `human-ops` day object. The renderer still keeps local fallback cache, but the day object is no longer local-only.

## Self-location

### Current repo/session truth

- Branch: `main`
- HEAD: `f43b17dea988e9f70368c7d9f9ad95160c574478`
- Worktree: dirty before this pass; many unrelated modifications and new files already existed in renderer, services, docs, CLI, and shared packages. This pass avoids reverting or normalizing unrelated changes.
- Trust order for this pass:
  - `docs/backend/SOURCE-OF-TRUTH.md`
  - `docs/GROUND-TRUTH.md`
  - `docs/BLUEPRINT.md`
  - `docs/SESSION-MANIFEST.md`
  - `docs/PRODUCT-SURFACES-MAP.md`
  - current `services/core/*` and `apps/renderer/*` state over older plans/fantasy docs

### Authoritative files for this pass

- `docs/backend/SOURCE-OF-TRUTH.md`
- `docs/GROUND-TRUTH.md`
- `docs/BLUEPRINT.md`
- `docs/SESSION-MANIFEST.md`
- `docs/PRODUCT-SURFACES-MAP.md`
- `services/core/brain-dump/**`
- `services/core/tasks/**`
- `services/core/goals/**`
- `services/core/projects/**`
- `services/core/calendar/**`
- `services/core/user-state/**`
- `apps/renderer/src/components/**`
- `apps/renderer/src/stores/**`

## Surface audit

### Existing surfaces covering the human layer

- BrainDump / capture:
  - Renderer: `apps/renderer/src/components/brain-dump/**`
  - Backend: `services/core/brain-dump/**`
  - Verdict: real and reusable
- Journal:
  - Renderer: `apps/renderer/src/components/journal/**`
  - Backend: not re-verified as live in current service map
  - Verdict: real-looking UI, weak/misleading as a truth surface
- Notes / Wiki / memory:
  - Renderer: `notes`, `wiki`, `vault`, `memory`
  - Backend: memory is real; vault/wiki/notes HTTP seams are not reliable enough for this pass
  - Verdict: mixed, lower-trust for immediate daily operations
- Tasks:
  - Renderer: `apps/renderer/src/components/tasks/**`
  - Backend: `services/core/tasks/**`
  - Verdict: real and reusable
- Responsibilities:
  - Renderer surface exists
  - Backend not re-verified
  - Verdict: stale/misleading as current authority
- Habits:
  - Renderer surface exists
  - Backend not re-verified
  - Verdict: stale/misleading as current authority
- Focus:
  - Renderer surface exists
  - Backend not re-verified
  - Verdict: stale/misleading as current authority
- Goals / planning:
  - Renderer: `apps/renderer/src/components/goals/**`
  - Backend: `services/core/goals/**`
  - Verdict: real and reusable
- Review / observability / history:
  - Dashboard snapshot exists but depends on weak domains
  - Executions are real but execution-centric, not the human home surface
  - User-state history is real and useful
  - Verdict: partial ingredients exist, dedicated human review surface missing

### Classification

#### Real and reusable

- Brain Dump
- Tasks
- Goals
- Projects
- Calendar
- User State
- Executions, as observability context

#### Real but weak or mixed

- Dashboard patterns/cards
- Memory domain
- Wiki/Vault surfaces, because current repo truth does not justify making them the center of the daily operating layer

#### Duplicate or fragmented

- Notes vs Wiki vs Vault
- Dashboard vs launchpad vs life surfaces
- Journal vs Daily cards vs Focus

#### Stale or misleading if treated as authoritative

- Journal
- Responsibilities
- Habits
- Focus
- Notes, where they imply a backend that is not currently trustworthy

## Thinnest truthful vertical slice

The smallest serious slice is:

- `Brain Dump` as frictionless capture and inbox
- `Tasks` as execution-ready actions
- `Goals` as horizon/context
- `Calendar` as obligations, reminders, and focus blocks
- `User State` as load / overwhelm / check-in truth
- one backend-backed day object, with local fallback cache, for the daily note and manual day-level plan

That is the basis of the new `Desk` surface implemented in this pass.

## Human Ops model

### First-class objects in the current slice

- `brain dump item`
  - raw capture, low-friction, pre-clarification
  - existing EMA object
- `task`
  - concrete action that can be done, tracked, and completed
  - existing EMA object
- `goal`
  - horizon/context object used to constrain task choice and planning
  - existing EMA object
- `calendar commitment`
  - obligation, reminder, follow-up block, or focus block
  - existing EMA object via `calendar_entries`
- `user-state snapshot`
  - operator load/check-in state: mode, focus, energy, drift, distress
  - existing EMA object
- `human-ops day`
  - backend-backed operator day object keyed by date
  - stores the current day note, linked goal, pinned tasks, `now` task, and review note
  - renderer fallback cache remains, but the backend object is now primary

### Derived objects in the current slice

- `inbox item`
  - derived subset of unprocessed brain-dump items
- `daily plan`
  - derived from the human-ops day object plus selected task(s), linked goal, and commitments
- `check-in`
  - user-state mutation event plus history entry
- `focus session`
  - not first-class yet; represented honestly as a calendar focus block plus current now-task
- `recovery item`
  - derived from overload signals: distress, overdue work, stale inbox, absence of a current task, lack of commitments
- `responsibility`
  - not first-class yet; represented as a combination of goals, projects, and recurring/dated commitments
- `journal entry`
  - not first-class as a separate domain yet; the current daily note lives on the backend-backed human-ops day object
- `review`
  - derived from task completions, calendar status, and user-state history; dedicated backend object deferred
- `note / wiki memory link`
  - deferred as a first-class daily object until a trustworthy note/vault/canon bridge exists in the live product

### Why this ontology

- It reuses real EMA objects wherever possible.
- It avoids pretending the stale life/planner surfaces are operational truth.
- It keeps the daily support layer attached to work reality.
- It allows a usable “start today” surface without forcing a speculative backend rewrite.

## User journeys

### 1. Frictionless capture

- Dump text into Brain Dump from the Desk surface.
- The item lands in the live inbox queue immediately.
- No project or ontology choice is required at capture time.

### 2. Triage / clarify

- Review inbox items in Desk.
- Promote to task, archive, or delete.
- This keeps “capture” separate from “commit.”

### 3. Daily planning

- Link one active goal for the day.
- Pin the tasks that matter.
- Pick one `now` task.
- Write a short daily note tied to the selected goal and task.

### 4. “What should I do now?”

- Desk resolves a truthful answer in order:
  - current `now` task
  - overdue work
  - pinned task
  - best available open task
  - inbox if nothing else is clarified

### 5. Focus / deep work

- Focus is currently represented by:
  - one selected `now` task
  - one calendar focus block
- This is more honest than a fake timer surface backed by nothing.

### 6. Journaling / reflection

- The daily note is not a detached diary.
- It is anchored to the day, the linked goal, and the current task.
- It is used for planning, blockers, and outcomes.
- Persistence is now backend-backed through the human-ops day object, with local cache as fallback.

### 7. Check-ins / reminders / obligations

- Operator check-ins mutate the live user-state snapshot.
- Obligations and follow-ups become calendar commitments.
- This is the current truthful substitute for the stale responsibilities/focus/reminder shells.

### 8. Recovery after falling behind

- Desk derives recovery prompts from:
  - distress flag
  - crisis/scattered mode
  - overdue tasks
  - unprocessed inbox volume
  - lack of a current task
  - lack of commitment blocks
- Recovery suggestions reduce scope instead of adding more structure.

### 9. Weekly review

- Not fully implemented in this pass.
- Current truthful building blocks:
  - completed tasks
  - commitment status
  - user-state history
  - goal context
- Next stage should compile these into a dedicated weekly review surface or generated review artifact.

### 10. Linking notes and memory back to action

- Current implementation links the daily note to:
  - one goal
  - one current task
  - pinned tasks
- Stronger wiki/vault backlinks are deferred until their live service seams are trustworthy.

## UI / information architecture

### Surface set chosen

- `Desk`
  - the new human-ops home surface
- `Brain Dump`
  - deeper inbox/capture work
- `Tasks`
  - fuller task management
- `Goals`
  - horizon and decomposition
- `Projects`
  - project context where it exists

This is intentionally smaller than the current app sprawl.

### Desk

Purpose:

- single operational home for capture, triage, planning, commitments, check-ins, and recovery

Layout:

- top summary strip
- left column: capture/triage and recovery
- middle column: now, pinned tasks, daily note
- right column: check-in, commitments, goal context
- bottom strip: recent wins and active goals

Key panels/components:

- Capture + Triage
- Recovery
- Today / What should I do now?
- Daily Note
- Check-In
- Commitments + Goal Context
- Recent Wins + Context

Cross-links:

- opens Brain Dump, Tasks, Goals, Projects
- daily note links to current goal/task
- focus blocks link planning to commitments

Required data:

- brain-dump items
- tasks
- goals
- projects
- calendar entries
- user-state snapshot/history
- local daily bridge

Reuse vs new:

- reuses: existing stores/components/routes for brain-dump/tasks/goals/projects shell conventions
- new: Desk app, calendar store, user-state store, local human-ops bridge

## Cross-pollination map

### Object relationships

- Brain Dump item -> Task
- Task -> Goal context through manual day link and existing `project_id`
- Task -> Calendar commitment via focus/obligation block
- Goal -> Daily note context
- User state -> Recovery prompts
- Task completion -> Recent wins/review seed
- Calendar commitments -> obligations/reminders/follow-ups

### UI relationships

- Brain Dump informs task selection and recovery pressure.
- User-state check-ins influence recovery guidance.
- Daily note is tied to the chosen goal and now-task rather than floating separately.
- Calendar commitments are created directly from the Desk surface so “responsibility” maps to time and obligation.
- Recent completions seed review without inventing a fake review backend.

## Why the stale life surfaces were not revived

- The repo currently does not justify treating Journal, Responsibilities, Habits, or Focus as service-backed truth.
- Adding more UI shells would widen the split-brain instead of reducing it.
- Desk provides a smaller, more honest replacement surface for immediate use.

## Current limitations

- Daily note / plan persistence is local only.
- Responsibilities are represented indirectly, not as a dedicated first-class object.
- Weekly review is not yet compiled into a dedicated artifact or screen.
- Wiki/vault/note backlinks remain deferred pending trustworthy live backend seams.

## Immediate next step after this pass

- Promote the daily bridge into a real backend `human-ops` or journal/review service once the object contract is agreed.
- Add recurring commitments / check-ins so responsibilities can graduate from derived to first-class.
- Compile weekly review from tasks, calendar, user-state, and execution history.
