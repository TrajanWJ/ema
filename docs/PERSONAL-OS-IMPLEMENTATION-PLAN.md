# EMA Personal OS Implementation Plan

Date: 2026-04-13
Status: staged plan from current repo state

## Goal

Turn the current normalized backend spine into a daily-usable human operating environment without creating a second planning system.

## Stage 0: Landed in this pass

- persist a narrow `human_ops_day`
- add a backend `daily_brief` read model
- make Desk read from backend day/brief
- make inbox triage create a real task
- show agent agenda in the same daily frame as human commitments

Exit condition:

- operator can capture, triage, pin work, set a now-task, add commitments, check in, and see agent blocks from one truthful surface

## Stage 1: Agenda quality

- add a dedicated agenda surface over the same `calendar_entries`
- support fast reschedule / defer / cancel from agenda and Desk
- expose linked task/goal context bundles for blocks
- landed now:
  - `/api/human-ops/agenda/:date`
  - renderer `Agenda` over the same calendar ledger
  - `calendar_entries.task_id` linkage for truthful task context

Exit condition:

- today and agenda use the same schedule truth, with no duplicate calendar state

## Stage 2: Review and recovery

- add a weekly review read model
- compile:
  - completed tasks
  - missed tasks
  - at-risk commitments
  - user-state drift
  - active goals without progress
  - agent activity / buildouts
- turn review into decisions:
  - reschedule
  - delegate
  - de-scope
  - abandon

Exit condition:

- review produces operational changes, not just history display

## Stage 3: Context linkage

- reconnect notes/wiki/vault only after re-verifying trust
- allow:
  - goal -> context
  - calendar block -> context
  - execution/result -> context
  - review -> context

Exit condition:

- notes support action and memory without becoming a second planner

## Stage 4: Focus and journal only if truthful

- consider a first-class `focus_session` only if calendar + now-task is insufficient
- consider a first-class journal/review artifact only if it improves reflection and review without splitting day state

Exit condition:

- any added object has real operational value and a clear storage boundary

## Do Not Build Yet

- standalone responsibilities backend
- passive journal shell detached from goals/tasks/calendar
- separate reminder store
- loop-driven human orchestration
- agent planning surface divorced from goals and calendar

## Next Highest-Leverage Thin Slice

Implement a dedicated `Agenda` read model and surface on top of existing `calendar_entries`, with:

- schedule for today and next 7 days
- linked goal/task/context bundle
- fast defer / cancel / complete
- “calendar debt” recovery cues

That is the shortest path from current Desk to a stronger real operating environment.
