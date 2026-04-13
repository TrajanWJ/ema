---
id: RES-cognee
type: research
layer: research
category: context-memory
title: "topoteretes/cognee — 4-verb cognitive API (Remember/Recall/Forget/Improve)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/topoteretes/cognee
  stars: 15128
  verified: 2026-04-12
  last_activity: 2026-04-11
signal_tier: A
tags: [research, context-memory, signal-A, cognee, four-verb-api, ontology]
connections:
  - { target: "[[research/context-memory/_MOC]]", relation: references }
  - { target: "[[research/context-memory/getzep-graphiti]]", relation: references }
---

# topoteretes/cognee

> 15k stars. Cognitive architecture with **4-verb API (Remember/Recall/Forget/Improve)** combining vector + graph stores. Ontology-grounded.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/topoteretes/cognee> |
| Stars | 15,128 (verified 2026-04-12) |
| Last activity | 2026-04-11 |
| Signal tier | **A** |

## What to steal

### 1. The 4-verb public API

Cleaner than EMA's sprawling assembleContext. Model EMA's memory layer as:
- `Remember(content)` — write
- `Recall(query)` — read
- `Forget(filter)` — delete
- `Improve(feedback)` — refine

The "improve" operation — continuous refinement through feedback — is what EMA's health loop needs.

### 2. Ontology grounding

EMA has schemas/intents already. **Treat them as the ontology** the LLM must ground into rather than free-form extraction. Constrains LLM output to known entity types.

### 3. Vector + graph in one store

Combined cognitive store, not parallel pipelines.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §5` | Adopt the 4-verb canonical API |
| `vapps/CATALOG.md` | Add `improve()` primitive — feedback loop into knowledge store |

## Gaps surfaced

- EMA has no "improve" primitive. Only adds and reads. **Systems that don't refine drift.**
- EMA's intents are a latent ontology nobody is using to constrain extraction.

## Notes

- Large project, read selectively.
- The 4-verb model is the single strongest takeaway.

## Connections

- `[[research/context-memory/getzep-graphiti]]`
- `[[research/context-memory/HKUDS-LightRAG]]`

#research #context-memory #signal-A #cognee #four-verb-api
