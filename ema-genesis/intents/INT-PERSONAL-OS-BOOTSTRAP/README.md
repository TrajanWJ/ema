---
id: INT-PERSONAL-OS-BOOTSTRAP
type: intent
layer: intents
title: "Bootstrap EMA Personal OS so the operator can run life and work from one truthful operating surface"
status: active
kind: bootstrap
phase: execute
priority: high
created: 2026-04-13
updated: 2026-04-13
author: codex
exit_condition: "Desk is backed by a persisted day object and daily brief, inbox triage creates real tasks, and human + agent schedule context appears in one coherent operating frame."
scope:
  - "services/core/human-ops/**"
  - "services/core/brain-dump/**"
  - "services/core/tasks/tasks.service.ts"
  - "services/core/backend/manifest.ts"
  - "apps/renderer/src/components/desk/**"
  - "apps/renderer/src/stores/human-ops-store.ts"
  - "apps/renderer/src/stores/brain-dump-store.ts"
  - "apps/renderer/src/types/human-ops.ts"
  - "docs/PERSONAL-OS.md"
  - "docs/PERSONAL-OS-IMPLEMENTATION-PLAN.md"
connections:
  - { type: references, target: "[[docs/backend/SOURCE-OF-TRUTH.md]]" }
  - { type: references, target: "[[docs/PERSONAL-OS.md]]" }
  - { type: references, target: "[[docs/PERSONAL-OS-IMPLEMENTATION-PLAN.md]]" }
tags: [intent, personal-os, desk, goals, calendar, recovery, operator-support]
---

# INT-PERSONAL-OS-BOOTSTRAP

## Intent

Make EMA the beginning of a genuine personal operating system instead of a collection of partially overlapping planner shells.

## What this bootstrap means

The system should help the operator:

- capture loose input
- clarify it into real work
- decide what matters now
- protect time for it
- notice overload
- recover without hiding truth
- see agent work inside the same planning frame

## Current implementation bias

Build upward from the active spine only:

- intents remain semantic truth
- goals, tasks, calendar, user-state, and executions remain operational truth
- `human_ops_day` is the narrow day bridge
- `daily_brief` is the derived Desk contract

## Explicit non-goals

Do not use this intent to:

- reactivate dormant `loop_*` systems
- invent a detached journal planner
- introduce a second planning database
- build notes-first operating surfaces without a verified context spine
