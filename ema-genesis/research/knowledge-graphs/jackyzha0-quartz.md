---
id: RES-quartz
type: research
layer: research
category: knowledge-graphs
title: "jackyzha0/quartz — static site generator for Obsidian-style vaults"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/jackyzha0/quartz
  stars: 11784
  verified: 2026-04-12
  last_activity: 2026-04-11
signal_tier: S
tags: [research, knowledge-graphs, signal-S, quartz, web-frontend, static-site]
connections:
  - { target: "[[research/knowledge-graphs/_MOC]]", relation: references }
  - { target: "[[research/knowledge-graphs/silverbulletmd-silverbullet]]", relation: references }
  - { target: "[[DEC-001]]", relation: references }
---

# jackyzha0/quartz

> Static-site generator that renders an Obsidian-style vault (wikilinks, backlinks, graph view, tag pages, search) into a publishable website. The web-frontend slot for EMA's research layer.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/jackyzha0/quartz> |
| Stars | 11,784 (verified 2026-04-12) |
| Last activity | 2026-04-11 (very active) |
| Signal tier | **S** |
| Language | TypeScript |

## What to steal

### 1. Three-stage plugin pipeline

```typescript
// Transformers — map over content
parseFrontmatter, generateDescriptions, processObsidianMarkdown,
processGFM, processLatex, ...

// Filters — filter content
removeDrafts, applyExplicitPublish, ignorePatterns

// Emitters — reduce over content (build outputs)
renderPages, buildContentIndex, emitRSS, emitTagPages, emitGraphView
```

Three stages with clean data flow. EMA's research layer rendering should follow this exact shape.

### 2. ExplicitPublish filter

Per-page publish flag. Notes are private by default; only ones marked `publish: true` get rendered. Combined with `ignorePatterns` glob exclusion, this gives the per-space public/private config EMA needs for Life OS spaces.

### 3. ContentIndex emitter for graph view

The graph view is computed from a derived `ContentIndex` emitter — proving you don't need a runtime DB, just a derived index. Same pattern as `[[research/knowledge-graphs/silverbulletmd-silverbullet]]`.

### 4. Plugin ordering matters

`quartz.config.ts` defines the plugin pipeline order. Deterministic, debuggable. EMA's vApp runtime should treat plugin order as explicit, not magic.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` vApp 14 (Wiki Viewer) | Quartz fills the "web frontend for markdown wiki" slot |
| Future Life OS spec | Per-space public/private rendering becomes a Quartz config |
| `[[DEC-001]]` graph engine | Public render path uses Quartz for research layer |

## Gaps surfaced

- EMA canon has no plan for "how is this wiki rendered publicly." Life OS talks about P2P sync but not read-only public publishing. Quartz answers it.
- **Caveat:** Quartz is build-time static; EMA wants live content. Resolution: run Quartz plugin pipeline at write-time (Phoenix channel broadcast triggers emitter) — incremental emit, not batch build.

## Notes

- 11.7k stars, very active. Maggie Appleton's garden runs on Quartz.
- TypeScript codebase — direct read for EMA.
- 30+ built-in plugins.
- Compare with `[[research/knowledge-graphs/squidfunk-mkdocs-material]]` — Quartz wins for garden aesthetic, MkDocs wins for structured docs.

## Connections

- `[[research/knowledge-graphs/silverbulletmd-silverbullet]]` — same Object Index pattern
- `[[research/knowledge-graphs/foambubble-foam]]` — alternative
- `[[DEC-001]]`
- `[[vapps/CATALOG]]` Wiki Viewer

#research #knowledge-graphs #signal-S #quartz #web-frontend #static-site
