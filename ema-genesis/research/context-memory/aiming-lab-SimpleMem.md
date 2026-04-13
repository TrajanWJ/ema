---
id: RES-SimpleMem
type: research
layer: research
category: context-memory
title: "aiming-lab/SimpleMem — semantic compression with decay/merge/prune consolidation"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/aiming-lab/SimpleMem
  stars: 3139
  verified: 2026-04-12
  last_activity: 2026-04-04
signal_tier: A
tags: [research, context-memory, signal-A, simplemem, decay-merge-prune, compression]
connections:
  - { target: "[[research/context-memory/_MOC]]", relation: references }
  - { target: "[[research/context-memory/Paul-Kyle-palinode]]", relation: references }
---

# aiming-lab/SimpleMem

> Three-stage pipeline (semantic compression → online synthesis → intent-aware retrieval) with the cleanest **decay/merge/prune** vocabulary in the agent memory space. **+64% over Claude-Mem on LoCoMo benchmark.**

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/aiming-lab/SimpleMem> |
| Stars | 3,139 (verified 2026-04-12) |
| Last activity | 2026-04-04 |
| Signal tier | **A** |

## What to steal

### 1. Intra-session synthesis (not nightly batch)

Rather than deferring consolidation to a nightly batch, SimpleMem **compresses related fragments as they arrive**. Prevents fragmentation accumulation. EMA's brain_dump inbox has the same problem: capture > dedup, so it becomes a junk drawer fast. Synthesize on write.

### 2. Multi-view indexing

Three indices in parallel:
- Semantic (embeddings)
- Lexical (BM25)
- Symbolic (timestamps + metadata)

Matches Graphiti's hybrid trio. SimpleMem adds explicit symbolic-as-first-class which is the right primitive for EMA's typed graph data.

### 3. Decay/merge/prune vocabulary

Three operations:
- **Decay** — old facts slowly lose weight unless reinforced
- **Merge** — overlapping facts combine into one
- **Prune** — facts below a threshold get archived

EMA should adopt this vocabulary verbatim. Pairs naturally with `[[research/context-memory/Paul-Kyle-palinode]]`'s 6-verb DSL — palinode has the operations, SimpleMem has the lifecycle.

### 4. Intent-aware retrieval planner

LLM generates a retrieval plan specifying queries + filters + depth, **then** the deterministic engine executes the plan. Essentially an LLM-planned query compiler. The "plan before retrieve" pattern separates the LLM (which plans) from the index (which executes).

## Changes canon

| Doc | Change |
|---|---|
| `EMA-V1-SPEC.md §9 assembleContext` | Add intent-aware planning stage — "plan before retrieve" |
| `AGENT-RUNTIME.md` | Add synthesis-on-write for brain_dump + proposals |

## Gaps surfaced

- V1-SPEC's `assembleContext` is `(intent) → (context)`. SimpleMem shows it should be `(intent) → (plan) → (retrieve) → (dedup-merge) → (context)`.
- EMA also has no story for "synthesize on write" — the BrainDump context module does pure CRUD.

## Notes

- Research code, LanceDB + SQLite backed.
- The decay/merge/prune naming is the cleanest vocabulary in this space; borrow it verbatim.

## Connections

- `[[research/context-memory/Paul-Kyle-palinode]]` — operations cousin
- `[[research/context-memory/MemoriLabs-Memori]]` — execution-state cousin
- `[[canon/specs/EMA-V1-SPEC]]`

#research #context-memory #signal-A #simplemem #decay-merge-prune
