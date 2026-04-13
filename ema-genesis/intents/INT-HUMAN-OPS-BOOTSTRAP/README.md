---
id: INT-HUMAN-OPS-BOOTSTRAP
type: intent
layer: intents
title: "Bootstrap EMA Human Ops so the operator can actually run life and work through one truthful daily surface"
status: active
kind: bootstrap
phase: execute
priority: high
created: 2026-04-13
updated: 2026-04-13
author: codex
exit_condition: "EMA has one daily-usable Human Ops surface that supports capture, triage, daily planning, commitments, check-ins, recovery, and review seeds using live system objects instead of planner-shell fiction."
scope:
  - "apps/renderer/src/components/desk/**"
  - "apps/renderer/src/stores/calendar-store.ts"
  - "apps/renderer/src/stores/user-state-store.ts"
  - "apps/renderer/src/stores/human-ops-store.ts"
  - "apps/renderer/src/types/calendar.ts"
  - "apps/renderer/src/types/user-state.ts"
  - "apps/renderer/src/App.tsx"
  - "apps/renderer/src/types/workspace.ts"
  - "apps/renderer/src/components/layout/Launchpad.tsx"
  - "docs/HUMAN-OPS.md"
  - "docs/HUMAN-OPS-IMPLEMENTATION-PLAN.md"
connections:
  - { type: references, target: "[[docs/GROUND-TRUTH.md]]" }
  - { type: references, target: "[[docs/BLUEPRINT.md]]" }
  - { type: references, target: "[[docs/backend/SOURCE-OF-TRUTH.md]]" }
  - { type: references, target: "[[docs/PRODUCT-SURFACES-MAP.md]]" }
tags: [intent, human-ops, desk, daily-ops, recovery, operator-support]
---

# INT-HUMAN-OPS-BOOTSTRAP

## Intent

Create the first genuinely usable EMA layer for the operator’s day-to-day control loop:

- capture what appears
- clarify it
- decide what matters now
- block time for it
- check in on load
- recover when the day slips
- preserve a minimal note trail tied to actual work

## Why this is needed

The repo already has many “life” surfaces, but several of them are not currently backed by trustworthy live service seams. That makes them poor authorities for a serious operator-support layer.

The bootstrap path is to build on what is real now:

- brain dump
- tasks
- goals
- projects
- calendar
- user-state

and then add only the narrowest explicit bridge where no honest backend object exists yet.

Continuation update, 2026-04-13:

- the day bridge has now been promoted into a real `human-ops` backend domain
- the next continuation target is no longer “make the bridge real”
- it is now:
  - compile a first-class daily brief / read model
  - add weekly review
  - make responsibilities/check-ins first-class only if they generate real commitments and review pressure

## Deliverable shape

- one `Desk` surface
- one backend-backed day object with local fallback cache for the day note/plan
- one clear ontology and staged implementation path
- no fake autonomy
- no planner shell disconnected from execution reality
