---
id: RES-Dayflow
type: research
layer: research
category: life-os-adhd
title: "JerryZLiu/Dayflow — local-first automatic work journal with templated intentions"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-e
source:
  url: https://github.com/JerryZLiu/Dayflow
  stars: 5900
  verified: 2026-04-12
  last_activity: active
signal_tier: B
tags: [research, life-os-adhd, signal-B, dayflow, local-first, journal]
connections:
  - { target: "[[research/life-os-adhd/_MOC]]", relation: references }
  - { target: "[[research/life-os-adhd/_aspiration-detection-verdict]]", relation: references }
---

# JerryZLiu/Dayflow

> Local-first automatic work journal — passively watches screen activity and generates timeline summaries with AI. **5.9k stars on the templated version** proves the market exists, but nobody extends to freeform aspiration extraction.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/JerryZLiu/Dayflow> |
| Stars | 5,900 (verified 2026-04-12) |
| Last activity | active — 1,052 commits |
| Signal tier | **B** |

## What to steal

### 1. Local-first privacy posture

Screen activity capture, AI processing, all local. Never sends raw data to a cloud LLM. **EMA's aspiration detector should adopt the same posture** — local model, journal text never leaves the machine.

### 2. Screen-activity-to-timeline compression

Template for how to turn raw signal into structured memory. EMA's eventual harvesters (Git, Session, Vault, Usage, BrainDump from old build) can borrow the compression approach.

### 3. Templated morning intentions / evening reflections

`morning intentions` and `evening reflections` are **structured prompts**, not extraction from freeform. Negative signal: even the 5.9k-star leader uses templates instead of mining freeform writing.

## Changes canon

| Doc | Change |
|---|---|
| `[[DEC-003]]` aspiration detection | Cite as evidence: 5.9k stars proves market for AI journals, nobody ships auto-aspiration |

## Gaps surfaced

- Even the leader uses TEMPLATED intent fields, not freeform extraction. **Confirms the empty niche.**
- Market signal — there's huge appetite for AI journals, but nobody ships auto-aspiration detection.

## Notes

- The most popular AI journal in OSS as of April 2026.
- Local-first is the right precedent for EMA's privacy posture.

## Connections

- `[[research/life-os-adhd/_aspiration-detection-verdict]]`
- `[[DEC-003]]`

#research #life-os-adhd #signal-B #dayflow #local-first
