---
id: RES-breadcrumbs
type: research
layer: research
category: knowledge-graphs
title: "SkepticMystic/breadcrumbs — Obsidian plugin with typed-edge Graph Builders model"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/SkepticMystic/breadcrumbs
  stars: 757
  verified: 2026-04-12
  last_activity: 2026-03-29
signal_tier: S
tags: [research, knowledge-graphs, signal-S, breadcrumbs, typed-edges, graph-builders]
connections:
  - { target: "[[research/knowledge-graphs/_MOC]]", relation: references }
  - { target: "[[research/knowledge-graphs/silverbulletmd-silverbullet]]", relation: references }
  - { target: "[[research/knowledge-graphs/blacksmithgu-obsidian-dataview]]", relation: references }
  - { target: "[[DEC-001]]", relation: references }
---

# SkepticMystic/breadcrumbs

> Obsidian plugin that adds **typed links** to markdown notes. Maintains an internal graph where edges have types (`up`/`down`/`next`/`prev`/etc.), supports auto-derived "implied" edges, and unifies multiple edge sources into one typed graph via the **Graph Builders** model.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/SkepticMystic/breadcrumbs> |
| Stars | 757 (verified 2026-04-12) |
| Last activity | 2026-03-29 (active, v4 rewrite) |
| Signal tier | **S** |

## What to steal

### 1. Graph Builders concept

Breadcrumbs derives its edge set from many sources, each a "builder":

| Builder | Source |
|---|---|
| Frontmatter links | `up: [[note]]` in YAML |
| Dataview inline links | `up:: [[note]]` |
| Tag notes | `#topic` files |
| List notes | numbered lists |
| Dendron hierarchical filenames | `topic.subtopic.detail.md` |
| Date notes | `2026-04-12.md` |
| Folder notes | `index.md` per folder |
| Regex notes | custom patterns |

All unified into ONE typed graph. Implied edges customizable per-hierarchy. **Multiple edge sources can coexist.**

This is the missing primitive for EMA's "fulfills / blocks / derived_from" — and it proves you don't have to pick a single syntax.

### 2. Hierarchy definition format

```yaml
{ field: "fulfills", forwards: "[[target]]", reverse: "fulfilled_by" }
```

EMA should adopt this exact shape for typed-edge declarations. Bidirectional names per edge type, configurable per-space.

### 3. Multiple hierarchies in one graph

`work-hierarchy` vs `personal-hierarchy` vs `project-hierarchy` can share a graph with per-hierarchy implied edges. EMA's spaces model implies the same need but canon doesn't yet define it.

### 4. Namespaced frontmatter fields

Breadcrumbs uses prefixed fields like `BC-tag-note-tag`, `BC-list-note-field` to avoid collision with arbitrary YAML. EMA should namespace its typed-edge fields the same way: `ema-link-type: fulfills`.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §5` | Typed-edge requirement gets a formal grammar (Breadcrumbs' hierarchy definition) |
| `[[DEC-001]]` graph engine | Edge declaration grammar via namespaced frontmatter `ema-links: [{type, target}]` |
| `SCHEMATIC-v0.md` | Cross-layer edges (research→canon, intent→canon) become typed relations in one unified graph |

## Gaps surfaced

- EMA canon assumes one edge type set. Breadcrumbs v4 proves multiple hierarchies can share a graph with per-hierarchy implied edges.
- The tension between "frontmatter links" and "Dataview inline links" — EMA needs to pick one or accept both.

## Notes

- Don't port the views (Matrix, Previous/Next, Grid, Path, Tree). Port the graph model.
- Frontmatter prefix convention prevents collision — EMA should namespace similarly.

## Connections

- `[[research/knowledge-graphs/silverbulletmd-silverbullet]]` — Object Index cousin
- `[[research/knowledge-graphs/blacksmithgu-obsidian-dataview]]` — query DSL cousin
- `[[research/knowledge-graphs/iwe-org-iwe]]` — inclusion link cousin (different edge model)
- `[[DEC-001]]`

#research #knowledge-graphs #signal-S #breadcrumbs #typed-edges
