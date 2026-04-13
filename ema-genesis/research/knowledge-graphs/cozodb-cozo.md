---
id: RES-cozo
type: research
layer: research
category: knowledge-graphs
title: "cozodb/cozo — embedded Datalog + relational + vector (going stale)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/cozodb/cozo
  stars: 3948
  verified: 2026-04-12
  last_activity: 2024-12-04
signal_tier: B
tags: [research, knowledge-graphs, signal-B, cozo, datalog, going-stale]
connections:
  - { target: "[[research/knowledge-graphs/_MOC]]", relation: references }
  - { target: "[[research/knowledge-graphs/typedb-typedb]]", relation: references }
  - { target: "[[research/knowledge-graphs/logseq-logseq]]", relation: references }
  - { target: "[[DEC-001]]", relation: references }
---

# cozodb/cozo

> Transactional relational + graph + vector database using Datalog (CozoScript). Was the historical candidate for EMA's "future graph engine" — **but going stale**. `[[research/knowledge-graphs/typedb-typedb]]` is the live alternative.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/cozodb/cozo> |
| Stars | 3,948 (verified 2026-04-12) |
| Last activity | **2024-12-04 (slowing significantly)** |
| Signal tier | **B** (downgraded from A due to staleness) |

## What it would have offered

Unified relational + graph + vector in one engine:
- Datalog rules for graph traversal (`ancestors[up] := parent[up, _]; ancestors[up] := parent[up, mid], ancestors[mid]`)
- Vector search for semantic retrieval
- SQLite-style embedded deployment
- Embedded, client-server, or browser-WASM

This was attractive as the "future graph DB" target.

## Why downgraded

- **Last commit December 2024.** No release since 2023.
- 12+ months without activity is past the "yellow flag" threshold.
- The Datalog approach is sound but the project momentum is stalling.

## Replacement

`[[research/knowledge-graphs/typedb-typedb]]` is actively maintained (v3.8.3 March 2026), schema-first, with rule inference. Same conceptual fit, better health.

## Notes

- Don't depend on Cozo for new work as of 2026-04-12.
- The CozoScript DSL is conceptually interesting if you want to learn Datalog.
- Re-evaluate if it gets revived or forked.

## Connections

- `[[research/knowledge-graphs/typedb-typedb]]` — replacement
- `[[research/knowledge-graphs/logseq-logseq]]` — DataScript cousin
- `[[DEC-001]]`

#research #knowledge-graphs #signal-B #cozo #going-stale
