---
id: INT-PROPOSAL-PIPELINE
type: intent
layer: intents
title: "Port the 5-stage proposal pipeline (Generator → Refiner → Debater → Tagger → Combiner)"
status: active
kind: port
level: initiative
created: 2026-04-12
updated: 2026-04-12
priority: high
exit_condition: "A seed proposal minted via proposalsForIntent() advances through all five stages, is scored on the 4-dimensional scoring rubric, and reaches queued status ready for human approval. Integration test in services/core/proposals/ passes end-to-end with a real intent row."
scope:
  - "services/core/proposals/**"
  - "services/core/proposals/pipeline/**"
  - "shared/schemas/proposals.ts"
  - "services/core/proposals/proposals.router.ts"
connections:
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: derived_from }
  - { target: "[[canon/decisions/DEC-007-unified-intents-schema]]", relation: references }
  - { target: "[[executions/EXE-003-intents-port]]", relation: derived_from }
  - { target: "[[intents/INT-EXECUTION-DISPATCHER]]", relation: blocks }
tags: [intent, proposal-pipeline, s-tier-port-2, v1-blocking]
---

# INT-PROPOSAL-PIPELINE — Port the 5-stage proposal pipeline

## Why this intent exists

The current `services/core/proposals/` subservice has `intention-farmer.ts` (258 LOC) + `vault-seeder.ts` (236 LOC) + a 65-LOC `proposals.router.ts`. That's two narrow slices — a vault→seed harvester and a seed→vault projector — and a thin HTTP shim. It is **not** the 5-stage pipeline that `SELF-POLLINATION-FINDINGS.md` S-TIER PORT #2 calls for.

The old Elixir `Ema.Proposals.Pipeline` had:

1. **Generator** — mints candidate proposals from seeds + intent context
2. **Refiner** — rewrites for clarity + scope + feasibility
3. **Debater** — argues pro/con; multiple LLM passes; Parliament variant
4. **Scorer** — 4-dimensional scoring (see below)
5. **Tagger** — topical + capability + priority tags
6. terminal: **queued** → ready for human approval

Plus side channels: **Combiner** (hourly cross-pollination seeds from overlapping tags), **AutoDecomposer** (complex → subtasks), **KillMemory** (rejection lineage, used to reject near-duplicates in later runs).

Scoring dimensions:
- codebase coverage: 30%
- architectural coherence: 25%
- impact: 30%
- prompt specificity: 15%

Dedup: cosine similarity > 0.85 against KillMemory.

## What's already done (EXE-003)

- `proposals/intention-farmer.proposalsForIntent(intentSlug, opts)` — mints seed-shaped `HarvestedIntent`s from an intent's runtime bundle. This is the **Generator** input path (not the stage itself).
- `HarvestedIntentSource` enum extended to include `"intent"` so intent-sourced seeds are provenance-tagged.
- `executions.service.createExecution()` emits `executions:created` on the pipe bus with `proposal_id` + `intent_slug` so the pipeline can observe execution outcomes.

## What's missing

Everything downstream of the Generator seed:

- `services/core/proposals/pipeline/generator.ts` — seed → proposal
- `services/core/proposals/pipeline/refiner.ts` — proposal → refined proposal
- `services/core/proposals/pipeline/debater.ts` — proposal → annotated proposal with pro/con
- `services/core/proposals/pipeline/scorer.ts` — 4-dimensional scoring
- `services/core/proposals/pipeline/tagger.ts` — tag assignment
- `services/core/proposals/pipeline/kill-memory.ts` — cosine-0.85 dedup via embedding index
- `services/core/proposals/pipeline/combiner.ts` — hourly cross-pollination
- `services/core/proposals/pipeline/auto-decomposer.ts` — complex → subtasks
- Stage-to-stage event bus wiring (`proposals:generated → proposals:refined → ...`)
- Integration test: one seed, five stages, real intent row, queued exit
- Router endpoints for pipeline observation (`GET /api/proposals/:id/lineage`)

## Research sources to lean on

- **Palinode** (`research/context-memory/Paul-Kyle-palinode`) — 5-verb DSL (KEEP / UPDATE / MERGE / SUPERSEDE / ARCHIVE) that the Refiner + KillMemory stages should borrow
- **SELF-POLLINATION §A.4** — exact stage sequence from the old Elixir build
- **snarktank-ralph** (`research/self-building/snarktank-ralph`) — story-sized proposal discipline (fits in one context window)
- **Task-Anchor-MCP** — drift detection for the Debater and KillMemory stages

## Ordering

1. Generator (stub pass-through is acceptable)
2. Refiner
3. Scorer
4. Tagger
5. Debater
6. KillMemory (depends on embeddings — may slip one intent)
7. Combiner (cross-pollination)
8. AutoDecomposer (nice-to-have)

## Dependencies

- `services/core/intents/` (EXE-003) — landed ✓
- `services/core/executions/` — landed with pipe-bus emission ✓
- Proposal embedding store — new, needs decision (reuse memory/cross-pollination schema?)

## Exit condition

> A seed proposal minted via `proposalsForIntent()` advances through all five stages, is scored on the 4-dimensional scoring rubric, and reaches `queued` status ready for human approval. Integration test in `services/core/proposals/` passes end-to-end with a real intent row.

#intent #active #priority-high #s-tier-port-2 #proposal-pipeline
