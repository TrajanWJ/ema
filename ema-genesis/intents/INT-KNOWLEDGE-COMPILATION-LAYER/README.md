---
id: INT-KNOWLEDGE-COMPILATION-LAYER
type: intent
layer: intents
title: "Knowledge Compilation Layer — Karpathy compile-don't-search pattern for the 1504-note vault"
status: preliminary
kind: new-work
phase: discover
priority: medium
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/.superman/intents/calendar-q2-2026-june-knowledge-compilation-layer-karp/"
recovered_at: 2026-04-12
original_author: human
original_schedule: "2026-06 (Q2 2026)"
exit_condition: "Topic-based synthesis with coverage indicators exists. Concept articles for cross-cutting patterns are auto-generated. SystemBrain's 5 state projections all implemented. Vector embeddings store exists (sqlite-vec or equivalent). The wiki self-organizes by topic on demand, without manual MOC maintenance."
connections:
  - { target: "[[canon/decisions/DEC-001-graph-engine]]", relation: extends }
  - { target: "[[canon/decisions/DEC-007-unified-intents-schema]]", relation: references }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
tags: [intent, new-work, knowledge, compilation, karpathy, embeddings, recovered, preliminary]
---

# INT-KNOWLEDGE-COMPILATION-LAYER

## Original intent text (verbatim)

> CALENDAR (Q2 2026 - June): Knowledge Compilation Layer. Karpathy compile-don't-search pattern for the 1504 vault notes. Topic-based synthesis with coverage indicators. Concept articles for cross-cutting patterns. SystemBrain's 5 missing state projections. Vector embeddings via sqlite-vec or bumblebee NIF. The wiki becomes self-organizing.

## What "compile-don't-search" means

Karpathy's pattern: don't search 1504 notes at query time — **compile** them at ingest time into topic-indexed, embedding-backed structures that can be queried instantly with high recall. The search layer is a derivative of the compile layer, not a replacement.

Applied to EMA's vault: every note gets embedded once, clustered by topic, and **synthesized into concept articles** that span multiple source notes. The concept article is the first-class surface; the source notes become citations.

## Components

1. **Topic-based synthesis with coverage indicators** — for each detected topic, a synthesized summary article + a coverage indicator ("12 notes contribute, 3 are recent, 2 are high-confidence"). Coverage lets the user see where the knowledge is thick and where it's thin.
2. **Concept articles for cross-cutting patterns** — patterns that show up across multiple topics get their own article (e.g., "anti-sycophancy" appears in the soul prompt, in session logs, in learnings — deserves a concept article that pulls from all of them).
3. **SystemBrain's 5 missing state projections** — referenced but not enumerated in the original. Follow-up: find the SystemBrain module and extract the 5 projection names.
4. **Vector embeddings store** — via sqlite-vec or bumblebee NIF. In the TypeScript rebuild, this likely becomes sqlite-vec directly (no Elixir NIF).

## Dependencies

- **Builds on [[canon/decisions/DEC-001-graph-engine]]** — which says the graph engine is a derived Object Index over markdown. The compilation layer is **another derivative** on top of the Object Index, specifically for semantic synthesis.
- Depends on a functioning vault watcher (TIER REPLACE in SELF-POLLINATION — recommended replacement is SilverBullet Object Index pattern or iwe).

## Gaps / open questions

- **SystemBrain's 5 projections not enumerated.** Need to find the SystemBrain module or spec.
- **Synthesis engine.** LLM-based? Template-based? Depends on how much compute budget you're willing to spend at ingest time.
- **Concept article update policy.** When a new source note lands, does the concept article auto-refresh, or is there a batch rebuild? Latency vs cost tradeoff.
- **Coverage indicator scoring.** What makes a topic "thickly covered" vs "thinly covered"? Count of source notes? Total word count? Recency distribution?

## Related

- [[canon/decisions/DEC-001-graph-engine]] — parent decision
- [[canon/decisions/DEC-007-unified-intents-schema]] — Three Truths knowledge domain
- [[_meta/SELF-POLLINATION-FINDINGS]] — SilverBullet Object Index TIER REPLACE

#intent #new-work #knowledge #compilation #karpathy #recovered #preliminary
