---
id: RES-claude-adhd-skills
type: research
layer: research
category: life-os-adhd
title: "ravila4/claude-adhd-skills — Claude Code skills for ADHD with nudge hook pattern"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/ravila4/claude-adhd-skills
  stars: 47
  verified: 2026-04-12
  last_activity: 2026-03-01
signal_tier: S
tags: [research, life-os-adhd, signal-S, claude-adhd-skills, nudge-pattern]
connections:
  - { target: "[[research/life-os-adhd/_MOC]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
---

# ravila4/claude-adhd-skills

> Claude Code skills + hooks for ADHD: daily-journal, nudge (time reminders), obsidian-vault org, TDD enforcement. The **nudge hook pattern** is the killer detail.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/ravila4/claude-adhd-skills> |
| Stars | 47 (verified 2026-04-12) |
| Last activity | 2026-03-01 |
| Signal tier | **S** |

## What to steal

### 1. The nudge hook pattern

`UserPromptSubmit` hook checks for due alerts and **injects them into context**. Every Claude call carries pending reminders. EMA's babysitter should inject nudges the same way.

### 2. Promise/Nudge as a first-class object

EMA has tasks (with due_at) but no concept of "time-bound promise" — "remind me about standup in 30m." A `Promise` schema distinct from `Task` would cover the 30-minute self-contract pattern.

### 3. Conversational journaling vs git-scrape

The journal skill **asks about your day** instead of scraping commit logs. Active elicitation, not passive observation. EMA's Journal app should adopt this.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` Journal app | Replace passive git-scrape with conversational elicitation |
| `EMA-V1-SPEC.md` intent loop | Add nudge-injection as a standard context layer |
| New schema | `Promise { id, body, remind_at, source_intent_id?, fired_at }` |

## Gaps surfaced

- EMA has no concept of "time-bound promise" — only tasks with due_at. The Promise schema is a missing primitive.

## Notes

- Only 4 skills but each is a testable unit.
- Integrates cleanly with Obsidian vault convention EMA already uses.

## Connections

- `[[research/life-os-adhd/nextor2k-hyperfocus]]`
- `[[research/life-os-adhd/_aspiration-detection-verdict]]`
- `[[canon/specs/EMA-V1-SPEC]]`

#research #life-os-adhd #signal-S #claude-adhd-skills #nudge-pattern
