---
id: RES-NS-second-brain
type: research
layer: research
category: self-building
title: "NicholasSpisak/second-brain — Karpathy LLM Wiki pattern (curator/compiler split)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/NicholasSpisak/second-brain
  stars: 103
  verified: 2026-04-12
  last_activity: 2026-04-06
signal_tier: A
tags: [research, self-building, signal-A, second-brain, karpathy, curator-compiler]
connections:
  - { target: "[[research/self-building/_MOC]]", relation: references }
  - { target: "[[research/self-building/gsd-build-get-shit-done]]", relation: references }
---

# NicholasSpisak/second-brain

> Implements **Karpathy's LLM Wiki pattern**: drop raw material in `raw/`, LLM compiles into structured wiki with cross-refs and index. Separate `/second-brain-lint` maintains health. The **curator/compiler split** is the conceptual win.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/NicholasSpisak/second-brain> |
| Stars | 103 (verified 2026-04-12) |
| Last activity | 2026-04-06 |
| Signal tier | **A** |

## What to steal

### 1. Curator/compiler separation

- **Human is curator** — controls what enters the system
- **LLM is librarian** — compiles raw material into structured knowledge

EMA conflates these. The current SecondBrain ingests and compiles in one pipeline.

### 2. Vault lint as a separate skill

A dedicated `ema vault lint` command would catch:
- Broken wikilinks
- Stale indexes
- Dead cross-refs
- Untagged orphans
- Missing front-matter fields

Before they rot.

### 3. Four-skill split

`ingest → compile → query → lint`

Each is a separate concern with its own command. Cleaner than EMA's monolithic SecondBrain module.

### 4. Compile produces typed note categories

- `sources/` — raw inputs (links, PDFs, transcripts)
- `entities/` — people, projects, concepts
- `concepts/` — abstract ideas
- `synthesis/` — compiled cross-cutting analyses

A typed note-kind hierarchy EMA's vault lacks.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` Vault | Add curator/compiler separation, typed note-kind hierarchy |
| `BLUEPRINT-PLANNER.md` Aspirations Log | Compile aspirations as a "synthesis" category, not raw notes |
| New CLI verb | `ema vault lint` |

## Gaps surfaced

- EMA's SecondBrain has no lint/health check.
- No typed note-kind hierarchy.
- Aspiration detection isn't split from aspiration storage — they're one pipeline with no checkpoint.

## Notes

- Built on Agent Skills open standard.
- Karpathy's original LLM Wiki gist is the theoretical anchor: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

## Connections

- `[[research/self-building/gsd-build-get-shit-done]]`
- `[[research/context-memory/Paul-Kyle-palinode]]` — fact-level cousin
- `[[research/life-os-adhd/nashsu-llm_wiki]]`

#research #self-building #signal-A #second-brain #karpathy #curator-compiler
