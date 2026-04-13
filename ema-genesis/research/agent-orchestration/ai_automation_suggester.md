---
id: RES-ai_automation_suggester
type: research
layer: research
category: agent-orchestration
title: "ITSpecialist111/ai_automation_suggester — Home Assistant suggestion gap (no queue)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-d
source:
  url: https://github.com/ITSpecialist111/ai_automation_suggester
  stars: 712
  verified: 2026-04-12
  last_activity: 2025-12-15
signal_tier: B
tags: [research, agent-orchestration, signal-B, ai_automation_suggester, smart-home, anti-pattern]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[DEC-003]]", relation: references }
---

# ITSpecialist111/ai_automation_suggester

> Home Assistant integration that scans entities and generates AI-suggested automation YAML, **delivered as notifications**. The anti-pattern is informative: 712 stars and **still no formal accept/reject state machine**.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/ITSpecialist111/ai_automation_suggester> |
| Stars | 712 (verified 2026-04-12) |
| Last activity | 2025-12-15 |
| Signal tier | **B** (anti-pattern evidence) |

## What to learn (not steal)

### 1. The notification-as-suggestion anti-pattern

Suggestions live as sensor attributes (`sensor.ai_automation_suggestions_<provider>`) with `description` + `yaml_block` fields. **No queue. No state machine.** Users manually copy YAML.

### 2. The lesson

If you just push suggestions to a notification stream with no persistent state, **users can't meaningfully approve/reject/revise**. Notifications expire; queues persist.

### 3. The split worth keeping

The `description` (human prose) + `payload_block` (structured) split is worth stealing. Keep human-readable rationale separate from the structured data being proposed.

### 4. Acceptance/rejection feedback is on the roadmap but not shipped

Even after 712 stars and active maintenance, the approval queue is "future work." **Confirms the niche is empty in the smart-home space.**

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` Brain Dumps | Split captured-suggestion into `description` (prose) + `payload` (structured) |
| `EMA-GENESIS-PROMPT.md §3` | Explicit note: don't just notify; persist pending state |

## Gaps surfaced

- This is a real non-code, life-adjacent domain (smart home) that has 712 stars and **still doesn't have a real approval queue**. Market gap confirmed.

## Notes

- MIT, active.
- The fact that "feedback mechanism" is still Roadmap-only despite active maintenance is the clearest signal that the approval-UX niche is underserved.

## Connections

- `[[DEC-003]]` — approval UX canon claim
- `[[research/agent-orchestration/_MOC]]`

#research #agent-orchestration #signal-B #ai_automation_suggester #anti-pattern
