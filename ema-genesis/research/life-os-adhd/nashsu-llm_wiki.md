---
id: RES-llm_wiki
type: research
layer: research
category: life-os-adhd
title: "nashsu/llm_wiki — incremental wiki consolidation pattern (manual goal filing)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-e
source:
  url: https://github.com/nashsu/llm_wiki
  stars: 884
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: B
tags: [research, life-os-adhd, signal-B, llm_wiki, incremental-consolidation]
connections:
  - { target: "[[research/life-os-adhd/_MOC]]", relation: references }
  - { target: "[[research/life-os-adhd/_aspiration-detection-verdict]]", relation: references }
---

# nashsu/llm_wiki

> Desktop app that builds a persistent interlinked wiki from your sources via an **incremental LLM pipeline**. Closest to "LLM-maintained personal wiki" found in R2-E search. Goal extraction is MANUAL — confirms the empty niche.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/nashsu/llm_wiki> |
| Stars | 884 (verified 2026-04-12) |
| Last activity | 2026-04-12 (active — 252 commits) |
| Signal tier | **B** |

## What to steal

### 1. Incremental wiki consolidation pattern

Instead of RAG-every-query, the LLM builds + maintains a persistent knowledge graph **across ingestions**. EMA's SecondBrain GraphBuilder could steal the incremental consolidation approach. Adjacent to `[[research/context-memory/Paul-Kyle-palinode]]` but for general knowledge consolidation rather than fact-level.

### 2. Personal-goals as a use case

README mentions personal-goals as a use case. **But goal extraction is manual** — user files entries into `wiki/goals/` themselves. Confirms the R2-E empty niche.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` Vault | Reference incremental consolidation pattern as a future SecondBrain enhancement |

## Gaps surfaced

- Even this sophisticated tool requires the human to pre-sort "this is a goal" before filing. **Confirms the whitespace** for `[[DEC-003]]`.

## Notes

- 884 stars, very active.
- Closest thing in OSS to "LLM-maintained personal wiki" but aspiration extraction is manual.

## Connections

- `[[research/context-memory/Paul-Kyle-palinode]]` — fact-level cousin
- `[[research/life-os-adhd/_aspiration-detection-verdict]]`
- `[[DEC-003]]`

#research #life-os-adhd #signal-B #llm_wiki #incremental-consolidation
