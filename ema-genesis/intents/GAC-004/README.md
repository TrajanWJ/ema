---
id: GAC-004
type: gac_card
layer: intents
title: "Intent exit_condition + scope — should these be mandatory before dispatch?"
status: answered
created: 2026-04-12
updated: 2026-04-12
answered_at: 2026-04-12
answered_by: human
resolution: option-D-kind-aware-mandatory
author: research-round-1
category: gap
priority: high
connections:
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
  - { target: "[[research/life-os-adhd/Kodaxadev-Task-Anchor-MCP]]", relation: derived_from }
  - { target: "[[research/self-building/snarktank-ralph]]", relation: derived_from }
---

# GAC-004 — Intent exit_condition + scope

## Question

Currently EMA's `Intent` has no `exit_condition` (how do we know it's done?) or `scope` (which files/areas it can touch). The Dispatcher accepts an unbounded intent and runs it. Should these become mandatory schema fields?

## Context

Round 1's `[[research/life-os-adhd/Kodaxadev-Task-Anchor-MCP]]` (1 star, S-tier mechanism) has the cleanest answer: every task carries `exit_condition: string` and `scope: string[]` (file globs allowed to be edited). A `scope_validate_edit(file_path)` function blocks out-of-scope writes at runtime.

`[[research/self-building/snarktank-ralph]]` (15.5k stars) makes a related claim: "stories must be small enough to complete in one context window" — a sizing constraint enforced before dispatch.

Without these, EMA's Dispatcher can run an intent like "refactor the whole codebase" the same way it runs "rename this variable." That's a footgun.

## Options

- **[A] Both mandatory on Intent schema**: `exit_condition` and `scope` are required. Validation runs at intent creation time. Dispatcher enforces scope at write time.
  - **Implications:** Hard contract. Forces the user to think about completion before dispatch. Stricter but harder UX. Matches Task-Anchor-MCP's pattern verbatim.
- **[B] Both optional with defaults**: Optional fields. Default scope = whole project. Default exit_condition = "user marks complete."
  - **Implications:** Backwards-compatible with existing intents. Loses the "force the user to think" benefit. Becomes vestigial.
- **[C] Exit_condition mandatory, scope optional**: Exit condition is the harder one to enforce; require it. Scope is nice-to-have for high-stakes intents only.
  - **Implications:** Reasonable middle ground. Doesn't catch the "agent edits unrelated files" failure mode.
- **[D] Schema gains both fields, validation by intent kind**: Required for `kind: implement` intents. Optional for `kind: research` / `kind: explore` / `kind: planning`.
  - **Implications:** Per-kind defaults. Forces the discipline where it matters (code work) without burdening exploratory work.
- **[1] Defer**: Add as v2 schema migration after the v1 dispatcher is stable.
- **[2] Skip**: Trust the user to write good intents without schema enforcement.

## Recommendation

**[D]** — schema gains both fields, required for `implement` and `port` intent kinds, optional otherwise. This catches the dangerous case (unbounded code work) while not making every brain dump fill in fields.

## What this changes

`Intent` schema gains `exit_condition: string?` and `scope: string[]?`. Validation function runs at create time with kind-aware required fields. Dispatcher enforces scope on file writes via a wrapped tool layer.

## Connections

- `[[canon/specs/EMA-V1-SPEC]]` §4 ontology
- `[[research/life-os-adhd/Kodaxadev-Task-Anchor-MCP]]`
- `[[research/self-building/snarktank-ralph]]`
- `[[_meta/SELF-POLLINATION-FINDINGS]]` — Intent schema augmentation

## Resolution (2026-04-12)

**Answer: [D] Schema gains both fields, kind-aware required.**

The `Intent` schema (both filesystem `intent.md` frontmatter and SQLite index row) grows two fields:

```yaml
exit_condition: string      # how we know this intent is done
scope: string[]             # file globs allowed to be edited/read
```

Required for `kind: implement` and `kind: port` intents. Optional (with warning) for `kind: research`, `kind: explore`, `kind: planning`, `kind: brain_dump`. Validation runs at intent creation time via a Zod schema in `shared/schemas/intents.ts`. The Dispatcher enforces `scope` at write time by wrapping tool-layer file operations with a glob check.

**Bridge to the recovery wave:** the old Elixir two-layer `.superman/intents/<slug>/` layout (Appendix A.6: `intent.md` + `status.json`) is preserved. Both new fields live in `intent.md` frontmatter; `status.json` remains runtime-only. Semantic kebab-slugs stay the ID format per `[[canon/specs/EMA-VOICE]]`.

#gac #gap #priority-high #intent-schema #exit-condition #answered
