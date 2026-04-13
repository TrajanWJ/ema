---
id: RES-foam
type: research
layer: research
category: knowledge-graphs
title: "foambubble/foam — VS Code PKM as a minimal file-watcher → graph reference"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/foambubble/foam
  stars: 17018
  verified: 2026-04-12
  last_activity: 2026-04-11
signal_tier: B
tags: [research, knowledge-graphs, signal-B, foam, vscode, file-watcher]
connections:
  - { target: "[[research/knowledge-graphs/_MOC]]", relation: references }
  - { target: "[[research/knowledge-graphs/silverbulletmd-silverbullet]]", relation: references }
---

# foambubble/foam

> Personal knowledge management for VS Code. Pure markdown + wikilinks + frontmatter, built as a VS Code extension with graph viz and daily notes. **The minimum-viable file-watcher → graph reference implementation** if SilverBullet's Object model feels heavy.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/foambubble/foam> |
| Stars | 17,018 (verified 2026-04-12) |
| Last activity | 2026-04-11 |
| Signal tier | **B** |

## What to steal

### 1. Minimum viable architecture

```
file watcher → parser → in-memory graph → consumers
```

Much simpler than SilverBullet. If EMA wants a minimum-viable research-layer-as-graph today before tackling the full Object Index, Foam's structure is the right copy target.

### 2. WIKILINK_EMBED_REGEX

Foam's source has a concrete regex for parsing `![[note]]` embeds and plain `[[note]]` references. Useful as a starter for EMA's wikilink parser.

### 3. foam-template starter vault

`foambubble/foam-template` (1,206 stars) — a starter vault structure. Reference for EMA's wiki seed content layout.

## Changes canon

None directly — Foam is a reference implementation, not an architectural primitive. Resolves the "how do we bootstrap before SilverBullet" question.

## Gaps surfaced

Nothing new; confirms the approach.

## Notes

- 17k stars makes it credible.
- Companion publish story via GitHub Pages + Gatsby, but Quartz is stronger for the web-frontend slot.

## Connections

- `[[research/knowledge-graphs/silverbulletmd-silverbullet]]` — full Object Index alternative
- `[[research/knowledge-graphs/jackyzha0-quartz]]` — publish-side cousin

#research #knowledge-graphs #signal-B #foam #vscode
