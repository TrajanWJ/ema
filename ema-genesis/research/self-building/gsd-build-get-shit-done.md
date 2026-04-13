---
id: RES-gsd-build
type: research
layer: research
category: self-building
title: "gsd-build/get-shit-done — STATE.md + 5-phase Discuss/Plan/Execute/Verify/Ship cycle"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/gsd-build/get-shit-done
  stars: 50800
  verified: 2026-04-12
  last_activity: active
signal_tier: S
tags: [research, self-building, signal-S, gsd, state-md, five-phase]
connections:
  - { target: "[[research/self-building/_MOC]]", relation: references }
  - { target: "[[research/self-building/snarktank-ralph]]", relation: references }
  - { target: "[[research/self-building/aden-hive-hive]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
---

# gsd-build/get-shit-done

> **50.8k stars, trending hard.** Claude Code context-engineering system with 5-phase cycle and STATE.md as the persistent decision log. EMA should adopt the file conventions for viral compatibility.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/gsd-build/get-shit-done> |
| Stars | 50,800 (verified 2026-04-12) |
| Last activity | active (50k+ stars trending) |
| Signal tier | **S** |

## What to steal

### 1. STATE.md as auditable decision log

The missing governance surface. EMA has proposals but no persistent state doc per project. STATE.md formalizes:
- Current decisions
- Active blockers
- Progress tracking
- Decision rationale

EMA should ship `STATE.md` per project as the canon-side mirror of the daemon's actor/intent tables.

### 2. The 5-phase cycle

```
Discuss → Plan → Execute → Verify → Ship
```

Maps nearly 1:1 onto EMA's intent → plan → execute → review → retro phase transitions. **Adopt the verb set.**

### 3. Wave execution

Group tasks by dependencies, parallel waves with **fresh context windows per task**. Concrete pattern for EMA's Dispatcher.

### 4. Human approval gates the roadmap before code

> Approval gates the ROADMAP before any code is written.

This is the canonical approval pattern EMA needs. Approve the plan, not the code.

### 5. The viral distribution surface

50k stars and trending means a large user base already knows the file convention. **Adopting STATE.md / PROJECT.md / REQUIREMENTS.md / ROADMAP.md gives EMA viral interop** — users coming from GSD don't need to learn new files.

## Changes canon

| Doc | Change |
|---|---|
| `BLUEPRINT-PLANNER.md` | Add STATE.md-style project journal as mandatory |
| `EMA-V1-SPEC.md` intent loop | Formalize the 5-phase cycle |
| `vapps/CATALOG.md` Blueprint Planner | Add wave execution as a first-class dispatcher mode |

## Gaps surfaced

- EMA has phase_transitions table but no STATE.md-equivalent document that accumulates decisions+blockers in the vault.
- Approval gate exists but isn't tied to a roadmap doc — there's no "approved roadmap" primitive.

## Notes

- 50k stars and trending hard.
- Adopting its file conventions gives EMA viral compatibility with a large ecosystem.

## Connections

- `[[research/self-building/snarktank-ralph]]` — fresh-context cousin
- `[[research/self-building/aden-hive-hive]]` — hierarchical alternative
- `[[research/self-building/loomio-loomio]]` — decision-as-data complement
- `[[canon/specs/EMA-V1-SPEC]]`
- `[[canon/specs/BLUEPRINT-PLANNER]]`

#research #self-building #signal-S #gsd #state-md #five-phase
