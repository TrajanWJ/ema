---
id: RES-sugar
type: research
layer: research
category: agent-orchestration
title: "roboticforce/sugar — issue→fix→verify→PR pipeline with persistent SQLite memory"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/roboticforce/sugar
  stars: 68
  verified: 2026-04-12
  last_activity: 2026-04-09
signal_tier: A
tags: [research, agent-orchestration, signal-A, sugar, verification, seed-repo]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/shep-ai-shep]]", relation: references }
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
---

# roboticforce/sugar

> User-flagged seed repo. Issue → Resolve → **Verify** → Ship pipeline. The verification stage is the steal target — EMA's Dispatcher stops at "agent runs"; sugar shows the full loop through testing.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/roboticforce/sugar> |
| Stars | 68 (verified 2026-04-12) |
| Last activity | 2026-04-09 |
| Signal tier | **A** |

## What to steal

### 1. The verify stage between agent output and task completion

> "Claude said it's done" ≠ "tests pass."

Sugar forces a verify stage:
1. Discover labeled issues
2. Resolve via Claude
3. **Verify via automated tests** (the missing step)
4. Ship as PR

EMA's Proposal pipeline (Generator → Refiner → Debater → Tagger) is the *planning* side. Sugar's pipeline is the *execution* side. Combine them.

### 2. Persistent SQLite memory across 7 memory types

Decisions, preferences, error patterns, research findings, etc. — typed memory entries. EMA's Memori cousin (`[[research/context-memory/MemoriLabs-Memori]]`) does the same with cleaner attribution.

### 3. MCP integration

Sugar exposes memory and task management via MCP, so Claude Code can read project knowledge directly during sessions. EMA's MCP server should expose intent + execution state the same way.

## Changes canon

| Doc | Change |
|---|---|
| `BLUEPRINT-PLANNER.md` | Add full issue→verify→PR pipeline as EMA's target execution flow |
| `AGENT-RUNTIME.md` | Add verification step between agent output and task completion |
| `[[canon/specs/EMA-V1-SPEC]]` | Execution lifecycle gains a Verify state |

## Gaps surfaced

- EMA has no verification step between agent output and task completion. The Dispatcher trusts the agent's "done" claim.

## Notes

- Low stars (68) but the schema and pipeline are solid.
- Smaller project — easier to read end-to-end than 6k-star alternatives.
- One of the user's seed repos.

## Connections

- `[[research/agent-orchestration/shep-ai-shep]]` — cousin seed
- `[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]` — fleet alternative
- `[[canon/specs/BLUEPRINT-PLANNER]]`

#research #agent-orchestration #signal-A #sugar #verification #seed-repo
