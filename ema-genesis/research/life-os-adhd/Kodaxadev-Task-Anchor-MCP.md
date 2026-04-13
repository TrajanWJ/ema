---
id: RES-task-anchor-mcp
type: research
layer: research
category: life-os-adhd
title: "Kodaxadev/Task-Anchor-MCP — drift detection scoring + task locks (1 star, S-tier mechanism)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/Kodaxadev/Task-Anchor-MCP
  stars: 1
  verified: 2026-04-12
  last_activity: 2026-03-25
signal_tier: S
tags: [research, life-os-adhd, signal-S, task-anchor-mcp, drift-detection, exit-condition]
connections:
  - { target: "[[research/life-os-adhd/_MOC]]", relation: references }
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
---

# Kodaxadev/Task-Anchor-MCP

> **1 star — but the mechanism is the best EMA-structural insight in this category.** Don't weight by stars. MCP server enforcing ADHD executive function via task locks, drift detection scoring, and mandatory completion validation.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/Kodaxadev/Task-Anchor-MCP> |
| Stars | 1 (verified 2026-04-12) |
| Last activity | 2026-03-25 |
| Signal tier | **S** (mechanism, not popularity) |

## What to steal

### 1. Drift detection scoring (the killer idea)

26 weighted signal phrases:
- "while we're at it" = 5 points
- "actually" = 2 points
- "let me also" = 3 points
- ...

Sum per message; score ≥4 **auto-parks** the off-topic idea to a queue.

EMA already has a BrainDump inbox. Wire a DriftDetector over agent conversations that **auto-creates BrainDump items when the user drifts mid-task**. This is the cleanest pattern in this whole research category.

### 2. Task locks with exit conditions

```typescript
task_lock {
  task_id: string
  exit_condition: string    // "tests passing AND PR open"
  scope: string[]           // file globs allowed to be edited
  expires_at: timestamp
}
```

Plus `scope_validate_edit(file_path)` blocks out-of-scope edits. **The stateful boundary EMA's execution dispatcher is missing.**

### 3. Mandatory completion validation

Tasks can't be marked done without satisfying the exit_condition. No more "Claude said it's done."

### 4. Architecturally superior to most larger repos

Don't weight by stars. The mechanism is what matters.

## Changes canon

| Doc | Change |
|---|---|
| `BLUEPRINT-PLANNER.md` | Add task lock / exit condition / scope as **mandatory** fields for executions |
| `vapps/CATALOG.md` Brain Dumps | Add auto-capture from detected drift |
| `EMA-V1-SPEC.md` intent loop | Intent must specify `exit_condition` + `scope` before dispatch |

## Gaps surfaced

- **EMA executions have no exit_condition field and no scope enforcement.** Dispatcher happily runs agents with unbounded scope — a bug surface canon ignores.

## Notes

- 1 star, but the mechanism is the best structural insight in this batch.
- The pattern is small enough to read end-to-end.

## Connections

- `[[research/life-os-adhd/ravila4-claude-adhd-skills]]`
- `[[research/self-building/snarktank-ralph]]`
- `[[canon/specs/BLUEPRINT-PLANNER]]`

#research #life-os-adhd #signal-S #task-anchor-mcp #drift-detection
