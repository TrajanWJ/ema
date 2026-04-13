---
id: SPEC-PROPOSAL-TEMPLATES
type: canon
subtype: spec
layer: canon
title: "Proposal Seed Contract Library — 5 named templates + vault scan patterns"
status: preliminary
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/proposals/vault_seeder.ex"
recovered_at: 2026-04-12
connections:
  - { target: "[[canon/specs/PROPOSAL-QUALITY-GATE]]", relation: sibling }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
tags: [canon, spec, proposals, templates, seeds, recovered, preliminary]
---

# Proposal Seed Contract Library

> **Recovery status:** Preliminary. Contract library exists in the old build's `lib/ema/proposals/vault_seeder.ex`. Five named templates + four vault-scan regex patterns. This is the **seed morphology** — the shape that any proposal seed must take before it enters the pipeline.

## The 5 templates

Every seed that enters the Proposal Pipeline conforms to one of these templates:

| Key | Title pattern | Summary template | Default scope |
|---|---|---|---|
| `feature` | `Feature: [name]` | *(free-form summary)* | m (medium) |
| `refactor` | `Refactor: [area]` | *(free-form summary)* | m |
| `research` | `Research: [topic]` | *(free-form summary)* | s (small) |
| `fix` | `Fix: [issue]` | *(free-form summary)* | s |
| `design` | `Design: [component]` | *(free-form summary)* | l (large) |

Scope values: `s` (small, < 1 day), `m` (medium, 1–3 days), `l` (large, > 3 days). Scope is the default; the pipeline may rescore.

## Vault scan patterns (auto-seeding)

The VaultSeeder scans all vault markdown files for these regex patterns and creates proposal seeds automatically when it finds a match:

| Pattern | Meaning | Default template |
|---|---|---|
| `^idea:\s*(.+)` | Line starts with "idea:" | `feature` |
| `^proposal:\s*(.+)` | Line starts with "proposal:" | `feature` |
| `^TODO:\s*(.+)` | Line starts with "TODO:" | `fix` |
| `^- \[ \]\s*(.+)` | Unchecked checkbox | `fix` |

The match's capture group becomes the summary. The line's file path + line number becomes the provenance. The template is chosen by pattern.

## The create flow

1. VaultSeeder finds a matching line in a vault markdown file
2. Calls `create_from_contract(template_key, summary_text, source_path, source_line)`
3. Contract returns a fully-formed proposal seed with:
   - `title` filled from the template pattern
   - `summary` filled from the match
   - `estimated_scope` from the template default
   - `source` pointing to the vault file + line
4. Seed enters the Proposal Pipeline at the Preflight stage (see [[canon/specs/PROPOSAL-QUALITY-GATE]])

## Why this structure

The template library is **an interface contract**, not a grab-bag of preset titles. Every downstream pipeline stage (Generator, Refiner, Debater, Scorer) relies on the seed having a `title`, `summary`, `estimated_scope`, and `source`. Free-form seeds would force every stage to handle missing fields. The contract eliminates that class of bugs.

The five templates also constrain the **kinds** of proposals that can exist. You can't have a proposal that's "vibe" or "maybe someday" — it has to fit one of the five shapes. This is opinionated on purpose.

## Extending the library

Adding new templates is allowed but should be rare. Each new template must answer:
- What makes it distinct from the existing five?
- What scope defaults?
- What pattern should auto-trigger it from the vault scan?
- Does it break any downstream pipeline assumption?

## Gaps / open questions

- **Per-project templates.** Should a project be able to define custom templates (e.g., an EMA-internal `genesis-port` template for porting work)? Not supported in the old build.
- **Template deprecation.** What happens if a template is removed but old seeds still reference it by key?
- **LLM auto-classification.** Currently patterns are hard regex. An LLM classifier could route e.g. "I should probably..." to `feature` automatically. Deferred, probably desirable.
- **Title pattern strictness.** The `feature: [name]` pattern requires the user to already have a name in mind. What if they don't? Fallback to `feature: Untitled` or prompt for name?

## Related

- [[canon/specs/PROPOSAL-QUALITY-GATE]] — sibling spec, the preflight stage these seeds enter
- [[_meta/SELF-POLLINATION-FINDINGS]] §A TIER PORT `Ema.Proposals.Pipeline` — parent pipeline
- Original source: `IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/proposals/vault_seeder.ex`

#canon #spec #proposals #templates #seeds #recovered #preliminary
