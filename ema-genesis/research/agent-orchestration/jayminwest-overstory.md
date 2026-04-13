---
id: RES-overstory
type: research
layer: research
category: agent-orchestration
title: "jayminwest/overstory — hierarchical multi-agent + SQLite mail + tiered watchdog"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/jayminwest/overstory
  stars: 1205
  verified: 2026-04-12
  last_activity: 2026-03-28
signal_tier: S
tags: [research, agent-orchestration, signal-S, hierarchy, sqlite-mail, watchdog]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]", relation: references }
  - { target: "[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
---

# jayminwest/overstory

> Hierarchical multi-agent (Orchestrator → Coordinator → Scout/Builder/Reviewer/Merger) with SQLite mail coordination and three-tier health monitoring. EMA's flat 18-actor system needs this hierarchy.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/jayminwest/overstory> |
| Stars | 1,205 (verified 2026-04-12) |
| Last activity | 2026-03-28 |
| Signal tier | **S** |

## What to steal

### 1. Tiered watchdog (the survival kit)

Three layers of health monitoring EMA has none of:
- **Mechanical daemon** — PID liveness check, fast and dumb
- **AI triage** — when failures happen, an LLM classifies them (transient / config / structural)
- **Continuous monitor agent** — long-running observer that flags drift patterns

EMA will need this the moment it runs >3 agents simultaneously.

### 2. SQLite mail with typed messages

```sql
CREATE TABLE agent_mail (
  id INTEGER PRIMARY KEY,
  from_actor TEXT,
  to_actor TEXT,        -- can be @all, @builders, @reviewers
  msg_type TEXT,        -- worker_done | merge_ready | dispatch | error | hb
  payload JSON,
  created_at TIMESTAMP,
  read_at TIMESTAMP
);
```

WAL mode SQLite gets ~1-5ms per query. Better than file-blackboard for stateful messages, worse than filesystem for vault-facing ops. **Use both.**

### 3. Role taxonomy

`Scout` (find work) → `Builder` (do work) → `Reviewer` (check work) → `Merger` (ship work). Each role is a different actor type with different capabilities. EMA's actors are all flat — hierarchy and role specialization are the missing primitives.

### 4. Persistent read-only coordinator

The Coordinator dispatches but doesn't edit files. The Builders edit but don't dispatch. **Separation of authority.** EMA conflates these — actors do both.

## Changes canon

| Doc | Change |
|---|---|
| `AGENT-RUNTIME.md` | Add "Role Taxonomy" section with Scout/Builder/Reviewer/Merger as a starter set |
| `BLUEPRINT-PLANNER.md` | Orchestrator/Coordinator/Worker hierarchy is what EMA's Actor system should evolve into |

## Gaps surfaced

- EMA's actor system has 18 flat actors. Overstory proves you need hierarchy.
- No tiered health monitoring. Crashed agents currently get noticed by the human eyeballing the UI.

## Notes

- The SQLite mail WAL-mode benchmark (~1-5ms per query) is a concrete argument for SQLite-over-network-broker in EMA's dispatcher.

## Connections

- `[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]`
- `[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]`
- `[[research/self-building/aden-hive-hive]]` — bee-hierarchy cousin
- `[[canon/specs/AGENT-RUNTIME]]`

#research #agent-orchestration #signal-S #overstory #hierarchy #sqlite-mail #watchdog
