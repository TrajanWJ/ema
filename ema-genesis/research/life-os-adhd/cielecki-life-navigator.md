---
id: RES-life-navigator
type: research
layer: research
category: life-os-adhd
title: "cielecki/life-navigator — Obsidian voice-first AI with vault context modes"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-e
source:
  url: https://github.com/cielecki/life-navigator
  stars: 32
  verified: 2026-04-12
  last_activity: 2026-01-09
signal_tier: B
tags: [research, life-os-adhd, signal-B, life-navigator, voice-first, obsidian]
connections:
  - { target: "[[research/life-os-adhd/_MOC]]", relation: references }
  - { target: "[[research/life-os-adhd/_aspiration-detection-verdict]]", relation: references }
---

# cielecki/life-navigator

> Obsidian plugin — voice-first AI that journals, plans, reflects on patterns, and manages tasks **with full vault context**. Goals are user-authored INPUTS, not AI-extracted outputs. Negative signal for `[[DEC-003]]`.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/cielecki/life-navigator> |
| Stars | 32 (verified 2026-04-12) |
| Last activity | 2026-01-09 (v0.18.7, 117 commits) |
| Signal tier | **B** |

## What to steal

### 1. Context-aware AI personas / modes

Different AI personas (Task Manager, Reflector) read your vault and produce outputs. EMA already has this via Actors — confirms the pattern is sound.

### 2. Voice-first as a primary input

Voice transcription → vault note. EMA's eventual mobile/voice channels can adopt the same primary input model.

## Gaps surfaced

- README mentions "goals" as **CONTEXT the AI reads**, NOT as output it extracts from journals. Reinforces that nobody is doing auto-detection. Confirms `[[DEC-003]]`.

## Notes

- Marketing says "reflect on patterns" — implementation reads existing notes, doesn't mine them for aspirations.

## Connections

- `[[research/life-os-adhd/_aspiration-detection-verdict]]`
- `[[DEC-003]]`

#research #life-os-adhd #signal-B #life-navigator #voice-first
