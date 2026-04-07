# UI Cross-Pollination Research: EMA's 30 Kept Apps

> Research date: 2026-04-07
> Purpose: Identify best MIT/Apache/BSD React/TypeScript open source projects to donate code, UX patterns, and npm packages to each of EMA's 30 consolidated apps.

---

## Table of Contents

- [Layer 1: Direct Code Donors (30 Apps)](#layer-1-direct-code-donors)
  - [Core Apps](#core-apps)
  - [Planning Apps](#planning-apps)
  - [Knowledge Apps](#knowledge-apps)
  - [Agent Apps](#agent-apps)
  - [Workspace Apps](#workspace-apps)
  - [Creative Apps](#creative-apps)
  - [Life Apps](#life-apps)
  - [System Apps](#system-apps)
- [Layer 2: Executive Management / Planning Tools](#layer-2-executive-management--planning-tools)
  - [Executive Functioning / ADHD Productivity](#executive-functioning--adhd-productivity)
  - [Goal Frameworks & OKR](#goal-frameworks--okr)
  - [Sprint Planning UIs](#sprint-planning-uis)
  - [Decision Frameworks](#decision-frameworks)
  - [Agent Orchestration Dashboards](#agent-orchestration-dashboards)
- [Package Summary Table](#package-summary-table)

---

## Layer 1: Direct Code Donors

### Core Apps

---

#### 1. Brain Dump (Quick Capture Inbox)

**Primary Donor: TakeNote**
- **URL:** https://github.com/taniarascia/takenote
- **License:** MIT
- **Stars:** ~8k
- **Stack:** React, TypeScript (strict, no implicit any), Redux, CodeMirror, Webpack, Jest
- **What to extract:**
  - IDE-style note capture UI with keyboard shortcuts (Mousetrap integration)
  - Markdown preview pane with live rendering
  - Local storage persistence pattern (notes stored client-side, downloadable as zip)
  - Category/tag sidebar navigation
  - Keyboard-first interaction model (Ctrl+N new note, Ctrl+S save, etc.)
- **npm packages:** `mousetrap` (keyboard shortcuts), `codemirror` (editor), `react-markdown`

**Secondary Donor: BlockNote**
- **URL:** https://github.com/TypeCellOS/BlockNote
- **License:** MPL-2.0 (free for commercial use, changes to source must be published)
- **Stars:** ~8k
- **What to extract:**
  - Notion-style block-based editor for rich quick capture
  - Slash command menu for block type selection
  - Drag-and-drop block reordering
- **npm packages:** `@blocknote/react`, `@blocknote/core`

---

#### 2. Tasks (Board/List Views)

**Primary Donor: react-kanban-kit**
- **URL:** https://github.com/braiekhazem/react-kanban-kit
- **License:** MIT
- **Stack:** TypeScript, React, Atlassian's pragmatic-drag-and-drop
- **What to extract:**
  - Full kanban board component with card/column drag-and-drop
  - Responsive design (desktop/tablet/mobile)
  - Virtual scrolling for large datasets
  - Skeleton loading states
  - View-only mode toggle
- **npm packages:** `react-kanban-kit`, `@atlaskit/pragmatic-drag-and-drop`

**Secondary Donor: Plane (UX reference, not code -- AGPL)**
- **URL:** https://github.com/makeplane/plane
- **Stars:** ~47k
- **License:** AGPL-3.0 (do NOT copy code; UX reference only)
- **What to steal (patterns, not code):**
  - Board/list/calendar/spreadsheet view switcher UX
  - Inline editing of task properties
  - Filter/group/sort toolbar pattern
  - Sub-issue nesting
  - Cycle (sprint) and module grouping

**Drag-and-drop foundation:**
- **@dnd-kit/react** -- https://github.com/clauderic/dnd-kit -- MIT, actively maintained, sortable presets
- **npm:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

---

#### 3. Projects (Project Management)

**Primary Donor: Plane (UX reference only -- AGPL)**
- **URL:** https://github.com/makeplane/plane
- **Stars:** ~47k
- **License:** AGPL-3.0 (pattern reference only)
- **What to steal (UX patterns):**
  - Project sidebar with icon + color coding
  - Project settings panel with member management
  - Project-level views (issues, cycles, modules, pages)
  - Breadcrumb navigation pattern

**Code donor for project cards/grids: react-beautiful-dnd patterns via dnd-kit**
- Reuse the kanban infrastructure from Tasks app
- Add project-level filtering and dashboard summary cards

**npm packages:** `recharts` (project analytics charts), `@dnd-kit/core`

---

#### 4. Executions (Live Agent Dispatch Timeline)

**Primary Donor: react-chrono**
- **URL:** https://github.com/prabhuignoto/react-chrono
- **License:** MIT
- **Stars:** ~4k
- **Stack:** TypeScript, zero dependencies, Vanilla Extract
- **What to extract:**
  - Vertical/horizontal timeline rendering modes
  - Rich media support per timeline item
  - Slideshow mode for execution replay
  - Search and keyboard navigation
  - Mobile-first responsive design
- **npm packages:** `react-chrono`

**Secondary Donor: AgentNeo (dashboard patterns)**
- **URL:** https://github.com/raga-ai-hub/agentneo
- **Stars:** ~1k
- **License:** Check repo (likely MIT)
- **What to extract:**
  - Execution graph view (DAG of agent steps)
  - Timeline + trace waterfall for LLM calls
  - Tool call tracing visualization
  - Token usage per-step breakdown
- **Note:** Python SDK with React dashboard -- extract the React dashboard component patterns

---

#### 5. Intent Map (Hierarchical L0-L5 Intent Tree)

**Primary Donor: react-d3-tree**
- **URL:** https://github.com/bkrem/react-d3-tree
- **License:** MIT
- **Stars:** ~1.1k
- **npm downloads:** ~208k/week
- **What to extract:**
  - Interactive hierarchical tree with collapse/expand
  - Customizable node rendering (React components as nodes)
  - Diagonal/straight/elbow/step path options
  - CSS class names for root/branch/leaf styling
  - Zoom and pan support
- **npm packages:** `react-d3-tree`

**Secondary Donor: Shadcn Tree View**
- **URL:** https://www.shadcn.io/template/mrlightful-shadcn-tree-view
- **License:** MIT (shadcn components)
- **What to extract:**
  - Collapsible tree with custom icons and action buttons
  - Drag-and-drop tree reordering
  - Disabled state handling
  - Tailwind CSS + shadcn/ui styling (aligns with glass morphism adaptation)
- **npm packages:** Shadcn tree view component (copy-paste, not npm install)

**Alternative: @naisutech/react-tree**
- **URL:** https://github.com/naisutech/react-tree
- **License:** MIT
- **Stack:** TypeScript-native
- **What to extract:** Simpler tree view with full TS type exports

---

#### 6. Dispatch Board (Agent Queue Metrics)

**Primary Donor: Mission Control (builderz-labs)**
- **URL:** https://github.com/builderz-labs/mission-control
- **License:** MIT
- **Stars:** ~3.8k
- **Stack:** Next.js 16, React 19, TypeScript 5.7 (strict), Zustand 5, SQLite, Recharts 3
- **What to extract:**
  - Agent fleet grid with status indicators (idle/working/error/offline)
  - Task dispatch queue with priority ordering
  - Cost tracking dashboard (token usage, spend per agent)
  - Real-time WebSocket + SSE push updates
  - Trust scoring and security audit panels
  - Cron-based task scheduling UI
- **npm packages:** `recharts` (charts), `better-sqlite3` (already using ecto_sqlite3)

**This is the single best donor for EMA's agent-facing UIs.** The stack alignment is near-perfect: React 19, TypeScript strict, Zustand, SQLite.

---

### Planning Apps

---

#### 7. Goals (Hierarchical, Weekly/Monthly/Quarterly)

**Primary Donor: OKR Tracker (Oslo Kommune)**
- **URL:** https://github.com/oslokommune/okr-tracker
- **License:** MIT
- **Stack:** Vue.js + Firebase (extract patterns, not code directly)
- **What to steal:**
  - Nested objective > key result > initiative hierarchy
  - Progress bar with confidence scoring
  - Period filtering (quarterly cadence)
  - Dashboard rollup of goal health

**Component donor: OKRLinkhub UI Kit**
- **URL:** https://github.com/okrlinkhub/linkhub-ui-kit
- **License:** Check repo
- **Stack:** React + TypeScript
- **What to extract:**
  - React components for displaying OKR data (Objectives, Key Results, Risks, Initiatives)
  - Hierarchical data selection components
  - Pagination and search for goal lists

**npm packages:** `recharts` (progress charts), `react-circular-progressbar` (goal completion rings)

---

#### 8. Proposals (AI-Generated Ideas for Review)

**Primary Donor: Langfuse (prompt management UI patterns)**
- **URL:** https://github.com/langfuse/langfuse
- **License:** MIT
- **Stars:** ~19k
- **What to extract:**
  - Prompt versioning UI (proposals are versioned AI outputs)
  - Side-by-side comparison view for refine/debate stages
  - Scoring/evaluation display (confidence scores)
  - Dataset/run management patterns
  - Trace waterfall for multi-step pipelines (Generator > Refiner > Debater > Tagger)
- **npm packages:** Review Langfuse's UI components for trace visualization

**UX patterns from Agenta:**
- **URL:** https://github.com/Agenta-AI/agenta
- **License:** Apache-2.0
- **Stars:** ~1.5k
- **What to steal:**
  - Prompt playground with model comparison
  - A/B testing UI for prompt variants
  - Evaluation results table with metrics

---

#### 9. Decision Log (ADR-Style Decisions)

**Primary Donor: Log4brains**
- **URL:** https://github.com/thomvaill/log4brains
- **License:** Apache-2.0
- **Stars:** ~1.1k
- **Stack:** Next.js (static site generation), TypeScript
- **What to extract:**
  - ADR list view with status badges (proposed/accepted/deprecated/superseded)
  - ADR detail view with structured sections (Context, Decision, Consequences)
  - Search and filtering by status/date
  - Timeline of decisions
  - Markdown rendering for decision content
- **npm packages:** `react-markdown`, `remark-gfm`

**Template reference: MADR (Markdown Architectural Decision Records)**
- **URL:** https://github.com/adr/madr
- **License:** MIT
- **What to extract:** Decision template structure (Title, Status, Context, Decision, Consequences)

---

### Knowledge Apps

---

#### 10. Vault (Markdown Wiki)

**Primary Donor: MDXEditor**
- **URL:** https://github.com/mdx-editor/editor
- **License:** MIT
- **Stars:** ~3k
- **npm downloads:** ~181k/week
- **What to extract:**
  - WYSIWYG markdown editing (Google Docs-like feel)
  - Tables, images, code blocks with syntax highlighting
  - JSX component embedding
  - Toolbar with formatting controls
  - Dark mode support
- **npm packages:** `@mdxeditor/editor`

**Secondary Donor: Outline's rich-markdown-editor**
- **URL:** https://github.com/outline/rich-markdown-editor
- **License:** BSD-3-Clause
- **What to extract:**
  - Prosemirror-based editor that powers Outline wiki
  - Slash commands for block insertion
  - Inline markdown shortcuts
  - Embed support (images, videos, links)

**Alternative: @uiwjs/react-md-editor**
- **URL:** https://github.com/uiwjs/react-md-editor
- **License:** MIT
- **Stars:** ~2k
- **What to extract:** Simpler split-pane markdown editor with preview

---

#### 11. Wiki (Wikipedia-Style)

**Primary Donor: Outline (UX reference -- BSL license)**
- **URL:** https://github.com/outline/outline
- **Stars:** ~30k
- **License:** BSL (Business Source License) -- reference UX only, do not copy code
- **What to steal (UX patterns):**
  - Collection-based navigation sidebar
  - Document tree with nested pages
  - Breadcrumb trail for hierarchy
  - Full-text search with highlighting
  - Real-time collaborative editing indicators
  - Backlink display (pages linking to this page)

**For wiki-link rendering:** Parse `[[wikilinks]]` from markdown using remark plugins
- **npm packages:** `remark-wiki-link`, `@mdxeditor/editor`

---

#### 12. Knowledge Graph (Force-Directed Graph)

**Primary Donor: react-force-graph**
- **URL:** https://github.com/vasturiano/react-force-graph
- **License:** MIT
- **Stars:** ~2.4k
- **npm downloads:** ~250k/week (react-force-graph-2d)
- **What to extract:**
  - 2D and 3D force-directed graph rendering
  - Node hover/click interactions
  - Zoom, pan, node dragging
  - Custom node/link rendering
  - Canvas/WebGL rendering for performance
- **npm packages:** `react-force-graph-2d` (primary), `react-force-graph-3d` (optional)

**Alternative: Reagraph**
- **URL:** https://github.com/reaviz/reagraph
- **License:** Apache-2.0
- **Stars:** ~1k
- **What to extract:**
  - WebGL-based graph visualization (better for large graphs)
  - Built-in 2D/3D layouts
  - Clustering, automatic node sizing
  - Context menus on nodes
  - Edge bundling
- **npm packages:** `reagraph`

**Recommendation:** Start with `react-force-graph-2d` for simplicity and broad adoption, switch to `reagraph` if performance becomes an issue with large vault graphs.

---

### Agent Apps

---

#### 13. Agents (Agent Roster/Config)

**Primary Donor: Mission Control (builderz-labs)**
- **URL:** https://github.com/builderz-labs/mission-control
- **License:** MIT
- **Stars:** ~3.8k
- **What to extract:**
  - Agent card grid with status indicators (health, last active, model)
  - Agent detail panel with configuration editing
  - Capability/skill tagging system
  - Agent logs viewer with filtering
  - Multi-gateway connection management
  - Framework adapters pattern (OpenClaw, CrewAI, LangGraph, AutoGen, Claude SDK)
- **Direct stack alignment:** React 19 + TypeScript strict + Zustand 5 + SQLite

---

#### 14. Sessions (Claude Code Session Tracking)

**Primary Donor: claude-code-viewer**
- **URL:** https://github.com/d-kimuson/claude-code-viewer
- **License:** MIT
- **Stack:** React, TypeScript, Vite, Tailwind CSS
- **What to extract:**
  - JSONL session log parsing and display
  - Real-time conversation viewing
  - Session history browsing with search
  - Progressive disclosure UI (summary > detail on demand)
  - Integrated terminal emulator panel
  - Rate limit detection and auto-continue scheduling
  - Multi-language support pattern (i18n)
- **npm packages:** Review their JSONL parser implementation

**Secondary Donor: claude-JSONL-browser**
- **URL:** https://github.com/withLinda/claude-JSONL-browser
- **License:** Check repo
- **What to extract:**
  - Multi-file JSONL management
  - Markdown export from conversation logs
  - Search functionality across sessions

**Supplementary: ccusage**
- **URL:** https://github.com/ryoppippi/ccusage
- **What to extract:** Token usage analysis and daily/monthly/session reporting patterns

---

#### 15. Orchestration (Multi-Agent Coordination)

**Primary Donor: Flowise**
- **URL:** https://github.com/FlowiseAI/Flowise
- **License:** Apache-2.0
- **Stars:** ~43k
- **What to extract:**
  - Visual workflow builder for agent coordination (node-based)
  - Agent flow canvas with drag-and-drop
  - 100+ integration connectors pattern
  - Chat interface for testing flows
  - Execution trace visualization
- **Key insight:** Use React Flow (@xyflow/react) as the foundation, steal Flowise's agent-specific node types

**npm packages:** `@xyflow/react` (MIT, the foundation of Flowise's canvas)

---

### Workspace Apps

---

#### 16. Actors (Human + Agent Phase Cadence)

**No direct open-source donor exists for this concept.** This is novel to EMA.

**Compose from:**
- **react-chrono** (MIT) -- Phase timeline (plan > execute > review > retro cadence)
  - URL: https://github.com/prabhuignoto/react-chrono
  - Extract: Horizontal timeline for phase progression
- **recharts** (MIT) -- Activity/contribution heatmaps and phase analytics
  - URL: https://github.com/recharts/recharts
  - Extract: Area charts for actor activity over time
- **Mission Control agent cards** -- Actor roster display
  - Reuse agent card grid, add human actor differentiation

**UX reference: GitHub contribution graph** -- Adapt the heatmap pattern for actor activity across phases.

---

#### 17. Spaces (Isolation Boundaries)

**Primary Donor: react-workspaces**
- **URL:** https://github.com/projectstorm/react-workspaces
- **License:** MIT
- **What to extract:**
  - Complete workspace management system for web apps
  - Split panels with resizable boundaries
  - Floating windows
  - Native drag-and-drop across browser windows
  - Tab management for multiple contexts

**Secondary: react-resizable-panels**
- **URL:** https://github.com/bvaughn/react-resizable-panels
- **License:** MIT
- **Stars:** ~4k
- **What to extract:**
  - Resizable panel groups for space isolation visualization
  - Nested panel layouts
  - Persistence of panel sizes
- **npm packages:** `react-resizable-panels`

---

### Creative Apps

---

#### 18. Canvas (Visual Workspace)

**Primary Donor: Excalidraw**
- **URL:** https://github.com/excalidraw/excalidraw
- **License:** MIT
- **Stars:** ~120k
- **npm:** `@excalidraw/excalidraw`
- **What to extract:**
  - Full infinite canvas with hand-drawn aesthetic
  - Shape library (rectangles, circles, arrows, text, images)
  - Real-time collaboration support
  - Exportable as React component
  - Library of reusable element collections
- **Integration notes:** Excalidraw takes 100% of container dimensions. No SSR support -- render after mount. Pairs well with EMA's existing canvas data model.

**Alternative: tldraw**
- **URL:** https://github.com/tldraw/tldraw
- **Stars:** ~40k
- **License:** tldraw SDK license (requires "Made with tldraw" watermark for free use; business license needed to remove)
- **What to extract:**
  - More polished, production-ready canvas SDK
  - Enterprise-grade multiplayer sync
  - Rich drawing tools, shapes, text, arrows
- **Caveat:** Non-MIT license. Watermark required unless you pay. Excalidraw is the safer choice for EMA.

---

#### 19. Pipes (Automation Workflows)

**Primary Donor: React Flow (@xyflow/react)**
- **URL:** https://github.com/xyflow/xyflow
- **License:** MIT
- **Stars:** ~28k
- **npm:** `@xyflow/react`
- **What to extract:**
  - Node-based workflow editor with dragging, zooming, panning
  - Custom node types (trigger nodes, action nodes, transform nodes)
  - Custom edge types (conditional edges, data flow edges)
  - Minimap, controls, background grid
  - Dark mode support (built-in as of v12)
  - Zustand-compatible state management
  - Layout via ELKjs engine
- **npm packages:** `@xyflow/react`, `elkjs` (auto-layout)

**This is the definitive library for Pipes.** Used by Stripe, Typeform, and is the foundation of Flowise, n8n, and similar tools.

**Secondary: reaflow**
- **URL:** https://github.com/reaviz/reaflow
- **License:** Apache-2.0
- **What to extract:** Alternative flow chart library from the same team as reagraph

---

#### 20. Evolution (Prompt Evolution)

**Primary Donor: Langfuse**
- **URL:** https://github.com/langfuse/langfuse
- **License:** MIT
- **Stars:** ~19k
- **What to extract:**
  - Prompt versioning with diff view between versions
  - Playground for testing prompt variants
  - Evaluation scoring (manual + LLM-as-judge)
  - Dataset management for test cases
  - Cost tracking per prompt version
  - Trace visualization for multi-step prompt chains

**Secondary Donor: Agenta**
- **URL:** https://github.com/Agenta-AI/agenta
- **License:** Apache-2.0
- **What to extract:**
  - Side-by-side model comparison UI
  - A/B testing and evaluation result tables
  - Prompt template editor with variable interpolation
  - Batch evaluation runner UI

---

### Life Apps

---

#### 21. Habits (Streak Tracking)

**Primary Donor: Iotawise**
- **URL:** https://madewithreactjs.com/iotawise (GitHub linked from there)
- **License:** Check repo (likely MIT)
- **Stack:** Next.js, TypeScript, TailwindCSS, shadcn/ui
- **What to extract:**
  - Streak counter with flame/fire visual indicator
  - Calendar heatmap for habit completion history
  - Dashboard analytics with charts
  - PWA cross-platform support pattern
  - Activity tracking with daily check-in flow

**Secondary Donor: ericadev/habit-tracker**
- **URL:** https://github.com/ericadev/habit-tracker
- **License:** Check repo
- **Stack:** React, TypeScript, Vite, Tailwind CSS
- **What to extract:**
  - Category-based habit organization
  - Visual calendar showing completion history (heatmap)
  - Statistics and analytics dashboard
  - Streak tracking with streak counter display
  - Local storage persistence

**npm packages:** `react-calendar-heatmap` (GitHub-style contribution grid), `recharts` (analytics)

---

#### 22. Journal (Mood/Energy)

**Primary Donor: zorapeteri/mood-tracker**
- **URL:** https://github.com/zorapeteri/mood-tracker
- **License:** Check repo
- **Stack:** TypeScript, React
- **What to extract:**
  - Mood tracking with note attachment
  - Mood pattern visualization over time
  - Habit tracking alongside mood
  - Insight generation from mood data

**Secondary Donor: MOOD (yakin-ts)**
- **URL:** https://github.com/yakin-ts/MOOD
- **License:** Check repo
- **Stack:** Next.js 13, TypeScript, Prisma, MySQL
- **What to extract:**
  - AI-driven sentiment analysis of journal entries
  - Question-based similarity search across entries
  - Mood timeline visualization

**npm packages:** `recharts` (mood charts), `@mdxeditor/editor` (journal entry editor), `date-fns` (date handling)

---

#### 23. Focus (Pomodoro Timer)

**Primary Donor: FocusFlow (fsalazar88)**
- **URL:** https://github.com/fsalazar88/focus-flow
- **License:** Check repo
- **Stack:** Electron, React, TypeScript
- **What to extract:**
  - Pomodoro timer with customizable session/break lengths
  - Reminder system for break notifications
  - Note-taking integrated with focus sessions
  - Desktop notification integration (Electron -- maps to Tauri)

**Secondary Donor: Pomo (krau5)**
- **URL:** https://github.com/krau5/pomo
- **License:** Check repo
- **Stack:** React, TypeScript, Vite
- **What to extract:**
  - Minimal, clean timer UI
  - Audio alerts for session transitions
  - Session history tracking

**UX reference: Super Productivity**
- **URL:** https://github.com/super-productivity/super-productivity
- **License:** MIT
- **Stars:** ~16k
- **What to steal:**
  - Pomodoro timer integrated with task context
  - Break reminder nudges
  - Flowtime technique (flexible focus blocks)
  - Anti-procrastination features
  - Time tracking with task association

**npm packages:** `use-sound` (audio alerts), circular progress component from shadcn

---

#### 24. Responsibilities (Recurring Obligations)

**No direct open-source donor matches this concept well.**

**Compose from:**
- **FullCalendar React** -- https://github.com/fullcalendar/fullcalendar -- MIT
  - Calendar view for recurring obligation due dates
  - npm: `@fullcalendar/react`, `@fullcalendar/daygrid`
- **recharts** -- Health score gauges (0.0-1.0) for each responsibility
- **Super Productivity's recurring task pattern** -- Cadence-based task generation
- **Custom:** Build obligation health dashboard with RAG status (red/amber/green) indicators

---

### System Apps

---

#### 25. Settings

**Primary Donor: react-settings-pane**
- **URL:** https://github.com/dstuecken/react-settings-pane
- **License:** MIT
- **What to extract:**
  - Settings page with categorized sections
  - Input types: switches, checkboxes, text inputs, textareas, dropdowns
  - Popup/modal display mode

**Better approach: Build with shadcn/ui form components**
- Use shadcn `Form`, `Input`, `Switch`, `Select`, `Tabs` components
- Category tabs on left, settings form on right
- Pattern from VS Code settings UI (search + categorized panels)

---

#### 26. MCP Tools

**Primary Donor: MCP Inspector**
- **URL:** https://github.com/modelcontextprotocol/inspector
- **License:** MIT
- **Stack:** React
- **What to extract:**
  - Interactive MCP server testing interface
  - Tool listing with parameter schemas
  - Tool execution with result display
  - Resource browser
  - Prompt template viewer
  - Transport protocol selection (stdio, SSE, streamable-http)

**Secondary: use-mcp React hook**
- **URL:** https://github.com/modelcontextprotocol/use-mcp
- **License:** MIT
- **What to extract:**
  - React hook for connecting to MCP servers
  - OAuth authentication flow handling
  - Auto-reconnection with retries
  - Tools, resources, and prompts access patterns
- **npm packages:** `use-mcp`

**Supplementary: mcp-ui-kit**
- **URL:** https://github.com/fredjens/mcp-ui-kit
- **What to extract:** React UI components specifically for MCP tool rendering

---

#### 27. CLI Manager

**Primary Donor: xterm.js + react-xtermjs**
- **URL (xterm.js):** https://github.com/xtermjs/xterm.js
- **URL (react wrapper):** https://github.com/Qovery/react-xtermjs
- **License:** MIT (xterm.js)
- **Stars:** ~18k (xterm.js)
- **What to extract:**
  - Full terminal emulator in the browser
  - Used by VS Code, Hyper, Theia
  - TypeScript native
  - Add-ons: search, fit, webgl renderer, unicode support
- **npm packages:** `@xterm/xterm`, `react-xtermjs`

**Alternative: @pablo-lion/xterm-react**
- **URL:** https://github.com/PabloLION/xterm-react
- **License:** MIT
- **What to extract:** More modern React wrapper with hooks, latest @xterm/xterm version

---

## Layer 2: Executive Management / Planning Tools

### Executive Functioning / ADHD Productivity

---

#### Super Productivity
- **URL:** https://github.com/super-productivity/super-productivity
- **License:** MIT
- **Stars:** ~16k
- **Stack:** Angular (not React, but UX patterns are gold)
- **UX patterns to steal:**
  - **Timeboxing integration:** Tasks have estimated time, timer counts down
  - **Anti-procrastination features:** "What's stopping you?" prompts when stuck
  - **Break reminders:** Configurable nudges based on time worked
  - **Pomodoro + Flowtime hybrid:** Both structured and flexible focus modes
  - **Backlog grooming:** Drag tasks between "today" and "backlog"
  - **Daily summary/work log:** Auto-generated time tracking export
  - **"One thing" focus:** Highlights the single current task

#### Leantime
- **URL:** https://github.com/Leantime/leantime
- **License:** AGPL-3.0 (UX reference only, no code copying)
- **Stars:** ~5k
- **Stack:** PHP + JavaScript
- **UX patterns to steal:**
  - **ADHD-specific design:** Reduced visual clutter, progressive disclosure
  - **Multiple views for same data:** Kanban, Gantt, list, calendar -- user picks what works for their brain
  - **Goal-to-task linking:** Every task traces back to a goal (EMA's intent hierarchy maps here)
  - **Milestone tracking:** Visual progress markers

#### AFFiNE
- **URL:** https://github.com/toeverything/AFFiNE
- **License:** MIT (CE) / MPL-2.0 (client-side)
- **Stars:** ~54k
- **Stack:** React, Rust, TypeScript
- **UX patterns to steal:**
  - **Docs + canvas + boards in one tool:** Toggle between writing, drawing, and organizing
  - **Block-based editing with database views:** Tables, kanbans from same data
  - **Local-first architecture:** Data on device, sync optional (matches EMA's SQLite model)
  - **Whiteboard mode:** Free-form canvas alongside structured content

#### Tiimo (Closed source -- UX reference)
- **URL:** https://www.tiimoapp.com
- **Notable:** iPhone App of the Year 2025
- **UX patterns to steal:**
  - **"Low dopamine design":** Avoids flashy, addictive elements
  - **Icon-based, animation-based task display:** No long text, no clutter
  - **3,000+ colors + custom icons:** Visual system personalization
  - **Emotion-safe notifications:** Soft, neutral tone to avoid triggering anxiety
  - **Visual time management:** Focus timer + widget + timeline make time visible
  - **AI task breakdown:** Type what's on your mind, AI breaks into clear steps with time estimates
  - **Co-designed with neurodivergent users:** User studies on emotional comfort, motivation cycles, hyperfocus patterns

#### Focus Bear (Closed source -- UX reference)
- **URL:** https://www.focusbear.io
- **UX patterns to steal:**
  - **Routine builder:** Morning/evening routines with step-by-step guidance
  - **App/website blocking during focus:** Reduce distraction surface
  - **Habit stacking:** Chain small habits together

---

### Goal Frameworks & OKR

---

#### OpenProject OKR
- **URL:** https://www.openproject.org
- **License:** GPL-3.0 (reference only)
- **UX patterns to steal:**
  - **Quarterly OKR cadence:** Goals set per quarter, reviewed weekly
  - **Key Result measurability:** Each KR has a numeric target and current value
  - **Goal hierarchy:** Corporate > Team > Individual cascading
  - **Progress automation:** KR progress computed from linked tasks/issues

#### Heptabase (Closed source -- UX reference)
- **URL:** https://heptabase.com
- **UX patterns to steal for Goals + Knowledge Graph:**
  - **Spatial organization of goals on canvas:** Goals as cards on infinite whiteboards
  - **Same card on multiple whiteboards:** One goal appears in multiple contexts
  - **Nested whiteboards:** L0 intent has whiteboard containing L1 intents, each with their own
  - **Bi-directional links between goals:** Goal graph emerges naturally
  - **Properties + tags on cards:** Filter/sort goals by status, priority, quarter

---

### Sprint Planning UIs

---

#### Sprint Planning React (open source examples)
- **URL:** https://github.com/topics/sprint-planning (various JS repos)
- **UX patterns to steal:**
  - **Velocity tracking chart:** Story points completed per sprint over time
  - **Burndown/burnup charts:** Sprint progress visualization
  - **Sprint backlog grooming:** Drag tasks from backlog to sprint
  - **Capacity planning:** Per-agent (or per-actor) capacity vs. committed work

**npm packages for sprint visualization:**
- `recharts` (MIT) -- Burndown, velocity, and capacity charts
- `@nivo/line`, `@nivo/bar` (MIT) -- Alternative chart library with more polish
  - URL: https://github.com/plouc/nivo

---

### Decision Frameworks

---

#### adr-tools
- **URL:** https://github.com/npryce/adr-tools
- **License:** Check repo
- **What to steal:** CLI-based ADR workflow (init, new, link, generate TOC)

#### MADR (Markdown Architectural Decision Records)
- **URL:** https://github.com/adr/madr
- **License:** MIT
- **What to steal:**
  - Structured template: Title, Status, Context, Decision Drivers, Considered Options, Decision Outcome, Pros/Cons
  - Status lifecycle: proposed > accepted > deprecated > superseded
  - Linking between related decisions

#### joelparkerhenderson/architecture-decision-record
- **URL:** https://github.com/joelparkerhenderson/architecture-decision-record
- **License:** GPL (reference only for templates)
- **Stars:** ~12k
- **What to steal:** Comprehensive template collection (Nygard, MADR, Planguage, Business Case)

---

### Agent Orchestration Dashboards

---

#### Mission Control (builderz-labs) -- PRIMARY
- **URL:** https://github.com/builderz-labs/mission-control
- **License:** MIT
- **Stars:** ~3.8k
- **Stack:** Next.js 16, React 19, TypeScript 5.7, Zustand 5, SQLite
- **Why this is EMA's best donor overall:**
  - Near-identical stack to EMA's frontend
  - Agent fleet management with dispatch
  - Task queue with priority and scheduling
  - Cost tracking and token monitoring
  - Security: RBAC, trust scoring, secret detection
  - 282 Vitest tests, 295 Playwright E2E tests
  - Natural language scheduling ("every morning at 9am")
  - Four-layer eval framework
  - WebSocket + SSE real-time updates

#### CrewAI (reference only -- proprietary)
- **URL:** https://crewai.com
- **UX patterns to steal:**
  - "Crew" metaphor: Reusable agent teams for recurring workflows
  - Centralized orchestration visibility dashboard
  - Synchronous + asynchronous task execution modes
  - Agent handoff visualization

#### Langfuse (LLM observability)
- **URL:** https://github.com/langfuse/langfuse
- **License:** MIT
- **Stars:** ~19k
- **What to extract for orchestration:**
  - Multi-turn conversation tracing
  - Token usage tracking per agent
  - Prompt versioning for agent system prompts
  - Evaluation framework for agent output quality
  - Dashboard with aggregated metrics

---

## Package Summary Table

| npm Package | License | Use In | Purpose |
|---|---|---|---|
| `@xyflow/react` | MIT | Pipes, Orchestration | Node-based workflow editor |
| `@excalidraw/excalidraw` | MIT | Canvas | Infinite canvas whiteboard |
| `react-force-graph-2d` | MIT | Knowledge Graph | Force-directed graph visualization |
| `reagraph` | Apache-2.0 | Knowledge Graph (alt) | WebGL graph visualization |
| `react-d3-tree` | MIT | Intent Map | Hierarchical tree visualization |
| `react-chrono` | MIT | Executions, Actors | Timeline component |
| `@mdxeditor/editor` | MIT | Vault, Journal, Wiki | Rich markdown editor |
| `@blocknote/react` | MPL-2.0 | Brain Dump | Block-based Notion-style editor |
| `react-kanban-kit` | MIT | Tasks | Kanban board with drag-and-drop |
| `@dnd-kit/core` | MIT | Tasks, Projects | Drag-and-drop primitives |
| `@dnd-kit/sortable` | MIT | Tasks, Brain Dump | Sortable lists |
| `recharts` | MIT | Goals, Habits, Dispatch, Journal | Charts and analytics |
| `react-resizable-panels` | MIT | Spaces | Resizable panel layouts |
| `@xterm/xterm` | MIT | CLI Manager | Terminal emulator |
| `react-xtermjs` | MIT | CLI Manager | React wrapper for xterm.js |
| `use-mcp` | MIT | MCP Tools | React hook for MCP servers |
| `react-calendar-heatmap` | MIT | Habits, Actors | GitHub-style activity heatmap |
| `react-markdown` | MIT | Decision Log, Vault | Markdown rendering |
| `remark-gfm` | MIT | Vault, Wiki | GitHub Flavored Markdown |
| `remark-wiki-link` | MIT | Wiki, Vault | [[wikilink]] parsing |
| `@fullcalendar/react` | MIT | Responsibilities | Calendar views |
| `elkjs` | EPL-2.0 | Pipes | Automatic graph layout |
| `mousetrap` | Apache-2.0 | Brain Dump | Keyboard shortcuts |
| `use-sound` | MIT | Focus | Audio alerts |
| `date-fns` | MIT | Journal, Habits | Date manipulation |

---

## Top 5 Highest-Impact Donors (Start Here)

1. **Mission Control** (builderz-labs) -- Agents, Dispatch Board, Orchestration. Near-identical stack. MIT.
2. **React Flow** (@xyflow/react) -- Pipes, Orchestration. Industry standard for workflow UIs. MIT.
3. **Excalidraw** -- Canvas. 120k stars, MIT, drop-in React component.
4. **Langfuse** -- Proposals, Evolution, agent observability. MIT, 19k stars.
5. **react-force-graph-2d** -- Knowledge Graph. MIT, 250k weekly npm downloads.

---

## Key UX Patterns to Steal (Cross-Cutting)

| Pattern | Source | Apply To |
|---|---|---|
| Low-dopamine design | Tiimo | All apps -- reduce visual noise, soft notifications |
| Progressive disclosure | claude-code-viewer, Outline | Sessions, Wiki -- summary first, expand on demand |
| View switcher (board/list/calendar/table) | Plane, AFFiNE | Tasks, Projects, Goals |
| Spatial organization on canvas | Heptabase | Intent Map, Knowledge Graph, Canvas |
| Anti-procrastination prompts | Super Productivity | Tasks, Focus |
| Phase timeline | react-chrono | Actors, Executions |
| Trust scoring visualization | Mission Control | Agents, Dispatch Board |
| Streak gamification | Iotawise, habit trackers | Habits, Responsibilities |
| ADR lifecycle badges | Log4brains, MADR | Decision Log |
| Trace waterfall | Langfuse, AgentNeo | Executions, Sessions, Orchestration |
