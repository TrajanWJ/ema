---
id: RES-actual-ai
type: research
layer: research
category: agent-orchestration
title: "sakowicz/actual-ai — Actual Budget AI categorization with dry-run mode"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-d
source:
  url: https://github.com/sakowicz/actual-ai
  stars: 440
  verified: 2026-04-12
  last_activity: 2026-04-05
signal_tier: B
tags: [research, agent-orchestration, signal-B, actual-ai, dry-run, batch-approval]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
---

# sakowicz/actual-ai

> AI transaction categorization for Actual Budget. **Dry run mode** = simulate but don't apply, log all proposed changes for user review. The closest financial-decision approval pattern in OSS.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/sakowicz/actual-ai> |
| Stars | 440 (verified 2026-04-12) |
| Last activity | 2026-04-05 |
| Signal tier | **B** |
| License | MIT |

## What to learn

### 1. The dry-run / "guessed" pattern

Two modes:
- **Dry run** — simulate, log to console, user reviews
- **Live** — auto-apply but mark each guess with a "guessed" note for retroactive correction

This is **post-hoc review**, not pre-approval. EMA wants pre-approval, but post-hoc + "guessed" marker is the right fallback for high-volume domains where per-item approval is friction.

### 2. The volume problem

When you have 50 transactions to categorize, per-item approval is friction. The compromise: **batch-mode approval** (N suggestions at once) + "guessed" marker for post-hoc correction.

### 3. Batch approval is missing from EMA

EMA's current proposal pipeline has no batch-approval UX. For high-volume domains (transactions, brain-dump triage), this is a gap.

## Changes canon

| Doc | Change |
|---|---|
| `BLUEPRINT-PLANNER.md` Aspirations Log | Add batch-approval pattern for high-volume domains |
| `vapps/CATALOG.md` Tasks | Tasks that came from AI should carry a `guessed_by` marker even after approval |

## Gaps surfaced

- Finance is a volume-heavy domain where per-item approval doesn't scale. **EMA's current proposal pipeline has no batch-approval UX.**

## Notes

- 440 stars; MIT.
- The fact that the #1 Actual Budget AI plugin explicitly has a "dry run" flag suggests even finance users don't trust auto-categorization — but they also haven't built real queues.

## Connections

- `[[research/agent-orchestration/_MOC]]`
- `[[DEC-003]]`

#research #agent-orchestration #signal-B #actual-ai #batch-approval
