# EMA Wiki Engine — Final Vision

**Date:** 2026-04-07
**Status:** Vision document (pre-implementation)

## What This Session Proved

We spent hours building a React wiki renderer. The result looked amateur next to Wikipedia. This drift is exactly what the intent schematic layer is for — detecting when implementation deviates from intent. The intent was "build a mature knowledge system." The implementation drifted to "build React components."

Lesson captured. Now the actual vision:

## The Single Idea

**The wiki is EMA's externalized state. The intent schematic is the human's control plane over that state.**

Not a documentation system. Not a knowledge base. Not a wiki renderer. It's the INTERFACE between the human's aspirations and EMA's operational reality.

### What happens when you edit the intent schematic:

```
Human edits intent "Actor Workspace" → sets status to "implementing"
  → Plans/specs linked to this intent UPDATE INSTANTLY (they're downstream of intent)
  → Tasks get created/reprioritized (execution system reacts)
  → Agents see new priority in their context (next dispatch uses updated intent)
  → BUT: knowledge pages DON'T change (research findings are facts, not aspirations)
  → BUT: code pages DON'T change (code only changes when agents actually write code)
  → WHEN agent completes work: knowledge/code pages update FROM results
  → THEN: intent schematic reflects the new factual state
```

This is the control flow:
```
Schematic (aspirational) ──writes──→ Plans, Specs, Priorities, Dispatch
                         ──reads───→ Knowledge, Code, Execution Status
                         
Knowledge (factual)      ──writes──→ Only from real work (execution results, research)
                         ──reads───→ Schematic reads it to show "what is true"
```

### What the wiki looks like:

Wikipedia. Not "inspired by" — actual MediaWiki-grade rendering. Stolen CSS, stolen typography, stolen layout patterns. Dark theme with EMA tokens, light theme for standalone browser. Every page is a wiki article with:

- **Infobox** (right-aligned structured data — status, type, progress, linked intent)
- **Table of contents** (auto-generated from headings)
- **Wikilinks** (clickable, typed: `[[depends-on::X]]`)
- **Categories** (from tags, auto-listed)
- **Talk page** (agent discussion, per-page)
- **Revision history** (from VaultWatcher change detection)

### What "4 layers" actually means:

Not content types. Not sections. Not tabs. **4 CAPABILITIES that a page can have:**

| Capability | What it means | What happens on render | Example page |
|-----------|---------------|----------------------|-------------|
| **Knowledge** | Page stores facts. Default for all pages. | Renders markdown. Shows backlinks, related pages. | "ProseMirror Research" |
| **Intent** | Page participates in the goal hierarchy. | Shows infobox with status/progress. Appears in schematic. Edits propagate to EMA. | "Actor Workspace" |
| **Code** | Page is linked to codebase modules. | Queries live code state. Shows module dependencies, line counts, recent changes. Replaces CodeGraphContext. | "Ema.Actors Module" |
| **Plan** | Page is a spec/roadmap. | Shows milestones, decisions, linked executions. Replaces superpowers specs/. | "Workspace Executive Planes Spec" |

Most pages: just Knowledge.
Intent pages: Knowledge + Intent.
Architecture pages: Knowledge + Code.
Spec pages: Knowledge + Plan + Intent.

A page gets capabilities from its frontmatter tags. No separate "layer" infrastructure needed — the capabilities are just which EMA systems the page queries on render.

### What "5 instances" actually means:

5 themed views of the SAME wiki data. Same pages, same graph, same capabilities. Different rendering context:

| Instance | Audience | Theme | Context depth |
|----------|----------|-------|--------------|
| **EMA App** | Human (desktop) | Glass morphism dark | Full interactive (edit, chat, dispatch) |
| **Browser** | Human (web) | Wikipedia light | Read/edit, no agent dispatch |
| **Agent** | AI agents | Structured JSON | Assembled context bundle, no rendering |
| **CLI** | Human (terminal) | Text/markdown | Search, browse, quick edits |
| **Export** | External | Static HTML/PDF | Shareable snapshot |

These aren't separate deployments. They're 5 rendering paths from the same vault data + DB state.

## Context Assembly Through Wiki

Currently, context assembly is scattered:
- ContextInjector fetches from 6 separate sources
- ContextBuilder reads from local files
- ContextAssembler does hot/warm/cold tiering
- Dispatcher layers 4 context blocks into the prompt
- Each source is a separate code path with separate failure modes

**After wiki integration:** Context assembly STARTS from the wiki page.

When dispatching an execution for intent "Actor Workspace":
1. Load the wiki page for "Actor Workspace" (has all context in human-readable form)
2. Follow its wikilinks to load related pages (depth controlled by context slider)
3. Load its Code capability data (live module state)
4. Load its Intent capability data (hierarchy, linked executions)
5. Assemble into prompt with token budgeting

The wiki page IS the context. Not a separate context assembly step — the page itself is what gets sent to the agent (trimmed to token budget).

## What We Actually Build

### Phase 1: Steal MediaWiki's Maturity (CSS + Rendering)
- Copy Vector 2022 LESS/CSS wholesale, adapt for dark theme
- Copy mw-parser-output content styles (article typography)
- Copy infobox, categories, TOC patterns as React components
- Install @wikimedia/codex-design-tokens for spacing/sizing
- Result: wiki pages that LOOK like Wikipedia, rendered from vault markdown

### Phase 2: Wire Capabilities Into Pages
- `intent` capability: queries DB intents, shows hierarchy infobox, edits propagate
- `code` capability: queries Superman/codebase, shows module state
- `plan` capability: queries execution system, shows milestone progress
- All triggered by frontmatter tags, no separate layer table needed

### Phase 3: Intent Schematic as Control Plane
- Schematic view: traverses all intent-capable pages, renders navigable hierarchy
- Edit propagation: change intent → plans update, tasks spawn, agents notified
- Read integration: schematic shows live state from Knowledge/Code/Plan pages
- This is the human's steering wheel

### Phase 4: Context Assembly Through Wiki
- Replace ContextInjector's separate fetches with "load wiki page + follow links"
- Token budgeting on assembled wiki content
- Agent dispatch reads wiki pages as primary context source

## What Gets Replaced

| Current System | Replaced By |
|---------------|-------------|
| `docs/superpowers/specs/` | Wiki pages with Plan capability |
| CodeGraphContext / Superman KnowledgeGraph | Wiki pages with Code capability |
| `.superman/intents/` intent definitions | Wiki pages with Intent capability |
| ContextInjector (6 separate sources) | Wiki page assembly with link traversal |
| ContextBuilder (file reads) | Wiki page content (already in vault) |
| Separate intent tree UI | Intent schematic (traversal of intent-capable wiki pages) |

## What Stays

| System | Why it stays |
|--------|-------------|
| `.superman/intents/<slug>/status.json` | Execution workspace state (mutable, fast-changing) |
| DB `intents` table | Queryable runtime index of intent-capable wiki pages |
| `intent_links` table | Bridges intents to operational records |
| VaultWatcher | Detects wiki page changes, triggers DB sync |
| Populator | Syncs wiki pages → DB intents |
| IntentProjector | Reverse sync DB → wiki pages |
| Execution Dispatcher | Still dispatches to Claude, but reads context from wiki |
| All operational tables | Tasks, executions, proposals, sessions — unchanged |

## Implementation Constraint

**Do not build a wiki engine. Make the vault LOOK like Wikipedia.**

The vault already exists (1,368 pages). VaultWatcher already indexes it. GraphBuilder already parses wikilinks. SecondBrain already does FTS. The wiki "engine" is just:
1. Better CSS (stolen from MediaWiki)
2. Better rendering (Tiptap for edit, react-markdown for read)
3. Capability queries (frontmatter tags → live data injection)
4. Control plane semantics (intent edits → EMA state changes)

Everything else is already built.
