---
id: INT-001-BOOTSTRAP-CORE-LOOP
type: intent
title: Bootstrap the canonical EMA core loop
status: active
kind: implement
priority: critical
author: system
created: 2026-04-12
updated: 2026-04-12
exit_condition: The bootstrap loop is wired through shared contracts, persisted in SQLite, covered by tests, and exposed as the baseline for the next recovery wave.
scope:
  - shared/schemas/**
  - services/core/intent/**
  - services/core/proposal/**
  - services/core/execution/**
  - services/core/loop/**
  - docs/GROUND-TRUTH.md
  - docs/BLUEPRINT.md
  - README.md
  - CLAUDE.md
tags:
  - bootstrap
  - core-loop
  - self-management
  - wave-2
connections:
  - { target: "[[EMA-GENESIS-PROMPT]]", relation: derived_from }
  - { target: "[[SCHEMATIC-v0]]", relation: references }
  - { target: "[[docs/GROUND-TRUTH]]", relation: fulfills }
  - { target: "[[docs/BLUEPRINT]]", relation: fulfills }
---

# Bootstrap the canonical EMA core loop

## Why this intent exists
The repository reached a point where intents and executions existed independently, but proposals were still split between canon aspirations, old-system memory, and partial seed-harvest code. EMA needs a single minimal loop that the system can use on itself before it can credibly claim self-management.

## Required outcome
Build and verify the minimum durable loop:
- create an intent
- generate a proposal
- approve or revise it
- start an execution
- persist artifacts
- complete or fail the execution
- emit durable events for every transition

## Constraints
- Use the current Electron/TypeScript monorepo, not a rewrite branch.
- Preserve the existing `services/core/intents/` and `services/core/executions/` domains while the bootstrap loop is additive.
- Keep persistence local-first with SQLite.
- Keep contracts in `shared/` and tests in `services/`.

## Next phase after this intent
Once this intent is complete, the next session should:
1. Attach the renderer's `ProposalsApp`, `ExecutionsApp`, and intent surfaces to the new bootstrap services.
2. Add actor-service persistence and runtime ownership semantics.
3. Unify bootstrap loop events with the existing execution/intents UI stream.
4. Decide whether `loop_executions` merges into `executions` or remains a compatibility layer.
