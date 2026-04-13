---
id: RES-hive
type: research
layer: research
category: self-building
title: "aden-hive/hive — multi-agent runtime with 3-tier hierarchy + self-evolving graph"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/aden-hive/hive
  stars: 10200
  verified: 2026-04-12
  last_activity: active
signal_tier: S
tags: [research, self-building, signal-S, hive, hierarchy, three-tier-approval]
connections:
  - { target: "[[research/self-building/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/jayminwest-overstory]]", relation: references }
  - { target: "[[research/self-building/gsd-build-get-shit-done]]", relation: references }
---

# aden-hive/hive

> 10.2k stars. Multi-agent runtime that **generates its own agent graph from natural-language outcome descriptions**, with self-evolving graph mechanics. The 3-tier approval hierarchy (Worker → Judge → Queen) is the missing piece in EMA's flat actor system.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/aden-hive/hive> |
| Stars | 10,200 (verified 2026-04-12) |
| Last activity | active main branch |
| Signal tier | **S** |

## What to steal

### 1. Three-tier approval hierarchy (Workers / Judges / Queens)

```
Worker bee   → does work, inquires Judge before risky steps
Judge node   → approves or escalates to Queen
Queen bee    → ultimate authority (or human-in-the-loop)
```

**This is the missing EMA governance layer.** Right now actors are flat (18 of them). Hive proves you need delegation hierarchy:
- Workers = ephemeral execution agents
- Judges = persistent reviewers
- Queens = authority/strategy

### 2. Human-in-the-loop nodes with configurable pause timeouts

Pause execution and wait for human input. Times out gracefully. EMA's existing approval pattern matches this — make it explicit in the actor topology.

### 3. Self-evolving graph mechanics

When agents fail, capture failure data and **auto-evolve the graph**. Self-improvement loop. EMA's proposal-engine Combiner hints at this but never actually implements it.

### 4. Hive metaphor maps to EMA naturally

EMA's Actor system has 18 flat actors. Bee hierarchy maps cleanly. Worth adopting as design vocabulary.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-V1-SPEC.md` intent loop | Add 3-tier approval: worker → judge → queen/human |
| `BLUEPRINT-PLANNER.md` | Add self-evolving graph pattern to Combiner |
| `vapps/CATALOG.md` Agents | Hierarchical approval instead of flat actor list |
| Actor schema | Add `parent_actor_id` for hierarchy + `actor_role` enum |

## Gaps surfaced

- EMA actors are flat (18 agents, all peers). No delegation hierarchy.
- Combiner is supposed to cross-pollinate but has no failure-driven evolution — it just clusters.

## Notes

- 10k stars, actively maintained, production-aimed.
- The hierarchical metaphor (bees) maps onto EMA's actor system naturally.

## Connections

- `[[research/agent-orchestration/jayminwest-overstory]]` — hierarchical cousin
- `[[research/self-building/gsd-build-get-shit-done]]`
- `[[research/self-building/snarktank-ralph]]`

#research #self-building #signal-S #hive #three-tier-approval
