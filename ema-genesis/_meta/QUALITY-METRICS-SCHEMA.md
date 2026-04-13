---
id: META-QUALITY-METRICS-SCHEMA
type: meta
layer: _meta
title: "Quality Metrics Schema — six-field frontmatter block for knowledge node quality"
status: active
created: 2026-04-12
updated: 2026-04-12
author: canon-repair-pass
connections:
  - { target: "[[_meta/DOC-TRUST-HIERARCHY]]", relation: refines }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
tags: [meta, schema, quality, metrics, freshness, confidence, provenance]
---

# Quality Metrics Schema

> **Purpose:** Give every knowledge node in `ema-genesis/**` and the wiki at `~/.local/share/ema/vault/wiki/**` a machine-readable quality assessment across six orthogonal dimensions. Fields are **lazy** — absence means "unmarked / unknown," not "bad." Values get populated on file access (by human edits or agent passes), not eagerly by a batch scaffold.
>
> **Scope:** All of `ema-genesis/**` and the wiki at `~/.local/share/ema/vault/wiki/**`. Explicitly **excludes** `IGNORE_OLD_TAURI_BUILD/**` (archive — not touched).

## The six dimensions

These were selected from eleven candidates after compression. They cover the full epistemic, temporal, structural, relational, and operational axes of knowledge quality with no overlap.

| Field | Scale | What it measures |
|---|---|---|
| `confidence` | `S` / `A` / `B` / `C` / `D` | **Is the claim true?** S = verified multiple ways. A = strong evidence. B = asserted by an authoritative source. C = uncertain. D = speculative. |
| `freshness` | `fresh` / `aging` / `stale` / `obsolete` | **Is the claim current?** Derived from `last_verified_at` against a half-life appropriate to the layer (canon: 90 days, research: 180 days, _meta: 30 days). |
| `provenance` | `observed` / `derived` / `asserted` / `recovered` / `speculative` | **Where does the claim come from?** Observed = directly measured. Derived = logically follows from observed facts. Asserted = stated by a trusted source without proof. Recovered = mined from an older source (old build, wiki). Speculative = maybe / hypothetical. |
| `coverage` | `comprehensive` / `adequate` / `partial` / `stub` | **How completely is the topic explored?** A comprehensive node answers most questions a reader would bring. A stub is a placeholder. |
| `contradicted_by` | `[]` — list of node refs | **What disagrees with this claim?** Auto-populated by the audit agent when it finds contradictions. Empty list = no known conflicts. |
| `implementation_status` | `landed` / `partial` / `pending` / `n-a` | **Is the claim realized in code?** Only meaningful for specs and decisions that demand implementation. Research nodes, meta files, and descriptive specs use `n-a`. |

## Timestamp fields

| Field | Purpose |
|---|---|
| `last_verified_at` | ISO date. When did someone last confirm the claim is still true? Drives `freshness` calculation. |
| `quality_assessed_at` | ISO date. When were the six quality fields last reviewed or changed? Independent of `last_verified_at` — you can fix a typo in `provenance` without re-verifying the claim. |
| `quality_assessed_by` | `human` / `agent:<name>`. Who last touched the quality block. |

## The full block (example)

```yaml
# ... existing frontmatter ...
confidence: A
freshness: fresh
provenance: recovered
coverage: partial
implementation_status: n-a
contradicted_by: []
last_verified_at: 2026-04-12
quality_assessed_at: 2026-04-12
quality_assessed_by: human
```

## Lazy population rule

**Absence is not a score.** Missing fields mean "not yet assessed," not "bad" or "default." The repo does **not** pre-scaffold empty blocks into every file. Consumers must handle the missing case.

Fields are populated in one of three situations:

1. **On file creation.** Any new file created by an agent or human should include the full block. New genesis files are expected to ship quality-scored.
2. **On file edit.** When an existing unmarked file is edited, the editor (human or agent) must populate the block at minimum the first time the file is touched. `quality_assessed_at` must be refreshed on every edit, even if the values don't change.
3. **On audit pass.** A periodic agent walks the graph and populates `freshness` (derived from `last_verified_at`), `contradicted_by` (from graph traversal), and flags low-confidence nodes for review.

## Freshness half-life by layer

The `freshness` bucket is computed from `last_verified_at` against a layer-specific half-life:

| Layer | Half-life | `fresh` window | `aging` window | `stale` window | `obsolete` |
|---|---|---|---|---|---|
| `canon/` | 90 days | < 30d | 30–60d | 60–180d | > 180d |
| `_meta/` | 30 days | < 10d | 10–30d | 30–90d | > 90d |
| `research/` | 180 days | < 60d | 60–120d | 120–360d | > 360d |
| `intents/` | 60 days | < 20d | 20–60d | 60–180d | > 180d |
| `executions/` | n-a | always `fresh` | (historical records — never go stale) | | |
| wiki (external) | 180 days | same as research/ | | | |

Executions are frozen historical records and their freshness is always `fresh` by convention — they don't describe current reality, they describe a past event.

## What each field does NOT replace

- **`status:` (active / preliminary / draft / deprecated)** is a governance status. Different axis from `confidence` (truth) or `freshness` (currency). A preliminary node can have high confidence; an active node can be stale.
- **`signal_tier:` (S / A / B)** on research nodes is a cross-pollination signal — how valuable is the pattern to steal. Orthogonal to `confidence`.
- **`author:` / `recovered_from:`** already exist for provenance chains. `provenance` is a categorical summary; the existing fields give the full chain.

## Interaction with the audit agent

The audit agent's job when it runs a quality pass:

1. For every node, check if `quality_assessed_at` exists. If missing, log as "unmarked."
2. If present, recompute `freshness` from `last_verified_at` + layer half-life.
3. Walk the graph for `contradicted_by` updates — search for nodes that disagree and maintain the list.
4. Flag nodes where `confidence ≤ C` or `freshness ∈ {stale, obsolete}` or `coverage = stub` for review.
5. Report a summary to `_meta/QUALITY-AUDIT-<date>.md`.

The agent does **not** invent confidence or provenance values. Those come from humans or the agent who last verified the content.

## Related

- [[_meta/DOC-TRUST-HIERARCHY]] — how `confidence` interacts with the trust tier ranking
- [[_meta/SELF-POLLINATION-FINDINGS]] — template for what a comprehensive knowledge inventory looks like

#meta #schema #quality #metrics #lazy
