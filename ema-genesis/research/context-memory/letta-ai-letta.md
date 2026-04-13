---
id: RES-letta
type: research
layer: research
category: context-memory
title: "letta-ai/letta — OS-inspired memory hierarchy (core/recall/archival)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/letta-ai/letta
  stars: 22013
  verified: 2026-04-12
  last_activity: 2026-04-08
signal_tier: A
tags: [research, context-memory, signal-A, letta, memgpt, memory-hierarchy]
connections:
  - { target: "[[research/context-memory/_MOC]]", relation: references }
  - { target: "[[research/context-memory/thedotmack-claude-mem]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
---

# letta-ai/letta (formerly MemGPT)

> Stateful agent platform with **OS-inspired memory hierarchy**: core memory (always in context) + recall memory (recent messages) + archival memory (vector-searched). Self-edit pattern where the LLM rewrites its own context.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/letta-ai/letta> |
| Stars | 22,013 (verified 2026-04-12) |
| Last activity | 2026-04-08 |
| Signal tier | **A** |

## What to steal

### 1. Three-tier memory hierarchy

| Tier | Always in context? | Budget | EMA mapping |
|---|---|---|---|
| **Core** | Yes | small | Pinned canon clauses + current intent + governance principles |
| **Recall** | Yes | medium | Recent session summaries + active proposals |
| **Archival** | Searched | large pool | Full wiki/graph + execution history |

EMA should literally map: core = canon pinned facts + current intent, recall = recent summaries, archival = full graph.

### 2. Self-edit pattern

The LLM can rewrite its own core memory. The agent decides what's worth keeping in the always-visible slot. Combined with `[[research/context-memory/Paul-Kyle-palinode]]`'s safety model (LLM proposes, executor applies), this is the right shape: LLM proposes core memory edits, validator applies them.

**Critical nuance:** the LLM edits its CONTEXT, not the canonical store. EMA should respect this boundary — the canonical graph is the truth, the agent's working memory is a derivative.

### 3. Per-tier explicit budgets

V1-SPEC says "context budget ~80k" as one pool. Letta proves it should be three pools with separate rules. Total ≤ 80k, but each tier has its own truncation strategy.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-V1-SPEC.md §9 assembleContext` | Three-tier budget model (core/recall/archival), explicit per-tier budgets |
| `[[canon/specs/EMA-GENESIS-PROMPT]] §5` | Distinguish "pinned" memory from "searched" memory |

## Gaps surfaced

- V1-SPEC says "include intent + direct connections + 1-hop canon nodes, truncate to 80k." That's a single pool with one truncation rule. Letta shows it should be three pools with three rules.
- No concept of "pinned" vs "searched" memory in EMA canon.

## Notes

- MemGPT → Letta rebrand happened. Same core concepts.
- The original MemGPT paper is the most cited primary source on LLM memory OS. Read it before copying their API.
- Compare with `[[research/context-memory/Paul-Kyle-palinode]]` — palinode has 2 phases, Letta has 3. Both are right; the difference is granularity.

## Connections

- `[[research/context-memory/Paul-Kyle-palinode]]` — 2-phase cousin
- `[[research/context-memory/thedotmack-claude-mem]]` — staged retrieval cousin
- `[[research/context-memory/mem0ai-mem0]]` — alternative agent memory model
- `[[canon/specs/EMA-V1-SPEC]]`

#research #context-memory #signal-A #letta #memgpt #memory-hierarchy
