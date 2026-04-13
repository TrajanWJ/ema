---
id: MOC-context-memory
type: moc
layer: research
title: "Context & Memory — Map of Content"
status: active
created: 2026-04-12
updated: 2026-04-12
author: system
tags: [moc, research, context-memory]
connections:
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: references }
---

# Context & Memory — Map of Content

> Repos covering LLM agent memory, long-horizon context, semantic compression, graph RAG, and LLM-maintained knowledge stores.

## Tier S

| Repo | Pattern |
|---|---|
| [[research/context-memory/Paul-Kyle-palinode\|palinode]] | 6-verb DSL + 2-phase context + proposes/executes safety |
| [[research/context-memory/thedotmack-claude-mem\|claude-mem]] | Staged retrieval + session-end compaction |
| [[research/context-memory/getzep-graphiti\|graphiti]] | Temporal validity windows + hybrid retrieval |
| [[research/context-memory/BerriAI-litellm\|litellm]] | Per-source token budget enforcement |

## Tier A

| Repo | Pattern |
|---|---|
| [[research/context-memory/letta-ai-letta\|letta]] | OS-hierarchy memory (core/recall/archival) |
| [[research/context-memory/MemoriLabs-Memori\|Memori]] | SQL-native execution-state memory |
| [[research/context-memory/aiming-lab-SimpleMem\|SimpleMem]] | Decay/merge/prune vocabulary |
| [[research/context-memory/HKUDS-LightRAG\|LightRAG]] | Dual-level retrieval |
| [[research/context-memory/topoteretes-cognee\|cognee]] | 4-verb cognitive API (Remember/Recall/Forget/Improve) |
| [[research/context-memory/mem0ai-mem0\|mem0]] | Universal memory with extract/update/delete |

## Cross-cutting takeaways

1. **Palinode is the conceptual anchor** despite 18 stars. The 6-verb DSL + proposes/executes split + 2-phase context assembly are the load-bearing patterns.
2. **Staged retrieval beats flat retrieval** (claude-mem, palinode, SimpleMem all converge here). EMA's `assembleContext` should be `plan → retrieve → dedup → inject`, not a single pool.
3. **Memory primitives = observations, not messages** (Memori, mem0). Tool calls + file ops + commands are the real units; LLM summaries are layered on top.
4. **Per-source token budgets are mandatory** (litellm). Don't silently truncate.
5. **Temporal validity** (graphiti) is the missing dimension in EMA's static graph. Facts get `valid_to`, not deletion.

## Connections

- [[research/_moc/RESEARCH-MOC]]
- [[canon/specs/EMA-V1-SPEC]] §9 assembleContext
- [[canon/specs/EMA-GENESIS-PROMPT]] §5

#moc #research #context-memory
