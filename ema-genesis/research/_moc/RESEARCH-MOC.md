---
id: RESEARCH-MOC
type: moc
layer: research
title: "Research Layer — Map of Content"
status: active
created: 2026-04-12
updated: 2026-04-12
author: system
tags: [moc, research, cross-pollination, index]
connections:
  - { target: "[[_meta/CANON-STATUS]]", relation: references }
  - { target: "[[EMA-GENESIS-PROMPT]]", relation: references }
---

# Research Layer — Map of Content

> This is the root index of EMA's research layer. Every cross-pollination source
> is a node in this folder tree. Connections form the graph. This mock-up is
> bootstrap state for the eventual context graph engine — it ingests these
> files and makes the graph queryable.

## How This Layer Works

1. Each external source (GitHub repo, paper, blog post, spec) gets its own
   `.md` file under a category folder.
2. Frontmatter is YAML: `id`, `type`, `layer`, `title`, `status`, `tags`,
   `connections`, `source`, `signal_tier`, `insight`.
3. Body uses Obsidian-style `[[wikilinks]]` to connect to canon nodes,
   other research nodes, intents, and GAC cards.
4. Pipe tables for structured data.
5. Tags at bottom.
6. Each category folder has its own `_MOC.md` that indexes its children
   and rolls up insights.
7. Future work enters through queue nodes first, especially
   `[[research/research-ingestion/QUEUE]]`, before being promoted into
   category research docs and extraction notes.

## Categories

| Category | Folder | Covers |
|---|---|---|
| Agent orchestration | `[[research/agent-orchestration/_MOC\|agent-orchestration]]` | Parallel coding agents, multi-agent coordination, worktree-per-agent patterns, shep-style systems |
| P2P & CRDTs | `[[research/p2p-crdt/_MOC\|p2p-crdt]]` | Local-first sync, Automerge, Yjs, Loro, Gun.js, OrbitDB, SurrealDB, Electric |
| Knowledge graphs & wikis | `[[research/knowledge-graphs/_MOC\|knowledge-graphs]]` | Obsidian, Logseq, Foam, Dendron, Anytype, graph databases, typed-link systems |
| CLI & terminal runtime | `[[research/cli-terminal/_MOC\|cli-terminal]]` | xterm.js, node-pty, tmux wrappers, Electron terminal apps, Warp, Wave, Tabby |
| vApp & plugin architectures | `[[research/vapp-plugin/_MOC\|vapp-plugin]]` | Electron multi-window, web component apps, plugin runtimes, Raycast, Rofi, Übersicht |
| Context & agent memory | `[[research/context-memory/_MOC\|context-memory]]` | Long-horizon memory, session continuity, compression, engram, open-mem, CONTINUITY |
| Research ingestion & feeds | `[[research/research-ingestion/_MOC\|research-ingestion]]` | RSS aggregators, AI-curated feeds, Miniflux, FreshRSS, Readwise Reader, queue-driven intake |
| Life OS / ADHD / exec function | `[[research/life-os-adhd/_MOC\|life-os-adhd]]` | Personal OS, ADHD tools, exec dysfunction aids, body doubling, brain dumps |
| Self-building systems | `[[research/self-building/_MOC\|self-building]]` | Intent-proposal-execution systems, autonomous dev pipelines, blueprint tools |
| Frontend patterns | `[[research/frontend-patterns/_MOC\|frontend-patterns]]` | Launchpad, HQ dashboard, Dock, CommandBar, AmbientStrip, glass tokens, vApp shell contract, iii-lite dual-surface — self-pollination from current renderer + old Tauri build |

## Research Rounds

| Round | Status | Agents | Focus | Gaps Surfaced |
|---|---|---|---|---|
| 1 | pending | 6 parallel | Broad pass across all 9 categories | TBD |
| 2 | pending | TBD | Gap-driven follow-ups from Round 1 | TBD |
| 3 | pending | TBD | Recursive deep dives | TBD |

## Target

~50 high-signal nodes total across all categories. Each node answers:

1. **What it is** — 1-line summary
2. **What pattern EMA can steal** — specific insight
3. **What it changes about the blueprint** — concrete effect on canon
4. **Gaps or contradictions it surfaces** — feeds into GAC cards
5. **Signal tier** — S (direct steal) / A (strong pattern) / B (niche but unique)

## Related Nodes

- `[[_meta/CANON-STATUS]]` — Why we're researching the full Genesis vision, not just V1
- `[[intents/GAC-QUEUE-MOC]]` — GAC cards generated from research gaps
- `[[research/research-ingestion/QUEUE]]` — queue of future clone/query/topic/domain passes
- `[[_meta/CROSS-POLLINATION-REGISTRY]]` — Flat summary/ranking of all sources

#moc #research #cross-pollination #index
