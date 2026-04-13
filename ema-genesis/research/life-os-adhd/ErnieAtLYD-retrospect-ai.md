---
id: RES-retrospect-ai
type: research
layer: research
category: life-os-adhd
title: "ErnieAtLYD/retrospect-ai — confidence-scored pattern detection with threshold UX"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-e
source:
  url: https://github.com/ErnieAtLYD/retrospect-ai
  stars: 4
  verified: 2026-04-12
  last_activity: 2025-09
signal_tier: A
tags: [research, life-os-adhd, signal-A, retrospect-ai, confidence-ux, pattern-detection]
connections:
  - { target: "[[research/life-os-adhd/_MOC]]", relation: references }
  - { target: "[[research/life-os-adhd/_aspiration-detection-verdict]]", relation: references }
  - { target: "[[DEC-003]]", relation: references }
---

# ErnieAtLYD/retrospect-ai

> Obsidian plugin generating weekly AI-powered journal reflections with **confidence-scored pattern detection**. The pattern + confidence + threshold UX is the **direct visual template for EMA's Aspirations Log**.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/ErnieAtLYD/retrospect-ai> |
| Stars | 4 (verified 2026-04-12) |
| Last activity | 2025-09 (mvp-release branch, 229 commits) |
| Signal tier | **A** |

## What to steal

### 1. Confidence-scored pattern detection UX

```
Mood Patterns (Confidence: 0.85)
  - You wrote about anxiety 4 times this week (avg 0.78)
  - Sleep mentioned 6 times negative (avg 0.92)
  [Adjust threshold] [View entries]
```

Confidence threshold sliders. The visual treatment is **exactly what EMA's Aspirations Log needs** — point it at aspirations instead of moods.

### 2. The detector category is wrong; the surface is right

This detects mood/activity/sleep patterns. EMA needs aspirations. But the **display idiom** (pattern + confidence + adjustable threshold) ports cleanly.

## Changes canon

| Doc | Change |
|---|---|
| `BLUEPRINT-PLANNER.md` Aspirations Log | Use confidence-threshold sliders, same visual treatment |

## Gaps surfaced

- Confirmed by `[[research/life-os-adhd/_aspiration-detection-verdict]]` as the closest UX template; nothing aimed at aspirations specifically.

## Notes

- 4 stars but the UX template is the most useful element from R2-E's empty-niche search.

## Connections

- `[[DEC-003]]` — aspiration detection canon claim
- `[[research/life-os-adhd/_aspiration-detection-verdict]]`

#research #life-os-adhd #signal-A #retrospect-ai #confidence-ux
