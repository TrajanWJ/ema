---
id: RES-ralph
type: research
layer: research
category: self-building
title: "snarktank/ralph — fresh context per iteration with 3-file memory pattern"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/snarktank/ralph
  stars: 15500
  verified: 2026-04-12
  last_activity: 2026-01-07
signal_tier: S
tags: [research, self-building, signal-S, ralph, fresh-context, simplicity]
connections:
  - { target: "[[research/self-building/_MOC]]", relation: references }
  - { target: "[[research/self-building/gsd-build-get-shit-done]]", relation: references }
  - { target: "[[research/life-os-adhd/Kodaxadev-Task-Anchor-MCP]]", relation: references }
---

# snarktank/ralph

> 15.5k stars. **Autonomous loop: fresh Claude Code instance per iteration**, prd.json tracks completion, progress.txt tracks learnings, git history is the only memory between iterations. **Simplicity beats architecture.**

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/snarktank/ralph> |
| Stars | 15,500 (verified 2026-04-12) |
| Last activity | 2026-01-07 |
| Signal tier | **S** |

## What to steal

### 1. Fresh context per iteration as architectural primitive

EMA's current model leaks context across agent runs. Ralph's pattern: each iteration starts with a clean Claude instance and reads:
- `prd.json` — what to do
- `progress.txt` — what's been done so far + learnings
- `git log` — actual changes

No memory bleed. No prompt drift. No context window bloat.

### 2. The three-file memory pattern (the sleeper insight)

```
prd.json         # specification — what we're building
progress.txt     # learnings + blockers + decisions
git history     # the actual code progress
```

**No database, no vector store, no embeddings.** Three files. Genius in its simplicity.

EMA's executions should write a per-iteration progress artifact that the next iteration reads. Combined with `[[research/self-building/gsd-build-get-shit-done]]`'s STATE.md pattern, that's the entire memory layer.

### 3. "Stories must be small enough to complete in one context window"

Hard validation rule on intents — **reject intents that don't fit**. EMA has no intent-sizing validation. An intent "refactor the whole codebase" is accepted the same as "rename this variable."

### 4. Ralph is a bash loop

Geoffrey Huntley's thesis: "Ralph is a bash loop." Infrastructure simplicity beats architecture. EMA's proposal engine has 9 GenServers where Ralph has a `while` loop. **Worth a simplification audit.**

## Changes canon

| Doc | Change |
|---|---|
| `EMA-V1-SPEC.md` intent loop | Add "one-context-window" sizing validation |
| `vapps/CATALOG.md` executions | Add progress.txt-style learning log per run |
| `BLUEPRINT-PLANNER.md` | Fresh-context iteration as a dispatcher guarantee |

## Gaps surfaced

- EMA has no intent-sizing validation. Accepts intents of any scope.
- No learning log between runs — each execution starts amnesic.

## Notes

- 15.5k stars; the simplicity argument is the killer.
- Worth a simplification audit of EMA's old proposal pipeline.

## Connections

- `[[research/self-building/gsd-build-get-shit-done]]`
- `[[research/self-building/aden-hive-hive]]`
- `[[research/life-os-adhd/Kodaxadev-Task-Anchor-MCP]]`

#research #self-building #signal-S #ralph #fresh-context #simplicity
