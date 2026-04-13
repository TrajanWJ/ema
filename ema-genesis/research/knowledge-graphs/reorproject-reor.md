---
id: RES-reor
type: research
layer: research
category: knowledge-graphs
title: "reorproject/reor — local-first AI notes with auto-link suggestion via embeddings"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-f
source:
  url: https://github.com/reorproject/reor
  stars: 8550
  verified: 2026-04-12
  last_activity: 2025-05-13
signal_tier: B
tags: [research, knowledge-graphs, signal-B, reor, ai-pkm, link-suggestion, stale]
connections:
  - { target: "[[research/knowledge-graphs/_MOC]]", relation: references }
  - { target: "[[research/knowledge-graphs/silverbulletmd-silverbullet]]", relation: references }
---

# reorproject/reor

> 8.5k stars but **stale (last commit May 2025).** Still worth including because nobody else does **automatic [[wikilink]] suggestion via vector similarity** over a local vault. The "system surfaces the link you forgot" pattern is unique.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/reorproject/reor> |
| Stars | 8,550 (verified 2026-04-12) |
| Last activity | 2025-05-13 (~11 months stale) |
| Signal tier | **B** (stale but unique) |

## What to steal

### 1. Auto-link suggestion via embeddings

On note-edit, show "you might link to these" inline. Vector similarity over the vault. **EMA's SecondBrain.GraphBuilder lacks this** — currently it only tracks explicit `[[wikilinks]]`, no suggestion layer.

### 2. The proactive vs reactive graph distinction

EMA's GraphBuilder only sees what you already typed. Reor's pattern is "the system surfaces the link you forgot" — bridge from reactive to proactive graph.

### 3. LanceDB + transformers.js recipe

Browser-side embeddings, no Python dep. **The cleanest local-embedding stack** for a desktop app. EMA's vault watcher could add embedding-on-write without a heavy Python sidecar.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` Vault | Add "Suggested links via embeddings" feature, inspired by Reor |
| Future spec | Embedder service following the LanceDB + transformers.js recipe |

## Gaps surfaced

- EMA's GraphBuilder only sees what you already typed. No suggestion layer.

## Notes

- **11-month staleness** means borrow patterns, don't take as dependency. Lower signal.
- The transformers.js + LanceDB recipe is the cleanest local-embedding stack found in research.

## Connections

- `[[research/knowledge-graphs/silverbulletmd-silverbullet]]` — primary graph engine
- `[[research/knowledge-graphs/_MOC]]`

#research #knowledge-graphs #signal-B #reor #ai-pkm #stale
