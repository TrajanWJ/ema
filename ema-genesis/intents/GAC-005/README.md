---
id: GAC-005
type: gac_card
layer: intents
title: "Typed edge grammar — how do EMA's [[wikilinks]] carry edge type metadata?"
status: answered
created: 2026-04-12
updated: 2026-04-12
answered_at: 2026-04-12
answered_by: human
resolution: option-C-frontmatter-primary-inline-sugar
author: research-round-1
category: gap
priority: high
connections:
  - { target: "[[DEC-001]]", relation: references }
  - { target: "[[research/knowledge-graphs/SkepticMystic-breadcrumbs]]", relation: derived_from }
  - { target: "[[research/knowledge-graphs/iwe-org-iwe]]", relation: derived_from }
  - { target: "[[research/knowledge-graphs/blacksmithgu-obsidian-dataview]]", relation: derived_from }
---

# GAC-005 — Typed edge grammar

## Question

`[[DEC-001]]` says edges are typed with `fulfills`, `produces`, `references`, `supersedes`, `derived_from`, `blocks`. **How are these declared in markdown?** Frontmatter? Inline syntax? Both?

## Context

Round 1 surfaced three competing conventions:

1. **Breadcrumbs** (`[[research/knowledge-graphs/SkepticMystic-breadcrumbs]]`) — namespaced frontmatter `BC-tag-note-tag: ...` plus Dataview-style inline `up:: [[target]]`
2. **iwe** (`[[research/knowledge-graphs/iwe-org-iwe]]`) — structural: a standalone link paragraph IS the parent/child edge. No syntax.
3. **Dataview** (`[[research/knowledge-graphs/blacksmithgu-obsidian-dataview]]`) — frontmatter for page-level + inline `key:: value` for body-level

EMA needs to pick one or accept multiple. The decision affects every existing markdown file.

## Options

- **[A] Frontmatter only** — `ema-links: [{type: fulfills, target: "[[INT-001]]"}]`. Structured, parseable, no body changes.
  - **Implications:** Clean but loses inline expressiveness. Users have to leave the body to declare edges.
- **[B] Inline-only with wikilink syntax** — `[[fulfills::INT-001]]`. Inline, expressive, no frontmatter clutter.
  - **Implications:** Mixing edge type into wikilink syntax. Doesn't conflict with plain `[[wikilinks]]`. Easy to read in markdown.
- **[C] Both — frontmatter for structural, inline for inline** (Dataview model). User picks based on intent.
  - **Implications:** Most flexible. Two parsers, two ways to do everything. More complex but most ergonomic.
- **[D] Structural — standalone link paragraph IS the edge** (iwe model). No syntax. The position of the link in the markdown AST determines its meaning.
  - **Implications:** Zero syntax burden. Constrains what counts as a parent/child link. Doesn't directly express other edge types like `blocks` or `supersedes`.
- **[1] Defer**: Pick a default for v1, allow extension later.
- **[2] Skip**: Use plain `[[wikilinks]]` only — don't type edges in v1.

## Recommendation

**[C]** with frontmatter as the primary form and inline `[[type::target]]` as syntactic sugar. Frontmatter parser is mandatory; inline parser is incremental.

```yaml
---
id: INT-005
ema-links:
  - { type: fulfills, target: "[[INT-001]]" }
  - { type: blocks, target: "[[INT-007]]" }
  - { type: derived_from, target: "[[CANON-AGENT-RUNTIME]]" }
---
```

Plus inline:
```markdown
This intent fulfills [[fulfills::INT-001]] and blocks [[blocks::INT-007]].
```

Both produce the same edges in the index.

## What this changes

`[[DEC-001]]` gains a "Typed Edge Declaration Grammar" subsection. Object Index parser handles both forms. Edge type set is enumerated.

## Connections

- `[[DEC-001]]`
- `[[research/knowledge-graphs/SkepticMystic-breadcrumbs]]`
- `[[research/knowledge-graphs/iwe-org-iwe]]`
- `[[research/knowledge-graphs/blacksmithgu-obsidian-dataview]]`

## Resolution (2026-04-12)

**Answer: [C] Both, with frontmatter as the primary form and inline `[[type::target]]` as syntactic sugar.**

The primary declaration is a namespaced frontmatter field:

```yaml
---
id: INT-005
ema-links:
  - { type: fulfills,     target: "[[INT-001]]" }
  - { type: blocks,       target: "[[INT-007]]" }
  - { type: derived_from, target: "[[CANON-AGENT-RUNTIME]]" }
---
```

Inline is a *secondary* syntactic sugar, parsed by a second-pass indexer:

```markdown
This intent fulfills [[fulfills::INT-001]] and blocks [[blocks::INT-007]].
```

Both forms emit the same Object rows into the `edges` table. Edge types for v1: `fulfills`, `produces`, `references`, `supersedes`, `derived_from`, `blocks` (from `[[DEC-001]]`). Inverse map maintained in code (`fulfills ↔ fulfilled_by`, `blocks ↔ blocked_by`, `derived_from ↔ derives`, etc).

**Bridge to the recovery wave:** the old Elixir Pipes trigger format (`noun:verb`, e.g. `proposals:generated`) is the same shape as the inline edge grammar — a namespaced operator followed by a target. This is not coincidence. The Pipes registry grammar and the typed edge grammar are the same conceptual primitive (typed directed reference) at two different layers of the stack. Worth noting but not worth unifying in v1.

#gac #gap #priority-high #typed-edges #grammar #answered
