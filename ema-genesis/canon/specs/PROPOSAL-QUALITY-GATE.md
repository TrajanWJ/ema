---
id: SPEC-PROPOSAL-QUALITY-GATE
type: canon
subtype: spec
layer: canon
title: "Proposal Preflight Quality Gate — 100-point rubric, normalize-or-reject, 4 outcomes"
status: preliminary
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/proposals/seed_preflight.ex"
recovered_at: 2026-04-12
connections:
  - { target: "[[canon/specs/PROPOSAL-TEMPLATES]]", relation: sibling }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
tags: [canon, spec, proposals, preflight, quality-gate, rubric, recovered, preliminary]
---

# Proposal Preflight Quality Gate

> **Recovery status:** Preliminary. The preflight exists in the old build's `lib/ema/proposals/seed_preflight.ex`. Module-level semantics are clear (normalize, score on 100-point rubric, route into 4 outcomes). The **exact rubric dimensions** are in the Elixir code, not the prose recovery — follow-up needed to extract them verbatim.

## What it is

The Preflight is the **first gate** every proposal seed passes through after creation, before any generation/refinement/debate work. It does three things:

1. **Normalize** — populate missing-but-expected fields on the seed so downstream stages don't have to guess.
2. **Score** — run a 100-point quality rubric against the normalized seed.
3. **Route** — decide one of four outcomes: `pass`, `rewrite`, `duplicate`, `reject`.

## The 4 outcomes

| Outcome | What happens | Routes to |
|---|---|---|
| `pass` | Seed is well-formed and unique. Continue into the pipeline. | Generator stage |
| `rewrite` | Seed has structural issues that can be fixed by an LLM rewrite. | Rewrite loop (bounded retries), then re-preflight |
| `duplicate` | Seed is too similar to a recent proposal (threshold-based). | KillMemory (recorded as dup, not pursued) |
| `reject` | Seed is low-quality and can't be saved by rewriting. | KillMemory (recorded as rejected, with reason) |

Return shape: `{outcome, seed_or_nil, diagnostics}`. `diagnostics` is a map with the rubric breakdown so the rejection is explainable.

## The 100-point rubric (dimensions TBD)

**⚠ Gap:** The rubric dimensions are in the Elixir source code's scoring logic (probably lines 80+ of `seed_preflight.ex`). The prose recovery did not capture them. Follow-up required to extract the exact dimension names, weights, and score rules.

Based on the proposal pipeline's four-dimensional scoring further downstream (per [[_meta/SELF-POLLINATION-FINDINGS]] §A), the preflight rubric is likely a coarser version of:
- **Codebase coverage** — does the proposal touch enough of the codebase to matter?
- **Architectural coherence** — does it fit the existing patterns?
- **Impact** — how much does solving this move the system forward?
- **Prompt specificity** — is the proposal concrete enough to action?

Weights in the full pipeline are 30/25/30/15 = 100. The preflight rubric probably uses the same or a similar dimension set with different weights.

## Normalization responsibilities

The preflight must populate these fields on every seed before scoring, filling in defaults if the incoming seed is missing them:
- `title` (required — fail fast if missing)
- `summary` (required — fail fast if missing)
- `template_key` (fill from title pattern if missing)
- `estimated_scope` (fill from template default if missing)
- `source` (fill from creation context; `unknown` if unavailable)
- `created_at` (timestamp)
- `embedding` (computed async; nil is acceptable at preflight time)

## Duplicate detection

Duplicates are detected via embedding similarity against `recent_proposals` (recency window not specified; likely last N days or last N proposals). If similarity exceeds a threshold (old build default was 0.6), the seed is marked `duplicate` and sent to KillMemory.

## Rewrite loop

If a seed scores low on the rubric but is **structurally salvageable** (the diagnostics say "summary is too vague" or "title doesn't match template"), the preflight can request an LLM rewrite. The rewritten seed re-enters preflight. Bounded retries prevent infinite loops.

## Why this spec matters

The preflight is the **cheapest filter** in the pipeline. Catching bad seeds here saves all the downstream stages (Generator, Refiner, Debater, Scorer, Tagger, Combiner) from wasting compute on garbage. A well-tuned preflight is disproportionately valuable.

## Gaps / open questions

- **Exact rubric dimensions.** Highest-priority follow-up — extract from `seed_preflight.ex` line ~80+.
- **Rewrite loop bounds.** How many retries before hard-reject? Old build default not recovered.
- **Duplicate threshold.** 0.6 is the stated default. Tunable per-project?
- **KillMemory semantics.** What does KillMemory actually do with rejected/duplicate seeds? Log for learning? Ignore forever? Needs its own spec entry.

## Related

- [[canon/specs/PROPOSAL-TEMPLATES]] — sibling spec defining seed shape
- [[_meta/SELF-POLLINATION-FINDINGS]] §A TIER PORT `Ema.Proposals.Pipeline` — parent pipeline with four-dimensional scoring
- Original source: `IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/proposals/seed_preflight.ex`

#canon #spec #proposals #preflight #quality-gate #recovered #preliminary
