---
id: RES-Memori
type: research
layer: research
category: context-memory
title: "MemoriLabs/Memori — SQL-native execution-state memory for agents"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/MemoriLabs/Memori
  stars: 13294
  verified: 2026-04-12
  last_activity: 2026-04-10
signal_tier: A
tags: [research, context-memory, signal-A, memori, sql-native, execution-state]
connections:
  - { target: "[[research/context-memory/_MOC]]", relation: references }
  - { target: "[[research/context-memory/mem0ai-mem0]]", relation: references }
---

# MemoriLabs/Memori

> 13.3k stars. SQL-native, LLM-agnostic memory layer that captures **execution state (not just messages)**. Cleanest schema for "remember what agents DO not just what they SAY."

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/MemoriLabs/Memori> |
| Stars | 13,294 (verified 2026-04-12) |
| Last activity | 2026-04-10 |
| Signal tier | **A** |

## What to steal

### 1. Attribution model

`entity_id + process_id + session_id` as relational keys. Cleaner schema than mem0's flat memories table. Multi-tenant by design — EMA's actor system already has these primitives.

### 2. Memory unit = observation, not message

Memory primitives are tool calls, file ops, and commands — not chat messages. The LLM summary is a layer on top of these primitives, not the primary store.

EMA's `ClaudeSession` schema already captures `tool_calls` + `files_touched`. Promote them to memory primitives in EMA's port.

### 3. LoCoMo benchmark performance

Memori reports ~1,294 tokens per query (4.97% of full-context). Concrete numbers for EMA to beat or match.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-V1-SPEC.md §9 assembleContext` | Define memory primitives: tool calls, file ops, commands — not just messages |
| `AGENT-RUNTIME.md` | Capture execution-state memory, not conversation-state |

## Gaps surfaced

- V1-SPEC treats context as "documents + messages." Memori shows the memory unit should be observations (tool calls, file diffs, commands) with the LLM summary as a layer on top.
- EMA's existing ClaudeSession schema already has this — not surfaced as memory primitives in canon.

## Notes

- SQL-native = Postgres/SQLite friendly. EMA runs SQLite. Good low-friction port target.

## Connections

- `[[research/context-memory/mem0ai-mem0]]`
- `[[research/context-memory/thedotmack-claude-mem]]`
- `[[canon/specs/EMA-V1-SPEC]]`

#research #context-memory #signal-A #memori #sql-native
