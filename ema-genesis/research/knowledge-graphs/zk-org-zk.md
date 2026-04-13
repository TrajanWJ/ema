---
id: RES-zk
type: research
layer: research
category: knowledge-graphs
title: "zk-org/zk — plain-text Zettelkasten CLI with notebook-housekeeping verbs"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/zk-org/zk
  stars: 2518
  verified: 2026-04-12
  last_activity: 2026-04-09
signal_tier: B
tags: [research, knowledge-graphs, signal-B, zk, cli, zettelkasten]
connections:
  - { target: "[[research/knowledge-graphs/_MOC]]", relation: references }
  - { target: "[[research/cli-terminal/oclif-oclif]]", relation: references }
---

# zk-org/zk

> Plain-text Zettelkasten CLI in Go. Folder of markdown = notebook. The **notebook-housekeeping verb set** is what EMA's `ema wiki` CLI should mirror.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/zk-org/zk> |
| Stars | 2,518 (verified 2026-04-12) |
| Last activity | 2026-04-09 (very active) |
| Signal tier | **B** |

## What to steal

### 1. The verb set

```
zk list           # list all notes
zk new            # create with template
zk edit           # open in editor
zk find           # filter by tag/link/mention/path
zk graph          # visualize the graph
```

Plus filters: `--tag`, `--link-to`, `--mentioned-by`, `--orphan`, `--match`. Named filters in config (`zk list saved-filter-name`).

EMA's `ema wiki` CLI should provide the same verb set over the Object Index:
- `ema wiki list`
- `ema wiki new`
- `ema wiki search`
- `ema wiki links`
- `ema wiki orphans`

### 2. Notebook housekeeping

- **Orphan detection** — find notes with no incoming or outgoing links
- **Dead link detection** — find broken `[[wikilinks]]`
- **Tag-untagged audit** — find notes with no tags

EMA's current vault has none of this. zk's verbs fill the gap.

### 3. LSP integration

zk ships an LSP server so any editor can navigate the graph. Same pattern as `[[research/knowledge-graphs/iwe-org-iwe]]` — multi-editor support for free.

### 4. Narrow scope

zk explicitly says "zk is not an editor, not a web server" — clean scope. This narrow focus is why it's faster than Logseq at what it does. EMA should respect the same scope boundary.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` | Add `ema wiki list/new/search/links/orphans` as built-in CLI commands |

## Gaps surfaced

- EMA's CLI focuses on tasks/projects/brain dumps. **No wiki-maintenance verb set** (orphans, broken links, untagged notes).

## Notes

- Go binary.
- Pairs naturally with `[[research/cli-terminal/oclif-oclif]]` — port the verbs into oclif commands.

## Connections

- `[[research/knowledge-graphs/iwe-org-iwe]]` — LSP cousin
- `[[research/knowledge-graphs/silverbulletmd-silverbullet]]` — Object Index back-end
- `[[research/cli-terminal/oclif-oclif]]` — CLI framework

#research #knowledge-graphs #signal-B #zk #cli #zettelkasten
