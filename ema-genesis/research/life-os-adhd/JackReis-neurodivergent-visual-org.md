---
id: RES-neurodivergent-visual-org
type: research
layer: research
category: life-os-adhd
title: "JackReis/neurodivergent-visual-org — auto-detected mode switch (ND vs NT chunking)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/JackReis/neurodivergent-visual-org
  stars: 31
  verified: 2026-04-12
  last_activity: 2026-03-13
signal_tier: A
tags: [research, life-os-adhd, signal-A, neurodivergent-visual-org, mode-switching, started-at]
connections:
  - { target: "[[research/life-os-adhd/_MOC]]", relation: references }
  - { target: "[[research/life-os-adhd/adrianwedd-ADHDo]]", relation: references }
---

# JackReis/neurodivergent-visual-org

> Claude skill that auto-detects distress language and switches to "neurodivergent mode" — 3-5 chunks, buffered times, compassionate language. **Auto-detected mode switch is the novel piece.**

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/JackReis/neurodivergent-visual-org> |
| Stars | 31 (verified 2026-04-12) |
| Last activity | 2026-03-13 |
| Signal tier | **A** |

## What to steal

### 1. Auto-detected mode switch

Input text triggers different task-breakdown parameters:
- **ND mode**: 3-5 chunks + 1.5-2× time buffer
- **NT mode**: 5-7 chunks + standard times

EMA's proposal Tagger could learn this: **tag proposals by user-state signal and render differently.** Same proposal, different presentation.

### 2. Started_at as first-class

> "Celebrates task initiation, not just completion"

A `started_at` event separate from `completed_at`. EMA's task schema currently only has `completed_at`. **Initiation celebration is absent — only completion is rewarded.** Add `started_at` and treat it as a first-class celebrated event.

### 3. Mermaid for visual output

Worth considering as an alternative render for EMA's launchpad.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` Tasks | Add `started_at` separate from `completed_at`. Treat as first-class celebrated event. |
| `EMA-V1-SPEC.md` intent loop | Mode-aware rendering of proposals based on user-state signals |

## Gaps surfaced

- EMA's current task schema has no started_at. Initiation celebration is absent.
- No mode/context switching based on user state signals.

## Connections

- `[[research/life-os-adhd/adrianwedd-ADHDo]]`
- `[[research/life-os-adhd/_aspiration-detection-verdict]]`

#research #life-os-adhd #signal-A #neurodivergent-visual-org #mode-switching
