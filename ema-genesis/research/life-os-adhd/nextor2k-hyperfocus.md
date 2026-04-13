---
id: RES-hyperfocus
type: research
layer: research
category: life-os-adhd
title: "nextor2k/hyperfocus — output rendering rubric for ADHD-accessible AI prose"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/nextor2k/hyperfocus
  stars: 5
  verified: 2026-04-12
  last_activity: 2026-04-10
signal_tier: A
tags: [research, life-os-adhd, signal-A, hyperfocus, output-format, rendering-rubric]
connections:
  - { target: "[[research/life-os-adhd/_MOC]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
---

# nextor2k/hyperfocus

> Claude Code skill that restructures AI prose output in three modes (Clean / Flow / Zen) using **evidence-based ADHD-accessibility rules**. Output-format as first-class skill.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/nextor2k/hyperfocus> |
| Stars | 5 (verified 2026-04-12) |
| Last activity | 2026-04-10 |
| Signal tier | **A** |

## What to steal

### 1. Three rendering modes

| Mode | When | Rules |
|---|---|---|
| **Clean** | Triage / scanning | Short sentences (<20 words), answer-first, sequential not parallel chunking |
| **Flow** | Reading | Subheadings every 2-3 paragraphs for task re-entry |
| **Zen** | Deep focus | Stripped chrome, single-column, minimal links |

### 2. Task re-entry framing

Subheadings exist not for navigation but for **task re-entry** — when you step away mid-read and come back, the subheading is your bookmark. Especially relevant for a tool people step away from mid-interaction.

### 3. UserPromptSubmit hook reinjects rules every turn

Useful pattern for EMA's babysitter — rules don't drift over a long conversation if they're re-injected.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` Proposals | Add `format_mode` field to proposals (clean/flow/zen) |
| `EMA-V1-SPEC.md` | Output rubric in the render layer |

## Gaps surfaced

- EMA has no rendering rubric. Every proposal is displayed the same way regardless of whether the user is in triage or deep-focus.

## Connections

- `[[research/life-os-adhd/ravila4-claude-adhd-skills]]`
- `[[research/life-os-adhd/JackReis-neurodivergent-visual-org]]`

#research #life-os-adhd #signal-A #hyperfocus #output-format
