# HUMAN-OPS IMPLEMENTATION PLAN

Superseded as the primary staged plan by [docs/PERSONAL-OS-IMPLEMENTATION-PLAN.md](./PERSONAL-OS-IMPLEMENTATION-PLAN.md). Kept as the earlier Desk bootstrap plan.

## Goal

Move from the current mixed/stale life surfaces to a daily-usable human support layer that helps the operator capture, decide, execute, recover, and review without pretending nonexistent systems already work.

## Current state

- Real seams available now:
  - Brain Dump
  - Tasks
  - Goals
  - Projects
  - Calendar
  - User State
- Weak or misleading seams:
  - Journal
  - Responsibilities
  - Habits
  - Focus
  - Notes/Vault as daily operating authority

## Stage 0: Landed in this pass

- Add a new `Desk` app in the renderer.
- Reuse live `brain-dump`, `tasks`, `goals`, and `projects`.
- Add renderer adapters for:
  - `calendar`
  - `user-state`
  - `human-ops` day object
- Implement workflows:
  - quick capture
  - inbox triage
  - choose a `now` task
  - pin tasks for today
  - link one active goal
  - create a commitment/focus block
  - write a daily note
  - record a check-in
  - derive recovery prompts

## Stage 1: Make the bridge backend-real

Status:

- partially complete and already landed in continuation

What landed:

- a first-class backend `human-ops` domain
- persisted day object fields:
  - daily note / plan
  - linked goal
  - now task
  - pinned tasks
  - review note
- derived helper:
  - `getHumanOpsDailyBrief(...)`
- renderer Desk now prefers the backend daily brief as its read model
- Desk exposes agent agenda plus direct links into `Executions`, `Proposals`, `Agents`, and `Feeds`

Exit condition:

- one backend-backed day object retrievable by date
- renderer treats local storage as cache/fallback, not primary truth

## Stage 2: Responsibilities become real

- Define `responsibility` as a first-class object only after it can do real work.
- Minimum contract:
  - title
  - cadence or review frequency
  - linked goals/projects
  - current status / health
  - next check-in date
  - supporting commitments/tasks

Exit condition:

- responsibilities generate real check-ins and follow-up commitments
- responsibilities surface in Desk recovery/review

## Stage 3: Weekly review

- Compile:
  - completed tasks
  - missed tasks
  - commitments completed/cancelled
  - check-in history
  - linked goals
  - recovery signals
  - optionally execution activity

Output options:

- renderer review surface
- generated markdown review artifact
- both

Exit condition:

- operator can run one weekly review flow inside EMA without leaving the system

## Stage 4: Memory and notes reconnect to action

- Re-verify live note/vault/canon seams.
- Add backlinks:
  - task -> note
  - goal -> note
  - daily note -> tasks/goals/review
  - responsibility -> reference docs

Exit condition:

- notes support action and review instead of floating beside them

## Stage 5: Focus becomes first-class only if truthful

- If focus needs more than calendar blocks:
  - create real `focus_session` backend object
  - tie to task/goal/intent
  - write completion or interruption outcome

Exit condition:

- focus surface is backed by real data and feeds review/recovery

## Sequencing principle

- do not widen the number of surfaces until the current ones tell the truth
- prefer one strong Desk surface over reviving four weak planner apps
- keep memory and action in the same loop
