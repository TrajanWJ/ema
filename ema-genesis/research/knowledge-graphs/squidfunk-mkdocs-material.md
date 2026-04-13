---
id: RES-mkdocs-material
type: research
layer: research
category: knowledge-graphs
title: "squidfunk/mkdocs-material — Material Design theme for MkDocs"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/squidfunk/mkdocs-material
  stars: 26507
  verified: 2026-04-12
  last_activity: 2026-04-03
signal_tier: B
tags: [research, knowledge-graphs, signal-B, mkdocs-material, docs-site]
connections:
  - { target: "[[research/knowledge-graphs/_MOC]]", relation: references }
  - { target: "[[research/knowledge-graphs/jackyzha0-quartz]]", relation: references }
---

# squidfunk/mkdocs-material

> The most polished open-source docs site renderer. Production-proven (FastAPI, Pydantic, Terraform docs). The right tool for EMA's **canon layer** publishing — structured docs vs Quartz's garden aesthetic.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/squidfunk/mkdocs-material> |
| Stars | 26,507 (verified 2026-04-12) |
| Last activity | 2026-04-03 |
| Signal tier | **B** |

## What to steal

### 1. Canon layer renderer

EMA has two layers needing public render. Different audiences:
- **Research layer** → Quartz (garden aesthetic, graph view, backlinks)
- **Canon layer** → MkDocs Material (structured docs, versioning, polished)

Two renderers, same source folder, configurable per-space.

### 2. Plugin ecosystem

`mkdocs-material` plugins: blog, tags, search, social cards, git revision date, macros, redirects. Production-tested at scale.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` Wiki Viewer | MkDocs Material is the canon-layer publish target alongside Quartz for research |

## Gaps surfaced

- EMA canon has one "render the wiki publicly" slot. Quartz and MkDocs Material serve different audiences. Canon should name both.

## Notes

- Python stack. Not directly embedded in EMA.
- Doesn't render wikilinks natively — needs a plugin.
- Weaker graph story than Quartz. Better docs story.

## Connections

- `[[research/knowledge-graphs/jackyzha0-quartz]]` — research-layer alternative
- `[[research/knowledge-graphs/_MOC]]`

#research #knowledge-graphs #signal-B #mkdocs-material #docs-site
