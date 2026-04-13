---
id: RES-PAI
type: research
layer: research
category: agent-orchestration
title: "danielmiessler/Personal_AI_Infrastructure — closest sibling, no approval gates (positioning anchor)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-d
source:
  url: https://github.com/danielmiessler/Personal_AI_Infrastructure
  stars: 11306
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: S
tags: [research, agent-orchestration, signal-S, PAI, positioning, sibling]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
  - { target: "[[DEC-003]]", relation: references }
---

# danielmiessler/Personal_AI_Infrastructure (PAI)

> Daniel Miessler's personal AI infrastructure. **The nearest conceptual sibling to EMA in scope.** Persistent personal assistant that observes/thinks/plans/executes/verifies/learns. 11k stars. **But no structured approval gate for non-code actions** — that's EMA's wedge.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/danielmiessler/Personal_AI_Infrastructure> |
| Stars | 11,306 (verified 2026-04-12) |
| Last activity | 2026-04-12 |
| Signal tier | **S** |
| License | MIT |

## What to learn

### 1. The Observe → Think → Plan → Execute → Verify → Learn loop

Canonical agentic loop. EMA's intent → proposal → execution → review → retro maps to it. **Adopt as design vocabulary.**

### 2. The positioning gap

PAI executes within security boundaries. EMA pauses for human decision **between Plan and Execute**. That's the wedge.

> "PAI executes within security boundaries; EMA pauses for human decision on every plan."

### 3. The closest comparison sibling

11k stars, active, high-profile maintainer. **This is the repo to benchmark EMA against publicly.**

### 4. Memory captures post-hoc ratings

No "pending suggestion → user decides → applied" queue. Only retrospective rating. Confirms EMA's wedge.

## Changes canon

| Doc | Change |
|---|---|
| `BLUEPRINT-PLANNER.md` | Explicitly position EMA against PAI: "PAI executes within security boundaries; EMA pauses for human decision on every plan" |
| `vapps/CATALOG.md` | phase_transitions table maps to the PAI loop stages |

## Gaps surfaced

- The clearest comparison sibling doesn't have approval gates. **EMA can cleanly claim novelty** in "personal AI with structured proposal queue" against the biggest name in the space.

## Notes

- MIT licensed.
- 11k stars, active, well-known maintainer.
- Worth public comparison to position EMA's value.

## Connections

- `[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]` — schema-side cousin
- `[[research/agent-orchestration/_MOC]]`
- `[[canon/specs/BLUEPRINT-PLANNER]]`
- `[[DEC-003]]`

#research #agent-orchestration #signal-S #PAI #positioning #sibling
