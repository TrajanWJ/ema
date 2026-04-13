---
id: RES-mem0
type: research
layer: research
category: context-memory
title: "mem0ai/mem0 — universal memory layer with extract/update/delete cycle"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/mem0ai/mem0
  stars: 52711
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: A
tags: [research, context-memory, signal-A, mem0, agent-memory, scoping]
connections:
  - { target: "[[research/context-memory/_MOC]]", relation: references }
  - { target: "[[research/context-memory/MemoriLabs-Memori]]", relation: references }
  - { target: "[[research/context-memory/letta-ai-letta]]", relation: references }
---

# mem0ai/mem0

> 52k stars. Universal memory layer with **extract/update/delete pipeline**. User/agent/session-scoped facts. Massive adoption means the schema/API surface is battle-tested.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/mem0ai/mem0> |
| Stars | 52,711 (verified 2026-04-12) |
| Last activity | 2026-04-12 |
| Signal tier | **A** |

## What to steal

### 1. Extract / Update / Delete cycle

Simplest working LLM-curator loop:
- Extract: pull facts from new content
- Update: merge with existing facts
- Delete: prune obsolete facts

Pairs naturally with `[[research/context-memory/Paul-Kyle/palinode]]`'s 6-verb DSL — palinode adds MERGE/SUPERSEDE/RETRACT/ARCHIVE/KEEP for finer control.

### 2. Fact scoping by `(user_id, agent_id, session_id, metadata)`

Multi-tenant memory model. EMA's actor system already has these primitives. **Adopt the table-level scoping** so memories are queryable per-actor / per-space / per-intent.

### 3. Self-hosted OSS tier with Qdrant default

Local-first evaluation baseline.

### 4. Massive adoption signal

52k stars means the schema/API surface is widely understood. EMA inheriting it gives interop with the broader agent-memory ecosystem.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-V1-SPEC.md` | Memory scoping: actor_id + space_id + intent_id as first-class keys, matching EMA's existing actor system |

## Gaps surfaced

- EMA has actor_id on tasks/executions but no "actor-scoped memory" concept. **Memory should be table-level scoping, not just a filter.**

## Notes

- Massive adoption means the schema/API surface is battle-tested.
- Skip their hosted hype; read the OSS core.

## Connections

- `[[research/context-memory/MemoriLabs-Memori]]` — execution-state cousin
- `[[research/context-memory/letta-ai-letta]]` — three-tier alternative

#research #context-memory #signal-A #mem0 #agent-memory
