---
id: EXTRACT-ysz7-Arcforge
type: extraction
layer: research
category: vapp-plugin
title: "Source Extractions — ysz7/Arcforge"
status: active
created: 2026-04-13
updated: 2026-04-13
author: codex
clone_path: "../_clones/ysz7-Arcforge/"
source:
  url: https://github.com/ysz7/Arcforge
  sha: b9ee5ef
  clone_date: 2026-04-13
  depth: shallow-1
  size_mb: 6
tags: [extraction, vapp-plugin, arcforge, graph-ide, architecture, forge]
connections:
  - { target: "[[research/vapp-plugin/ysz7-Arcforge]]", relation: source_of }
  - { target: "[[research/_clones/INDEX]]", relation: references }
---

# Source Extractions — ysz7/Arcforge

> Arcforge is a concrete donor for three EMA-adjacent problems: graph-first code understanding, editable architecture graphs, and guarded mutation/writeback. The key source-level finding is that these are implemented as **separate seams**: manifest-driven parser plugins, an Arcspec file adapter, and a Forge mutation layer with backup/rollback.

## Clone metadata

| Field | Value |
|---|---|
| URL | https://github.com/ysz7/Arcforge |
| Clone depth | --depth=1 shallow |
| Clone date | 2026-04-13 |
| Clone size | ~6 MB |
| Language | TypeScript / Electron / React, plus plain JS plugins |
| License | MIT |
| Key commit SHA | b9ee5ef |

## Install attempt

- **Attempted:** no
- **Command:** would be `npm install && npm run dev` in `/home/trajan/Projects/ema/ema-genesis/research/_clones/ysz7-Arcforge/arcforge-app/`
- **Result:** skipped
- **If skipped, why:** The value here is architectural extraction, not runtime smoke testing. The app is explicitly Windows x64-focused, Electron-based, and likely to provide little extra signal under this Linux session for the time spent.

## Run attempt

- **Attempted:** no
- **Result:** skipped
- **If skipped, why:** see install

## Key files identified

Ordered by donor value:

1. `arcforge-app/app/electron/main.ts` — plugin loader, capability model, plugin hot reload, project-open orchestration
2. `arcforge-app/app/core/engine/AnalysisEngine.ts` — parse/watch/refresh loop
3. `arcforge-app/app/core/frameworks/architecture/ArchitectureAdapter.ts` — architecture document as graph source
4. `arcforge-app/app/plugins/arcspec/parser.ts` — save/export/controller surface for the architecture mode
5. `arcforge-app/app/core/forge/ForgeEngine.ts` — preview/execute lifecycle for blueprints
6. `arcforge-app/app/core/forge/FileMutationLayer.ts` — backup manifest, apply, rollback, confirm file
7. `plugins/laravel/parser.js` — pragmatic parser example for turning real code into graph nodes and edges
8. `arcforge-app/app/electron/preload.ts` — narrow renderer bridge with graph/project/plugin/fs/forge APIs
9. `arcforge-app/app/renderer/src/components/GraphView.tsx` — graph + editor interaction surface
10. `arcforge-app/app/core/config/adapters.ts` — useful negative signal: the typed adapter registry exists, but the active path is plugin-driven

## Extracted patterns

### Pattern 1: Manifest-driven parser plugins with runtime capabilities and hot reload

**Files:**
- `arcforge-app/app/electron/main.ts:38-48` — restrictive default capability shape
- `arcforge-app/app/electron/main.ts:57-77` — copy SDK and typings into user plugin area
- `arcforge-app/app/electron/main.ts:96-144` — watch plugin source files and hot-reload parser + graph
- `arcforge-app/app/electron/main.ts:151-210` — load `manifest.json`, `parser.js`, optional `nodes.js`, and exported controller methods
- `arcforge-app/app/electron/main.ts:374-409` — merge built-in and user plugin directories

**What to port to EMA:**
Use a plugin contract where a parser contributes:
- metadata + capabilities
- node type definitions
- a parse function producing a graph/read model

That is a cleaner extension seam than hard-coding every ecosystem into EMA core.

**Adaptation notes:**
- EMA should not inherit the full-trust Node execution model.
- Split parser plugins from mutation plugins.
- Capabilities should be explicit and deny-by-default, as Arcforge already hints with `DEFAULT_CAPABILITIES`.

### Pattern 2: Analysis loop = detect/open -> analyze -> watch -> refresh -> broadcast

**Files:**
- `arcforge-app/app/core/engine/AnalysisEngine.ts:27-131` — open project, run adapter analysis, register blueprints, publish graph
- `arcforge-app/app/core/engine/AnalysisEngine.ts:139-184` — open architecture file through the same engine
- `arcforge-app/app/core/engine/AnalysisEngine.ts:187-233` — debounce and refresh logic
- `arcforge-app/app/core/engine/FileWatcher.ts:20-64` — chokidar-based watched-pattern refresh trigger

**What to port to EMA:**
Arcforge shows a small but strong loop:
- resolve source
- analyze into graph
- store graph
- watch relevant files
- re-run and publish updates

EMA can reuse this shape for:
- code graph adapters
- blueprint-derived read models
- any future "workspace understanding" surface

**Adaptation notes:**
- The engine is cleaner than the product positioning suggests.
- EMA should likely emit durable events in addition to live renderer updates.

### Pattern 3: Intentional architecture graph as a persisted file mode

**Files:**
- `arcforge-app/app/core/frameworks/architecture/ArchitectureAdapter.ts:24-85` — architecture file -> graph adapter
- `arcforge-app/app/core/frameworks/architecture/ArchitectureAdapter.ts:88-119` — persist graph back to file
- `arcforge-app/app/plugins/arcspec/parser.ts:24-58` — parse/reload/createNew surface
- `arcforge-app/app/plugins/arcspec/parser.ts:65-96` — connection rules, deletability, blueprints, watch patterns
- `arcforge-app/app/plugins/arcspec/parser.ts:102-134` — save and export flow
- `arcforge-app/app/electron/main.ts:626-701` — create/open architecture document through the main process

**What to port to EMA:**
EMA should seriously consider a first-class architecture object that is:
- editable
- durable
- graph-shaped
- separate from inferred code structure

The steal is the mode, not the exact schema.

**Adaptation notes:**
- Arcforge stores a deliberately thin JSON document. EMA probably wants richer semantics and links.
- Even so, a narrow bridge object is better than forcing every blueprint back into prose intent markdown.

### Pattern 4: Preview/execute/rollback mutation layer with one backup object

**Files:**
- `arcforge-app/app/core/forge/ForgeEngine.ts:19-64` — preview lifecycle
- `arcforge-app/app/core/forge/ForgeEngine.ts:68-100` — execute lifecycle
- `arcforge-app/app/core/forge/ForgeEngine.ts:105-163` — confirm, rollback, per-file rollback, auto-derived params
- `arcforge-app/app/core/forge/FileMutationLayer.ts:35-92` — apply mutations and emit one backup manifest
- `arcforge-app/app/core/forge/FileMutationLayer.ts:94-124` — rollback
- `arcforge-app/app/core/forge/FileMutationLayer.ts:126-188` — diffing and per-file confirm
- `arcforge-app/app/core/forge/FileMutationLayer.ts:193-260` — per-file rollback and mutation primitives

**What to port to EMA:**
The strongest operational pattern in Arcforge is not "generate boilerplate". It is:
- preview first
- apply through one service
- keep a recoverable backup ID
- support partial confirmation

That shape would strengthen any future EMA writeback/generation lane.

**Adaptation notes:**
- EMA should probably write backup metadata into a durable operational store, not only tempdir.
- The mutation primitives are file-level, not AST-aware. Good enough for scaffolding, weak for semantic refactors.

### Pattern 5: Pragmatic parser plugin for backend ecosystems

**Files:**
- `plugins/laravel/parser.js:19-100` — models, controllers, relationships, controller->model edges
- `plugins/laravel/parser.js:112-184` — collapse routes into route-group nodes and connect them to controllers
- `plugins/laravel/parser.js:186-238` — migrations, services, providers, jobs, events
- `plugins/laravel/parser.js:248-292` — open-file behavior and prompt export

**What to port to EMA:**
The Laravel parser is a useful reminder that a lot of graph value comes from:
- consistent filesystem conventions
- a few targeted regexes
- grouping noisy primitives into more intelligible nodes

EMA does not need perfect ASTs everywhere to deliver useful structure views.

**Adaptation notes:**
- This parser is intentionally heuristic.
- It works because Laravel is convention-heavy.
- EMA should treat this as a donor for "pragmatic extractor design", not as a language-analysis foundation.

## Gotchas found while reading

- `arcforge-app/app/core/config/adapters.ts:7` exports `ADAPTERS: FrameworkAdapter[] = [];` — the typed adapter registry exists, but the active ecosystem path is actually the manifest-plugin loader in `main.ts`.
- The plugin trust boundary is weak: README and code both permit full Node.js filesystem access for plugins.
- The "Arcspec" mode is JSON-graph backed, not a rich textual DSL despite the branding.
- The export path is intentionally simple prompt text, not a deeper semantic compiler.
- The safety story is operational rollback, not semantic correctness.

## Port recommendation

1. Port the **parser plugin seam**, but with a stronger trust model than arbitrary Node execution.
2. Port the **preview/apply/rollback** lifecycle for any future EMA mutation or scaffold layer.
3. Introduce a narrow **intentional architecture graph object** in EMA rather than relying only on prose intent + inferred code state.
4. Keep Arcforge's heuristics as inspiration for ecosystem-specific graph adapters, but do not adopt its file-level mutation primitives as the only write strategy.

## Related extractions

- `[[research/_extractions/iwe-org-iwe]]` — different graph donor: markdown/object-index rather than code graph IDE

## Connections

- `[[research/vapp-plugin/ysz7-Arcforge]]` — higher-level research node
- `[[research/_clones/INDEX]]`

#extraction #vapp-plugin #arcforge #graph-ide #architecture #forge
