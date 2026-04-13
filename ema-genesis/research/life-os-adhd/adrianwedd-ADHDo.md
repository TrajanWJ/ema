---
id: RES-ADHDo
type: research
layer: research
category: life-os-adhd
title: "adrianwedd/ADHDo — three-phase cognitive loop with confidence gating + crisis detection"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/adrianwedd/ADHDo
  stars: 10
  verified: 2026-04-12
  last_activity: 2026-02-11
signal_tier: S
tags: [research, life-os-adhd, signal-S, ADHDo, confidence-gating, distress-detection]
connections:
  - { target: "[[research/life-os-adhd/_MOC]]", relation: references }
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
---

# adrianwedd/ADHDo

> Neurodiversity-affirming Python assistant: **State Gathering → Cognitive Processing → Tool Execution**. Confidence gating + distress detection. EMA's Proposal Generator already builds context; ADHDo adds the missing safety layer.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/adrianwedd/ADHDo> |
| Stars | 10 (verified 2026-04-12) |
| Last activity | 2026-02-11 |
| Signal tier | **S** |

## What to steal

### 1. Three-phase cognitive loop

```
1. State Gathering    — physical state, temporal state, active tasks, environment
2. Cognitive Processing — confidence gating before action
3. Tool Execution     — actually do the thing
```

EMA's Proposal Generator already builds context (Phase 1) and dispatches (Phase 3). **The missing piece is Phase 2: confidence gating before execution.** A proposal with low confidence pauses for user confirmation; high confidence proceeds.

### 2. DistressDetector module

Crisis pattern recognition: repetitive questioning, rapid task switching, negative self-talk → de-escalation response. As a module that can **short-circuit the Scheduler**.

EMA has no user-state awareness. There's no way to say "don't surface proposals when user is in overwhelm." DistressDetector wired into the Scheduler as a pause signal would fix this.

### 3. Sub-3s response SLO

Multi-interface (web chat, Telegram, smart speaker). They commit to <3s response. Useful latency budget for EMA.

## Changes canon

| Doc | Change |
|---|---|
| `BLUEPRINT-PLANNER.md` | Add "confidence gate" before executing plans |
| `vapps/CATALOG.md` Proposals | Wire DistressDetector into the Scheduler as a pause signal |
| New schema | `UserState { mood, energy, distress_score, last_assessed }` — tracked per actor |

## Gaps surfaced

- **EMA has no user-state awareness.** No way to defer proposals during overwhelm. State model missing entirely from canon.

## Notes

- 10 stars, but the structural insight is high-value.
- Multi-interface design is a useful reference for EMA's eventual mobile/voice channels.

## Connections

- `[[research/life-os-adhd/JackReis-neurodivergent-visual-org]]`
- `[[research/life-os-adhd/_aspiration-detection-verdict]]`
- `[[canon/specs/BLUEPRINT-PLANNER]]`

#research #life-os-adhd #signal-S #ADHDo #confidence-gating #distress-detection
