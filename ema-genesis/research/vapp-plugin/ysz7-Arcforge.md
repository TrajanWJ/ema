---
id: RES-arcforge
type: research
layer: research
category: vapp-plugin
title: "ysz7/Arcforge — graph-first backend IDE with plugin parsers, architecture JSON, and rollback-backed forge"
status: active
created: 2026-04-13
updated: 2026-04-13
author: codex
source:
  url: https://github.com/ysz7/Arcforge
  stars: 105
  verified: 2026-04-13
  last_activity: 2026-03-23
signal_tier: A
tags: [research, vapp-plugin, graph-ide, architecture, forge, plugins, arcforge]
connections:
  - { target: "[[research/vapp-plugin/_MOC]]", relation: references }
  - { target: "[[research/_extractions/ysz7-Arcforge]]", relation: references }
  - { target: "[[vapps/CATALOG]]", relation: references }
---

# ysz7/Arcforge

> 105 stars. Arcforge is not a general IDE replacement. It is a Windows Electron desktop app that turns a backend project or a hand-authored architecture file into a navigable graph, lets plugins define extraction and editing capabilities, and layers a guarded "Forge" mutation system with preview + rollback on top. The strongest donor patterns for EMA are the graph-first parser contract, the architecture-file mode, and the reversible write layer.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/ysz7/Arcforge> |
| Stars | 105 (verified 2026-04-13) |
| Last activity | 2026-03-23 (`Open Source Release`) |
| Signal tier | **A** |
| Stack | Electron + React 18 + TypeScript + React Flow + Monaco + runtime plugins |

## What it is

Arcforge has two real product modes:

1. **Existing backend as graph**
   - Open a project through a manifest-driven plugin such as Laravel
   - Parse source files into nodes + edges
   - Explore structure, read code, and export a prompt-like architecture summary
2. **Architecture as graph**
   - Create or open an Arcforge architecture JSON file
   - Edit an intentional architecture graph directly
   - Save it back to disk and export a lightweight AI-ready prompt

Underneath that, there is a third system:

3. **Forge**
   - node-scoped blueprints
   - preview mutations
   - apply file edits with backup
   - confirm or roll back changes

So the repo's real identity is:

- graph IDE for backend understanding
- architecture designer
- guarded boilerplate/refactor tool

## What to steal

### 1. Plugin-as-parser contract

Arcforge's parser contract is unusually practical: a plugin declares `manifest.json`, `nodes.js`, and `parser.js`, then returns graph nodes and edges from real code. The main process loads the plugin, exposes capabilities, and hot-reloads it when those files change.

For EMA, this is a strong donor for:
- read-only codebase ingestion plugins
- graph adapters per ecosystem
- a cleaner distinction between "how do we extract structure?" and "how do we render/use it?"

### 2. Architecture-file mode as a first-class object

The `arcspec` path is not just a mockup. It persists a graph-shaped architecture document to JSON, re-opens it, watches it, and exports a prompt summary from it.

The steal is not the exact JSON schema. The steal is the **mode split**:
- discovered graph from code
- intentional graph from design

EMA needs this distinction. Intent prose alone is not enough for blueprint work.

### 3. Reversible mutation layer

The Forge layer previews mutations, writes them through one file-mutation service, stores a backup manifest, and supports confirm/rollback both globally and per-file.

That is a valuable shape for EMA's future "guided writeback" or "scaffold from blueprint" lane:
- preview first
- mutate through one service
- keep a recoverable backup object
- never treat file writes as invisible side effects

### 4. Graph + action in one surface

Arcforge couples navigation and action honestly:
- inspect a node
- read the file behind it
- ask what blueprints apply
- preview the resulting changes

This is stronger than a passive architecture diagram. It makes the graph operational.

## What not to steal

### 1. The current plugin trust model

Plugins run with full Node.js filesystem access. That is acceptable for an open beta desktop tool, but not a safe base for EMA's long-term extension model.

If EMA borrows this pattern, it should tighten it:
- read-only parser workers by default
- explicit mutation capability boundary
- stronger isolation than arbitrary Node access

### 2. The current architecture format as canon

Arcforge's architecture file is effective, but intentionally thin:
- magic string
- version
- nodes
- edges

That is a fine bridge object, not a full semantic model. EMA should borrow the **editable graph mode**, not blindly adopt the schema as canonical truth.

### 3. The "backend IDE" positioning as a total product answer

Arcforge is best at understanding and planning around backend structure. It is weaker as a broader personal or agent operating environment. Its value to EMA is as a donor for one surface, not as a foundation for the whole system.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` | Add a graph-first architecture / code-relationship surface as a concrete app type |
| `SCHEMATIC-v0.md` | Distinguish intentional architecture graph from inferred code graph |
| `EMA-GENESIS-PROMPT.md §3` | Treat parser plugins and mutation blueprints as separate extension seams |

## Gaps surfaced

- EMA still lacks a truthful graph-first code understanding surface.
- EMA has intent and canon, but no first-class editable architecture graph object.
- EMA should not let parser plugins and mutating automation share the same trust boundary by default.

## Notes

- The repo README emphasizes "safe refactors", but the actual safety comes from preview + rollback, not from semantic correctness guarantees.
- `ADAPTERS` in the core registry is empty; the live framework path is plugin-driven rather than adapter-registry-driven.
- The Laravel plugin is heuristic and regex/file-walk based, but still useful as a donor for "good enough graph extraction" in constrained ecosystems.

## Connections

- `[[research/vapp-plugin/laurent22-joplin]]` — plugin-runtime and desktop-shell cousin
- `[[research/vapp-plugin/logseq-logseq]]` — SDK/global-proxy cousin
- `[[research/_extractions/ysz7-Arcforge]]` — code-level extraction
- `[[vapps/CATALOG]]`

#research #vapp-plugin #graph-ide #architecture #forge #plugins #arcforge
