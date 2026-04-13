---
id: RES-donetick
type: research
layer: research
category: life-os-adhd
title: "donetick/donetick — Go task/chore app with adaptive completion-based scheduling"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/donetick/donetick
  stars: 2100
  verified: 2026-04-12
  last_activity: 2026-02-14
signal_tier: A
tags: [research, life-os-adhd, signal-A, donetick, adaptive-scheduling, weekly-flex]
connections:
  - { target: "[[research/life-os-adhd/_MOC]]", relation: references }
---

# donetick/donetick

> Go task/chore app with **adaptive scheduling that learns from historical completion patterns** — not a fixed cadence. Adds adaptive layer on top of utility-explorer's flex-block model.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/donetick/donetick> |
| Stars | 2,100 (verified 2026-04-12) |
| Last activity | 2026-02-14 |
| Signal tier | **A** |

## What to steal

### 1. Completion-date-based recurrence

NOT due-date-based. **Recurring tasks reset based on when you actually complete them**, not on a fixed calendar. Same distinction utility-explorer makes.

### 2. Adaptive learning from history

Donetick adds: "learn from historical completions to suggest due dates automatically." Real adaptive-cadence algorithm, not just a flex block.

```
task: change_water_filter
historical_intervals: [180d, 165d, 195d, 175d]
suggested_next: 178d  (rolling average)
```

### 3. NL task parsing

> "Change water filter every 6 months" → schedule object

Deterministic, not LLM-only. **A better brain-dump-to-task primitive than most AI pipelines** because it doesn't hallucinate. Pair with LLM for ambiguous cases.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` Tasks | Add `completion_based` recurrence mode + adaptive learning |
| `vapps/CATALOG.md` Brain Dumps | NL-to-schedule parser as a deterministic transform step |
| `Responsibility` schema | Replace fixed `cadence` with `cadence_strategy: 'fixed' \| 'adaptive'` |

## Gaps surfaced

- EMA Responsibilities only support fixed daily/weekly/monthly cadences. No "learns from how you actually complete things."
- Brain dump parser is LLM-only — no deterministic layer.

## Notes

- 2.1k stars; mature Go codebase.
- Useful as reference for the Responsibilities module.

## Connections

- `[[research/life-os-adhd/_MOC]]`

#research #life-os-adhd #signal-A #donetick #adaptive-scheduling
