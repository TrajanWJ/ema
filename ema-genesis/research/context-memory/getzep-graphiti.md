---
id: RES-graphiti
type: research
layer: research
category: context-memory
title: "getzep/graphiti — temporal knowledge graph with bi-temporal validity windows"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/getzep/graphiti
  stars: 24796
  verified: 2026-04-12
  last_activity: 2026-04-08
signal_tier: S
tags: [research, context-memory, signal-S, graphiti, temporal, hybrid-retrieval]
connections:
  - { target: "[[research/context-memory/_MOC]]", relation: references }
  - { target: "[[research/context-memory/HKUDS-LightRAG]]", relation: references }
  - { target: "[[canon/specs/EMA-GENESIS-PROMPT]]", relation: references }
---

# getzep/graphiti

> 24.8k stars. Temporal knowledge graph for agents with **bi-temporal validity windows** — old facts are never deleted, just marked superseded. Hybrid retrieval (vector + BM25 + graph traversal). Backed by FalkorDB (which EMA already uses).

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/getzep/graphiti> |
| Stars | 24,796 (verified 2026-04-12) |
| Last activity | 2026-04-08 |
| Signal tier | **S** |

## What to steal

### 1. Temporal invalidation semantics

Old facts get a `valid_to` timestamp on supersession instead of being deleted. The graph carries both the current truth and the history of how truth changed. EMA's wiki/canon needs this — "which stack decision is current?" should be queryable, not require git archaeology.

### 2. Hybrid retrieval with reranking

Three signals combined:
- Vector embedding similarity
- BM25 lexical match
- Graph distance (closer in the typed-edge graph = more relevant)

Reranking by graph distance is the killer feature. Pure vector retrieval doesn't know that "the spec for this thing" is one hop away in the graph and therefore should boost.

### 3. Incremental ingestion

New facts merge into the graph without rebuild. Each ingestion is small. EMA's vault watcher should work this way (already does, but the merge logic can borrow from Graphiti).

### 4. FalkorDB backend support

EMA already uses FalkorDB via the CodeGraphContext MCP. Graphiti supports it. Integration cost is low — share storage.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §5` | Add temporal validity model. Facts get `valid_from`/`valid_to`, not delete. |
| `EMA-V1-SPEC.md §9 assembleContext` | Add hybrid retrieval contract: vector + BM25 + graph-distance reranking |

## Gaps surfaced

- Genesis §5 treats the graph wiki as a static node/edge store with no time dimension. Canon has no story for "this fact was true until X" — EMA will hit contradiction hell without it.
- V1-SPEC also lacks a reranking strategy in retrieval.

## Notes

- FalkorDB backend means EMA's existing CodeGraphContext MCP could share storage.
- Graphiti requires structured-output LLMs — Claude supports this, no blocker.

## Connections

- `[[research/context-memory/HKUDS-LightRAG]]` — dual-level retrieval cousin
- `[[research/context-memory/topoteretes-cognee]]` — 4-verb API cousin
- `[[canon/specs/EMA-GENESIS-PROMPT]]`

#research #context-memory #signal-S #graphiti #temporal #hybrid-retrieval
