---
id: RES-claude-mem
type: research
layer: research
category: context-memory
title: "thedotmack/claude-mem — staged retrieval + session-end compaction Claude Code plugin"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/thedotmack/claude-mem
  stars: 48296
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: S
tags: [research, context-memory, signal-S, claude-mem, staged-retrieval, session-hooks]
connections:
  - { target: "[[research/context-memory/_MOC]]", relation: references }
  - { target: "[[research/context-memory/Paul-Kyle-palinode]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
---

# thedotmack/claude-mem

> 48k stars. Claude Code plugin that captures tool-use observations, AI-compresses them, and re-injects relevant context into new sessions. Ships as a real production Claude Code plugin — Trajan literally runs it or could.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/thedotmack/claude-mem> |
| Stars | 48,296 (verified 2026-04-12) |
| Last activity | 2026-04-12 (active daily) |
| Signal tier | **S** |

## What to steal

### 1. The 3-layer staged retrieval workflow

```
search → timeline → get_observations
```

Staged filtering claims **~10x token reduction vs dumping full history**. Each layer:
- `search` — fast lexical/vector hit list
- `timeline` — temporal ordering of hits with metadata
- `get_observations` — full content fetch only for what survives the filter

EMA's `assembleContext` should be staged the same way: cheap filter first, expensive fetch last.

### 2. Five Claude Code lifecycle hooks

`UserPromptSubmit`, `SessionStart`, `SessionEnd`, `Stop`, `PreCompact`. EMA's old `Ema.ClaudeSessions.SessionWatcher` polls; claude-mem hooks. Hooks > polling.

### 3. Session-end compaction

On `SessionEnd`, claude-mem runs an LLM compaction pass that distills the session into structured observations. EMA's old SessionWatcher imports raw `.jsonl` files without compression. Claude-mem proves the right pattern is **compress at session end, not import as raw**.

### 4. Dual SQLite-FTS5 + Chroma hybrid store

FTS5 for lexical, Chroma for semantic embeddings. EMA gets the same hybrid by combining `better-sqlite3` FTS5 + `sqlite-vec`.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-V1-SPEC.md §9 assembleContext` | Add staged retrieval contract: search → filter → fetch |
| `AGENT-RUNTIME.md` | Add session-end hook + compaction pass to the lifecycle |
| `[[_meta/SELF-POLLINATION-FINDINGS]]` | SessionWatcher REPLACE entry — claude-mem is the replacement model |

## Gaps surfaced

- V1-SPEC's `assembleContext` has no staged-retrieval contract — today it would return everything matching, burning budget
- Canon never names a "session close" signal — SessionWatcher polls but doesn't trigger compaction

## Notes

- 48k stars, very active. Trajan likely already runs it.
- Closest plug-and-play reference EMA has.
- Read the MCP tool signatures before writing EMA's `assembleContext`.

## Connections

- `[[research/context-memory/Paul-Kyle-palinode]]` — LLM-maintained cousin
- `[[research/context-memory/letta-ai-letta]]` — OS-hierarchy cousin
- `[[research/agent-orchestration/Dicklesworthstone-coding_agent_session_search]]` — multi-provider extension
- `[[canon/specs/EMA-V1-SPEC]]`
- `[[canon/specs/AGENT-RUNTIME]]`

#research #context-memory #signal-S #claude-mem #staged-retrieval
