---
id: RES-LightRAG
type: research
layer: research
category: context-memory
title: "HKUDS/LightRAG — dual-level retrieval (entity facts + concept patterns)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/HKUDS/LightRAG
  stars: 32969
  verified: 2026-04-12
  last_activity: 2026-04-11
signal_tier: A
tags: [research, context-memory, signal-A, LightRAG, dual-level, graphrag]
connections:
  - { target: "[[research/context-memory/_MOC]]", relation: references }
  - { target: "[[research/context-memory/getzep-graphiti]]", relation: references }
---

# HKUDS/LightRAG

> 33k stars. **Dual-level graph retrieval** (low-level entity/relation + high-level concept) beating flat RAG on comprehensiveness/diversity. EMNLP 2025 paper with implementation.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/HKUDS/LightRAG> |
| Stars | 32,969 (verified 2026-04-12) |
| Last activity | 2026-04-11 |
| Signal tier | **A** |

## What to steal

### 1. Dual-level retrieval

EMA's agents need both:
- **Low-level facts** about topic X (precision)
- **High-level conceptual patterns** around X (strategic context)

Map to EMA:
- Low-level = canon clauses + intents + executions
- High-level = wiki MOCs + governance principles + retrospectives

Run separate retrievers per level. Different budgets per level.

### 2. Per-level budget allocation

```typescript
context_budget = {
  low_level:  0.30,  // 30% facts
  high_level: 0.70,  // 70% framing
  // tunable per task
}
```

### 3. Entity-relationship extraction prompts

Read source for the exact templates. EMA's intent/canon extraction can borrow them.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §5` | Two-tier retrieval: clause-level + concept-level |
| `EMA-V1-SPEC.md §9 assembleContext` | Define levels + their budgets |

## Gaps surfaced

- Canon treats retrieval as a flat semantic search. LightRAG shows two distinct retrieval modes are needed with separate budgets.

## Notes

- Heavier compute requirement (32B+ LLM, 64K context, BAAI/bge-m3 embedder).
- EMA's local-first story limits this; the algorithm translates to smaller models.

## Connections

- `[[research/context-memory/getzep-graphiti]]`
- `[[research/context-memory/topoteretes-cognee]]`

#research #context-memory #signal-A #LightRAG #dual-level
