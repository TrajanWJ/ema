# Wiki Engine Research — Open Source Landscape & Code Donors

**Date:** 2026-04-07
**Purpose:** Identify the best approach to building EMA's wiki engine by analyzing open source projects, code donors, cross-pollination opportunities, and implementation patterns.

---

## 1. Open Source Wiki Engines Analyzed

### Tier 1: Direct Code Donors (highest reuse potential)

#### Docmost — AGPL-3.0
- **GitHub:** https://github.com/docmost/docmost
- **Stack:** TypeScript monorepo (pnpm + Nx), React frontend, Node.js backend, Postgres, Redis
- **Editor:** Tiptap 3.17.1 with extensive extensions (diagrams, math, code blocks, comments)
- **Collaboration:** Yjs CRDTs for real-time sync, Hocuspocus WebSocket server
- **Comments:** Implemented as Tiptap marks with `Comment` extension — positions embedded in document, survive edits
- **Architecture:** `apps/client` + `apps/server` + `packages/ee` monorepo
- **Spaces → Pages** hierarchy (like our spaces → projects → wiki pages)
- **Content storage:** ProseMirror JSON (structure) + plain text (FTS) + Yjs binary (CRDT)
- **Why it matters for EMA:** Closest architecture to what we need. The Tiptap editor with Comment extension is exactly the inline highlighting/commenting system we want. The spaces/pages hierarchy maps to our wiki structure. AGPL means we can study the patterns.
- **What to adopt:** Editor extension patterns, comment mark architecture, content storage triple (JSON + text + collab state)

#### Outline — BSL-1.1
- **GitHub:** https://github.com/outline/outline
- **Stack:** React + TypeScript, Node.js, Sequelize, Postgres, Redis
- **Editor:** Prosemirror-based rich-markdown-editor (custom)
- **Collections → Documents** hierarchy with real-time collaborative editing
- **Plugin system** in `plugins/` directory
- **API:** Full REST + WebSocket for real-time
- **Why it matters for EMA:** Proven React wiki with plugin architecture. The collection/document model maps to our wiki sections. BSL license means study-only.
- **What to adopt:** Plugin architecture pattern, collection/navigation structure, API design

#### SilverBullet — MIT
- **GitHub:** https://github.com/silverbulletmd/silverbullet
- **Stack:** TypeScript frontend (CodeMirror 6 + Preact), Go backend
- **Key innovation:** "Programmable" wiki — Lua scripting embedded in pages
- **Plug system:** TypeScript modules compiled to WASM, extend via syscalls
- **Space model:** Pages as markdown with bidirectional [[wikilinks]]
- **Inline queries:** Database-like filtering rendered inline in markdown
- **Why it matters for EMA:** The "objects + queries" pattern is powerful — structured data WITHIN markdown pages. The plug system shows how to make a wiki extensible without modifying core.
- **What to adopt:** Objects-in-markdown pattern, query system concept, plug architecture

### Tier 2: Component Donors (specific features to extract)

#### Tiptap Comment Extension — MIT
- **GitHub:** https://github.com/sereneinserenade/tiptap-comment-extension-react
- **Implementation:** Comment as Tiptap Mark with `data-comment` attribute storing JSON `{uuid, comments: [{userName, time, content}]}`
- **Commands:** `setComment(id)`, `toggleComment()`, `unsetComment()`
- **Extraction:** `editor.state.doc.descendants()` traversal finds all comment marks with positions
- **Key pattern:** Comments embedded in document structure (not external annotations) — survive copy/paste, collaborative edits
- **Why it matters:** This IS the inline commenting/highlighting implementation. Drop-in for our wiki editor.
- **What to adopt:** The entire Comment mark extension pattern

#### BlockNote — MPL-2.0
- **GitHub:** https://github.com/TypeCellOS/BlockNote
- **Stack:** React + Tiptap/ProseMirror wrapper
- **Slash commands**, drag-and-drop blocks, nesting
- **Why it matters:** Block-based editing within wiki pages. Slash commands for inserting structured content.
- **What to adopt:** Slash command pattern, block type system for wiki content types

#### remark-wiki-link — MIT
- **GitHub:** https://github.com/landakram/remark-wiki-link
- **Also:** @flowershow/remark-wiki-link (Obsidian-style path matching)
- **What it does:** Parses `[[wikilinks]]` in remark/unified pipeline, generates `wikiLink` AST nodes
- **Configurable:** Custom page resolvers for computing hrefs, can detect if linked pages exist
- **Why it matters:** Plugs directly into our react-markdown (remark) pipeline for wikilink rendering
- **What to adopt:** The remark plugin for read-mode wikilink rendering

#### Quartz — MIT
- **GitHub:** https://github.com/jackyzha0/quartz
- **Build pipeline:** remark-parse → remark transformers → remark-rehype → rehype transformers → Preact JSX → HTML
- **Features:** Wikilinks, backlinks, graph view, transclusion, full-text search, popover previews
- **Why it matters:** The complete remark/rehype plugin chain for wiki features is already built. Graph view component exists.
- **What to adopt:** Plugin chain for wikilinks/backlinks/graph, transclusion pattern

#### Wikimedia Codex Design Tokens — MIT
- **npm:** `@wikimedia/codex-design-tokens`
- **Install:** `npm install @wikimedia/codex-design-tokens`
- **Formats:** CSS custom properties, Less, SCSS, ES6, JSON
- **Dark mode:** `theme-wikimedia-ui-mode-dark.css` — automatic dark mode via `prefers-color-scheme`
- **Token naming:** `--background-color-interactive`, `--spacing-100`, `--size-icon-medium`
- **Why it matters:** Wikipedia's ACTUAL design tokens as an npm package. We can import these for authentic Wikipedia typography/spacing and override colors with EMA's palette.
- **What to adopt:** Typography tokens (font family, sizes, line heights), spacing scale, layout breakpoints. Override colors with EMA's glass morphism palette.

### Tier 3: Architectural Inspiration (patterns to learn from)

#### AFFiNE — MIT (partial)
- **GitHub:** https://github.com/toeverything/AFFiNE
- **Key innovation:** BlockSuite engine — docs and whiteboard merged, any block on edgeless canvas
- **OctoBase:** Rust CRDT engine for local-first collaboration
- **Why relevant:** Shows how to merge document editing with canvas/spatial views — relevant for our intent schematic visualization
- **Pattern to learn:** Block-based content model where blocks are renderable in both document and spatial views

#### Foam — MIT
- **GitHub:** https://github.com/foambubble/foam
- **Key innovation:** Wikilinks, backlinks, graph visualization as VS Code extensions
- **Pattern:** Personal knowledge graph on plain markdown files with zero lock-in
- **Why relevant:** Validates that [[wikilinks]] + backlinks + graph is the right navigation model for personal wiki

#### MediaWiki Vector 2022
- **GitHub mirror:** https://github.com/wikimedia/mediawiki-skins-Vector
- **Layout:** Header → sidebar (collapsible) → content (max-width) → TOC (pinned) → footer
- **CSS:** Less-based, 20.7% of codebase
- **Feature flags:** CSS classes toggle layout behaviors (limited-width, pinned TOC, sticky header)
- **Why relevant:** The actual Wikipedia layout structure to replicate
- **Pattern to learn:** Content region sizing, sidebar behavior, TOC positioning

---

## 2. Recommended Architecture

### Editor: Tiptap (not react-markdown)

**Decision:** Switch from react-markdown (read-only renderer) to **Tiptap** (read-write editor) as the primary wiki page component.

**Why:**
- react-markdown is read-only — can't do inline editing, highlighting, or commenting
- Tiptap is ProseMirror-based — battle-tested, extensible, supports marks (comments), collaborative editing
- Docmost, Outline, and the comment extension all prove Tiptap works for wiki editing
- Tiptap has read-only mode — can serve as both viewer AND editor (toggle via `editable` prop)
- Already has React bindings (`@tiptap/react`)

**Read mode:** Tiptap with `editable: false` — renders rich content with clickable wikilinks, visible highlights
**Edit mode:** Tiptap with `editable: true` — full editing with slash commands, formatting toolbar
**Comment mode:** Tiptap Comment mark extension — select text, annotate, persist as marks

### Content Model: Markdown on disk, ProseMirror JSON in editor

```
Disk (canonical):     vault/wiki/Page.md  (markdown + YAML frontmatter)
Editor (runtime):     ProseMirror document (parsed from markdown on load)
Save:                 Serialize ProseMirror → markdown → write to disk
Comments:             Stored as marks in ProseMirror doc → serialized to markdown comments
                      OR stored as entity_data keyed by document position
```

### Layout: Wikipedia Vector 2022 with EMA tokens

```
Wikipedia layout regions → EMA implementation:
┌──────────────────────────────────────────────────────┐
│ Header (sticky)           Wikipedia: .vector-header  │
│ EMA: glass-surface, 48px, search + tabs              │
├──────────┬───────────────────────┬───────────────────┤
│ Sidebar  │ Content (max-800px)   │ TOC / Talk        │
│ (260px)  │                       │ (280px)           │
│ collaps. │ Wikipedia: .mw-body   │                   │
│          │ EMA: glass-ambient bg │                   │
│ Nav tree │                       │ Auto-generated    │
│ Metadata │ Article typography    │ from headings     │
│ Layers   │ Wikilink rendering    │ OR agent chat     │
│          │ Comment highlights    │                   │
├──────────┴───────────────────────┴───────────────────┤
│ Footer: categories, last edited, related             │
│ Wikipedia: .mw-footer                                │
│ EMA: border-top, pn-text-muted                       │
└──────────────────────────────────────────────────────┘
```

### Design Token Strategy: Wikimedia Codex + EMA override

```css
/* Base: Wikipedia's actual typography and spacing */
@import '@wikimedia/codex-design-tokens/theme-wikimedia-ui.css';

/* Override: EMA's dark glass morphism palette */
:root {
  /* Map Codex tokens to EMA values */
  --background-color-base: var(--color-pn-base);        /* #08090E instead of #fff */
  --color-base: var(--pn-text-primary);                  /* rgba(255,255,255,0.87) */
  --color-subtle: var(--pn-text-secondary);              /* rgba(255,255,255,0.60) */
  --border-color-base: var(--pn-border-default);         /* rgba(255,255,255,0.08) */
  --color-progressive: #a78bfa;                          /* EMA purple instead of Wikimedia blue */
  
  /* Keep Wikipedia's typography tokens unchanged */
  /* --font-family-system-sans, --font-size-*, --line-height-* stay as-is */
}
```

This gives us Wikipedia's EXACT typography, spacing, and layout math — with EMA's color palette.

---

## 3. Cross-Pollination Opportunities

### Direct code adoption (copy + adapt)

| Source | What | License | Effort |
|--------|------|---------|--------|
| `tiptap-comment-extension-react` | Comment mark extension for inline annotations | MIT | 2h (drop-in) |
| `remark-wiki-link` | Wikilink parsing for read-only renderer fallback | MIT | 1h (npm install) |
| `@wikimedia/codex-design-tokens` | Wikipedia typography + spacing tokens | MIT | 1h (npm install + CSS override) |
| Quartz plugin chain | Remark/rehype plugins for backlinks, graph | MIT | 4h (extract + adapt) |
| Docmost Comment extension | Production-grade Tiptap comment with Yjs collab | AGPL | Study pattern, reimplement |

### Pattern adoption (learn + build)

| Source | Pattern | EMA Application |
|--------|---------|-----------------|
| Docmost | Content storage triple (JSON + text + collab) | Store wiki pages as markdown on disk + FTS in DB + optional Yjs |
| SilverBullet | Objects-in-markdown + inline queries | Layer metadata as frontmatter, query across pages |
| AFFiNE/BlockSuite | Blocks renderable in doc + canvas views | Intent schematic as both wiki article AND visual graph |
| MediaWiki Vector 2022 | Sidebar + content + TOC 3-column layout | Direct layout replication with EMA tokens |
| Foam | Backlinks panel + graph visualization | Bottom-of-page backlinks + graph view tab |

---

## 4. Implementation Dependencies

### npm packages to add

```bash
# Editor (replaces react-markdown for wiki pages)
npm install @tiptap/react @tiptap/starter-kit @tiptap/pm
npm install @tiptap/extension-link @tiptap/extension-placeholder
npm install @tiptap/extension-highlight @tiptap/extension-code-block-lowlight

# Wikipedia design tokens
npm install @wikimedia/codex-design-tokens

# Wikilink support (for markdown parsing/serialization)
npm install remark-wiki-link

# Syntax highlighting
npm install lowlight

# Markdown serialization (ProseMirror ↔ Markdown)
npm install tiptap-markdown
```

### Keep existing

```
react-markdown + remark-gfm  — fallback for simple read-only rendering (non-wiki pages)
```

---

## 5. Risk Analysis

| Risk | Mitigation |
|------|-----------|
| Tiptap complexity vs react-markdown simplicity | Start with Tiptap in read-only mode, enable editing incrementally |
| Comment mark persistence across markdown roundtrips | Store comments as entity_data (EMA's existing system) keyed by content hash + offset, not embedded in markdown |
| Wikipedia token conflicts with EMA glass theme | Override only color tokens, keep typography/spacing unchanged |
| Scope creep into full Notion/Confluence clone | Hard constraint: markdown on disk is canonical. No proprietary format. |
| Performance with large wiki (1000+ pages) | VaultWatcher already handles this. Tiptap loads one page at a time. |

---

## 6. Recommended Build Order

### Sprint 1: Foundation (Tiptap + Wikipedia layout)
1. Install Tiptap + Codex design tokens
2. Build WikiEngine component with Vector 2022 layout (3-column)
3. Tiptap in read-only mode rendering wiki markdown
4. Wikilink click navigation
5. Auto-generated TOC from headings
6. Layer tabs from frontmatter

### Sprint 2: Editing + Comments
7. Tiptap edit mode toggle
8. Comment mark extension (from tiptap-comment-extension-react)
9. Highlight rendering in read mode
10. Comment sidebar panel
11. Save: serialize ProseMirror → markdown → vault write

### Sprint 3: Agent Integration
12. Talk page / agent chat sidebar
13. Context slider (query parameter for surrounding page depth)
14. Agent can edit wiki pages via MCP
15. Backlinks panel (from vault_links graph)

### Sprint 4: Graph + Advanced
16. Graph view component (from existing VaultGraph)
17. Transclusion rendering (`{{:Page}}` syntax)
18. Categories footer (from frontmatter tags)
19. Recent changes feed (from VaultWatcher events)
20. Search with FTS5 highlighting

---

## 7. Interactive Elements & Visual Assets (Round 2 Research)

### Intent Schematic Interactivity (from codebase-to-course patterns)

**Source:** [codebase-to-course](https://github.com/zarazhangrui/codebase-to-course)

Key patterns to adopt for intent schematic pages:

| Pattern | Source | EMA Application |
|---------|--------|-----------------|
| **Embedded quizzes** | codebase-to-course | Intent review questions: "What would completing this intent unblock?" "Which children are blocked?" — tests understanding of schematic |
| **Scroll-based progression** | codebase-to-course | Intent pages reveal context progressively: status → description → children → history → agent notes |
| **Code-explanation pairs** | codebase-to-course | Side-by-side: code architecture (left) + intent description (right) for Code layer pages |
| **Glossary tooltips** | codebase-to-course | Hover over wikilinks to see page summary + status without navigating away |
| **Animated state diagrams** | codebase-to-course | Intent status flow visualization: planned → active → implementing → complete |

### Code Hike Patterns (annotations as React components)

**Source:** [Code Hike](https://codehike.org/) — MIT

Key adoption points:
- **Annotations as React components** — code comments like `// !highlight` become interactive overlays. Apply to wiki: frontmatter flags trigger visual annotations on page sections.
- **Scrollytelling layouts** — content steps tied to scroll position. For intent pages: scroll through the intent hierarchy, each level expands with context.
- **MDX plugin architecture** — `remarkCodeHike` + `recmaCodeHike` transform markdown into structured objects accessed as React components. EMA could use similar plugins to transform intent frontmatter into interactive widgets.

### Diagram & Visualization Components

| Component | Source | License | What it provides |
|-----------|--------|---------|-----------------|
| **Mermaid React** | [mermaid-graph (npm)](https://www.npmjs.com/package/mermaid-graph) | MIT | Clickable flowcharts/sequence diagrams from markdown. Nodes navigate to wiki pages. |
| **react-force-graph** | [vasturiano/react-force-graph](https://github.com/vasturiano/react-force-graph) | MIT | 2D/3D force-directed graph. Click nodes to navigate. Used for intent/knowledge graphs. |
| **Excalidraw** | [@excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | MIT | Embeddable whiteboard React component. Hand-drawn diagrams inline in wiki pages. |
| **Markmap** | [markmap.js.org](https://markmap.js.org/) | MIT | Markdown headings → interactive mind map. Intent hierarchy as expandable tree diagram. |

### Annotation & Highlighting Systems

| System | Source | License | Approach |
|--------|--------|---------|----------|
| **Hypothesis** | [hypothesis/client](https://github.com/hypothesis/client) | BSD-2 | Web annotation overlay — select text → annotate → shared layer. Works on any webpage. Could be embedded in wiki renderer. |
| **Tiptap Comment marks** | [tiptap-comment-extension](https://github.com/sereneinserenade/tiptap-comment-extension-react) | MIT | Comments stored as ProseMirror marks in document. Survive edits. Best for edit-mode annotations. |
| **ProseMirror mark-based highlights** | [Collaborne article](https://medium.com/collaborne-engineering/prosemirror-highlights-comments-20ce820149ed) | N/A | Hybrid: positions in document (marks), metadata in database. Best for collaborative annotation. |

### Structured Content Frameworks

| Framework | Source | What it provides for EMA |
|-----------|--------|------------------------|
| **Markdoc** | [markdoc.dev](https://markdoc.dev/) — MIT | Custom tags in markdown: `{% callout %}`, `{% tabs %}`, `{% if %}`. Could power intent layer toggles, conditional content by role, expandable sections. |
| **MyST Markdown** | [mystmd.org](https://mystmd.org/) | Roles and directives extending markdown: `{note}`, `{warning}`, `{figure}`. Academic-grade structured content. React rendering pipeline. |
| **Code Hike** | [codehike.org](https://codehike.org/) — MIT | Annotations as React components. MDX transform pipeline. Scrollytelling. Best for the Code layer. |

### Intent Schematic Questions (Superpowers Integration)

For the intent schematic layer, adopt the codebase-to-course quiz pattern:

```markdown
<!-- Embedded in intent wiki page -->
{% quiz %}
question: "What would completing Actor Workspace unblock?"
options:
  - "Frontend actor toggle" (correct)
  - "Proposal pipeline"
  - "Bridge functions"
hint: "Check the Children section — which intents depend on this one?"
{% /quiz %}

{% quiz %}
question: "Which agent should execute the next phase?"
options:
  - "agent:coder" (correct, based on current assignment)
  - "agent:researcher"
  - "agent:strategist"
context: "Check entity_data sprint_week assignment"
{% /quiz %}
```

These questions serve dual purposes:
1. **For human:** Tests understanding of the intent hierarchy and what matters
2. **For agent:** Prompts for self-evaluation — "should I continue on this intent or escalate?"

---

## 8. Updated Code Donor Summary

### Tier 1: Core (build on these)
| Project | What | License |
|---------|------|---------|
| Tiptap + Comment Extension | Wiki editor with inline annotations | MIT |
| @wikimedia/codex-design-tokens | Wikipedia typography/spacing | MIT |
| remark-wiki-link | Wikilink parsing | MIT |

### Tier 2: Interactive Enrichment (adopt patterns)
| Project | What | License |
|---------|------|---------|
| Code Hike | Annotations as React components, scrollytelling | MIT |
| codebase-to-course | Quiz patterns, scroll progression, tooltips | MIT |
| Markdoc | Custom markdown tags (callouts, tabs, conditionals) | MIT |
| Excalidraw | Embeddable whiteboard for diagrams | MIT |
| react-force-graph | Knowledge graph visualization | MIT |
| Markmap | Markdown → mind map visualization | MIT |
| Mermaid React | Interactive diagrams from markdown | MIT |

### Tier 3: Study (architectural patterns)
| Project | What | License |
|---------|------|---------|
| Docmost | Tiptap editor + Yjs collab + spaces | AGPL |
| Outline | Plugin architecture, collections | BSL |
| SilverBullet | Objects-in-markdown, inline queries | MIT |
| Hypothesis | Web annotation overlay system | BSD-2 |
| MyST Markdown | Roles/directives, React rendering | MIT |
| DeepWiki | AI-generated interactive documentation from code | Proprietary (study) |
| Quartz | remark/rehype plugin chain for wiki features | MIT |

---

## Sources

- [Docmost (GitHub)](https://github.com/docmost/docmost) — AGPL-3.0, Tiptap wiki
- [Docmost Architecture (DeepWiki)](https://deepwiki.com/docmost/docmost) — Implementation detail
- [Outline (GitHub)](https://github.com/outline/outline) — BSL-1.1, React wiki
- [SilverBullet (GitHub)](https://github.com/silverbulletmd/silverbullet) — MIT, programmable wiki
- [Tiptap Comment Extension React](https://github.com/sereneinserenade/tiptap-comment-extension-react) — MIT
- [Tiptap Commenting Tutorial](https://dev.to/sereneinserenade/how-i-implemented-google-docs-like-commenting-in-tiptap-k2k)
- [ProseMirror Highlights & Comments](https://medium.com/collaborne-engineering/prosemirror-highlights-comments-20ce820149ed)
- [BlockNote (GitHub)](https://github.com/TypeCellOS/BlockNote) — MPL-2.0, block editor
- [Quartz (GitHub)](https://github.com/jackyzha0/quartz) — MIT, static wiki
- [Quartz Architecture](https://quartz.jzhao.xyz/advanced/architecture)
- [remark-wiki-link](https://github.com/landakram/remark-wiki-link) — MIT, wikilink parser
- [@flowershow/remark-wiki-link](https://github.com/flowershow/remark-wiki-link) — Obsidian-style matching
- [Wikimedia Codex Design Tokens](https://doc.wikimedia.org/codex/latest/design-tokens/overview.html)
- [@wikimedia/codex-design-tokens (npm)](https://www.npmjs.com/package/@wikimedia/codex-design-tokens)
- [MediaWiki Vector 2022 Skin](https://www.mediawiki.org/wiki/Skin:Vector)
- [Vector Skin Source (GitHub)](https://github.com/wikimedia/mediawiki-skins-Vector)
- [AFFiNE (GitHub)](https://github.com/toeverything/AFFiNE) — BlockSuite + OctoBase
- [Foam (GitHub)](https://github.com/foambubble/foam) — VS Code wiki
- [Wiki.js](https://js.wiki/) — Node.js wiki (v3 in alpha)
- [Yoopta Editor](https://github.com/yoopta-editor/Yoopta-Editor) — Notion-style block editor
- [Markdoc](https://markdoc.dev/docs/overview) — Stripe's structured markdown
- [awesome-selfhosted Wikis](https://awesome-selfhosted.net/tags/wikis.html)
- [codebase-to-course (GitHub)](https://github.com/zarazhangrui/codebase-to-course) — Interactive HTML courses from codebases
- [Code Hike](https://codehike.org/) — MIT, annotations as React components
- [Code Hike (GitHub)](https://github.com/code-hike/codehike) — MDX plugin for interactive code docs
- [DeepWiki](https://deepwiki.com) — AI-generated interactive code documentation
- [Excalidraw (GitHub)](https://github.com/excalidraw/excalidraw) — MIT, embeddable React whiteboard
- [react-force-graph (GitHub)](https://github.com/vasturiano/react-force-graph) — MIT, 2D/3D force graph
- [Markmap](https://markmap.js.org/) — MIT, markdown to mind map
- [Mermaid React (npm)](https://www.npmjs.com/package/mermaid-graph) — MIT, interactive diagrams
- [Hypothesis Client (GitHub)](https://github.com/hypothesis/client) — BSD-2, web annotation overlay
- [Markdoc](https://markdoc.dev/) — MIT, custom tags in markdown (Stripe)
- [MyST Markdown](https://mystmd.org/) — Roles and directives, React rendering
- [Tiptap Commenting Tutorial](https://dev.to/sereneinserenade/how-i-implemented-google-docs-like-commenting-in-tiptap-k2k) — Mark-based implementation
- [Wikimedia Codex Design Tokens (npm)](https://www.npmjs.com/package/@wikimedia/codex-design-tokens) — MIT
- [MediaWiki Dark Mode](https://www.mediawiki.org/wiki/Manual:Dark_mode) — CSS custom properties approach
- [MediaWiki Typography Update](https://www.mediawiki.org/wiki/Typography_Update) — Font decisions
