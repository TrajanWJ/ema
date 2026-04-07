# EMA UI 2.0 Cross-Pollination Research: Layers 3-5

**Date:** 2026-04-07
**Scope:** Agent/AI orchestration UIs, creative tool components, life/productivity app patterns
**Purpose:** Actionable catalog of libraries, patterns, and components for EMA's next-gen interface

---

## Layer 3: Agent/AI Orchestration UIs

### 3.1 CrewAI Dashboard

**What it is:** Multi-agent orchestration platform with enterprise dashboard.

**Official tools:**
- Crew Studio exports React components for agent UIs
- Admin dashboard provides operational insights on deployments, performance, usage, and historical metrics
- GitHub (enterprise, not fully OSS): https://github.com/crewAI-inc

**Community dashboards:**
- [mandino/crewAI-dashboard](https://github.com/mandino/crewAI-dashboard) — Simplified UI for managing AI crews. TypeScript, Prisma, GraphQL, Next.js.
- [amazingnerd/CrewAI-UI](https://github.com/amazingnerd/CrewAI-UI) — Interactive UI for the CrewAI package.

**CopilotKit integration (key finding):**
CopilotKit announced CrewAI support in CoAgents (March 2025), enabling CrewAI agents in React apps with:
- Agent chat UI (headless or customizable components)
- Generative UI (tool calls render as React components)
- Shared state between agent and application
- NPM: `@copilotkit/react-ui`, `@copilotkit/react-core`
- GitHub: https://github.com/CopilotKit/CopilotKit
- License: MIT

**What to steal for EMA:**
- CopilotKit's pattern of tool calls rendering as React components — EMA agents could render inline UIs for approvals, previews, or data entry directly in the chat stream.
- The shared state model between agent and application (agent writes to Zustand store, UI reacts).

---

### 3.2 LangGraph Studio

**What it is:** Interactive IDE for building and debugging LangGraph agent applications.

**Key packages:**
- `@langchain/langgraph-sdk` — React components for building custom UIs that interact with LangGraph Platform deployments. Peer deps: `react@^18 || ^19`, `react-dom@^18 || ^19`.
- `@langchain/langgraph-ui` — Pre-built UI components for Studio, built with esbuild + Tailwind CSS.
- GitHub: https://github.com/langchain-ai/langgraph
- JS variant: https://github.com/langchain-ai/langgraphjs

**Generative UI feature:**
LangSmith supports colocating React components with graph code. CSS and Tailwind 4.x supported out of the box, including shadcn/ui. Components are specific to graph nodes — each step can have its own custom UI.

**Visualization approach:**
- [LangGraph-Visualizer](https://github.com/Coding-Crashkurse/LangGraph-Visualizer) — PoC visualizer using React, D3, and FastAPI. Good reference for graph rendering.

**What to steal for EMA:**
- The concept of colocating UI components with agent graph nodes — each pipe step or agent tool could have an associated React component for inline visualization.
- Graph execution replay with step-by-step state inspection.

---

### 3.3 AutoGen Studio

**What it is:** Microsoft's low-code interface for multi-agent workflows. Now in maintenance mode (Microsoft recommends their Agent Framework for new projects).

**Tech stack:** React (Gatsby/Next.js) frontend, FastAPI backend, Python agents.
- GitHub: https://github.com/microsoft/autogen
- Community UI: https://github.com/victordibia/autogen-ui

**Key UI patterns:**
- **Build view** — Drag-and-drop agent workflow composition using templates
- **Playground view** — Interactive task execution and workflow debugging with session management
- **Gallery view** — Pre-built workflow templates
- Four components: frontend UI, backend web API, workflow manager, database manager

**What to steal for EMA:**
- The three-view architecture (Build / Playground / Gallery) maps directly to EMA's needs: Build = pipe editor, Playground = agent chat + execution monitor, Gallery = pipe/agent templates.
- Session-based debugging where you can replay and compare agent executions.

---

### 3.4 Temporal.io Web UI

**What it is:** Workflow execution state and metadata visualization for durable execution platform.

**Tech stack:** Svelte (not React) — but the visualization patterns are worth studying.
- GitHub: https://github.com/temporalio/web (v1, MIT license)
- Timeline built on [vis-timeline](https://github.com/visjs/vis-timeline) (open source)

**Key visualization patterns:**
- **Timeline View** — Horizontal timeline of workflow events with HTML templates. Highly performant for large event counts.
- **Compact View** — Condensed event history
- **Full History View** — Complete event log with state inspection

**What to steal for EMA:**
- The timeline visualization pattern for agent execution traces. EMA could show agent tool calls, LLM requests, and state changes on a horizontal timeline.
- vis-timeline is MIT licensed and framework-agnostic — could be used directly in React.
- NPM: `vis-timeline` (MIT)

---

### 3.5 Prefect UI v2

**What it is:** Next-gen React dashboard for Python workflow orchestration.

**Tech stack:** React, TypeScript, Vite, TanStack Router, TanStack Query (React Query).
- GitHub: https://github.com/PrefectHQ/prefect (ui-v2 directory)
- License: **Apache 2.0**

**Key patterns:**
- Complete rewrite from Vue to React with modern tooling
- TanStack Query for data fetching with consistent caching patterns
- TanStack Router for type-safe routing with built-in data loading
- Flow run timeline with real-time status updates

**What to steal for EMA:**
- Prefect's migration to TanStack Router + Query is validation for EMA's existing TanStack usage patterns.
- Flow/task status visualization with color-coded run states.
- The pattern of combining REST initial load with real-time WebSocket updates (EMA already does this — study Prefect's implementation for refinements).

---

### 3.6 Dagster UI

**What it is:** React + TypeScript dashboard for data orchestration.

**Tech stack:** React 18, TypeScript, GraphQL, styled-components, Recoil (state management).
- GitHub: https://github.com/dagster-io/dagster (`js_modules/dagster-ui/`)
- NPM (internal): `@dagster-io/ui-components`, `@dagster-io/ui`
- License: **Apache 2.0**

**Key patterns:**
- Asset-centric UI — everything revolves around data assets and their lineage
- GraphQL API between frontend and backend
- Launchpad for configuring and launching runs
- Gantt chart execution timeline for visualizing parallel task execution

**What to steal for EMA:**
- The Gantt-style execution timeline for visualizing parallel agent work.
- Asset lineage graph showing how outputs from one step feed into another — maps to EMA's pipe chain visualization.
- The blog post "Why Web Workers Fall Short for Data UIs" has lessons about performance in data-heavy dashboards.

---

### 3.7 Rivet (by Ironclad)

**What it is:** Visual AI programming environment with node-based graph editor.

**Tech stack:** TypeScript, node-based graph editor (desktop app).
- GitHub: https://github.com/Ironclad/rivet
- NPM: `@ironclad/rivet-core` (runtime library), `@ironclad/rivet-node`
- License: **MIT**

**Key patterns:**
- Every step (LLM call, conditional gate, tool invocation, memory lookup) is a draggable node
- Graphs are stored as YAML — version-controllable and reviewable
- Real-time step-by-step execution visualization
- Nodes can be tested individually or as a complete graph

**What to steal for EMA:**
- The YAML-serializable graph format for EMA pipes. Currently pipes use DB records; a serializable format would enable version control and sharing.
- rivet-core is embeddable — could potentially be used as the graph execution engine for EMA's pipe system.
- The step-by-step execution visualization pattern where each node lights up as it executes.

---

### 3.8 Flowise

**What it is:** Visual drag-and-drop builder for AI agents and LLM workflows.

**Tech stack:** Monorepo with three packages: server (Node), ui (React), components (integrations).
- GitHub: https://github.com/FlowiseAI/Flowise
- NPM: `flowise` (CLI), `flowise-embed-react` (embeddable chat widget)
- License: **Apache 2.0**
- Uses **ReactFlow** (`@xyflow/react`) for the visual canvas

**Key patterns:**
- Pre-built component library with drag-and-drop composition
- Embeddable chat widget for integration into other apps
- Ready-to-use app templates as starting points
- AgentFlow package: `@flowiseai/agentflow` — React-based flow editor specifically for AI agent workflows

**What to steal for EMA:**
- The `flowise-embed-react` pattern of an embeddable chat widget — EMA could expose a similar widget for agent interaction.
- Flowise's use of ReactFlow as the canvas engine is proven at scale. EMA's pipe editor should use `@xyflow/react` directly.

---

### 3.9 AI Observability Platforms

**Key players and patterns worth studying:**

| Platform | What to Study | URL |
|----------|--------------|-----|
| **Langfuse** | Open source LLM observability. Trace visualization, prompt management, cost tracking. Self-hostable. | https://github.com/langfuse/langfuse |
| **AgentOps** | Agent execution replay with session timelines. Dashboard is open source. TypeScript SDK exports OpenTelemetry data. | https://github.com/AgentOps-AI/agentops |
| **VoltAgent** | MIT-licensed TypeScript AI agent framework with built-in observability dashboard (VoltOps Console). Real-time execution traces, performance metrics. | https://github.com/VoltAgent/voltagent |

**VoltAgent is the most relevant for EMA** because:
- MIT license, TypeScript, built for Node.js
- NPM: `@voltagent/core`
- Integrated observability dashboard with execution traces
- Supervisor + sub-agent pattern matches EMA's agent hierarchy
- Workflow engine with declarative multi-step automations

---

### 3.10 CopilotKit (Cross-Cutting)

**What it is:** The frontend stack for AI agents and generative UI.

- GitHub: https://github.com/CopilotKit/CopilotKit (MIT)
- NPM: `@copilotkit/react-ui`, `@copilotkit/react-core`
- Behind the AG-UI Protocol (adopted by Google, LangChain, AWS, Microsoft)

**Key patterns:**
- Tool calls render as React components inline in chat
- Agents can generate and update UI components dynamically at runtime
- Headless mode available for fully custom UI
- Minutes to integrate with CLI setup

**What to steal for EMA:**
- The AG-UI Protocol itself — a standard for agent-to-UI communication that EMA could adopt or be inspired by.
- The generative UI pattern where agents return React component specifications that the frontend renders. This could power EMA's agent responses rendering rich cards, charts, or interactive forms.

---

## Layer 4: Creative Tools Cross-Pollination

### 4.1 Canvas Components

#### Excalidraw

- **NPM:** `@excalidraw/excalidraw`
- **GitHub:** https://github.com/excalidraw/excalidraw (89.7k stars)
- **License:** MIT
- **What:** Virtual whiteboard with hand-drawn aesthetic. Embeddable React component.
- **Integration:** `npm install react react-dom @excalidraw/excalidraw`. Takes 100% of container width/height. Requires font files copied to public/ for self-hosting.
- **EMA mapping:** Drop-in replacement for EMA's Canvas app. The hand-drawn style fits EMA's creative/brainstorming use case. Could be used for visual brain dumps, project planning boards, or agent interaction diagrams.
- **Key advantage:** Massive community, mature API, MIT license, pure React.

#### tldraw

- **NPM:** `tldraw`
- **GitHub:** https://github.com/tldraw/tldraw
- **License:** **Commercial license required for production.** Free for development/hobby. MIT only for starter kits.
- **What:** Infinite canvas SDK for React. Feature-complete with custom shapes, tools, bindings, UI components.
- **SDK 4.0** announced — represents maturity.
- **EMA mapping:** More powerful than Excalidraw for building custom canvas experiences (e.g., a visual pipe editor or agent workspace). But the license is problematic for EMA.
- **Verdict:** Use Excalidraw instead unless the commercial license is acceptable.

#### react-konva

- **NPM:** `react-konva` + `konva`
- **GitHub:** https://github.com/konvajs/react-konva
- **License:** MIT (konva has its own license — check)
- **What:** React bindings for Konva HTML5 Canvas library. Declarative canvas rendering with full event support.
- **Limitations:** Not React Native compatible. Client-side only.
- **EMA mapping:** Lower-level than Excalidraw/tldraw. Good for custom visualizations (agent execution graphs, habit heatmaps, timeline views) where you need pixel-level control. Not a whiteboard replacement.

---

### 4.2 Pipes (Automation Builder)

#### @xyflow/react (React Flow)

- **NPM:** `@xyflow/react`
- **GitHub:** https://github.com/xyflow/xyflow
- **License:** MIT
- **What:** The definitive library for node-based UIs in React. Draggable nodes, zooming, panning, multi-select, add/remove elements. Nodes are React components.
- **EMA mapping:** **This is the primary recommendation for EMA's pipe editor.** Every pipe trigger, transform, and action becomes a node. Connections represent data flow. Custom node components can show live execution state, preview data, or provide inline configuration.
- **Used by:** Flowise, n8n (Vue variant), and hundreds of other workflow builders.
- **Key advantage:** MIT license, extremely active development, React-native (not React Native), customizable nodes.

#### n8n (Pattern Study)

- **GitHub:** https://github.com/n8n-io/n8n
- **License:** Fair-code (Sustainable Use License)
- **Tech:** Vue 3, Pinia, VueFlow (Vue port of React Flow), TypeScript monorepo
- **Not directly usable** (Vue, not React), but the UX patterns are the gold standard for automation builders:
  - Drag-and-drop node composition
  - Inline node configuration panels
  - Real-time execution visualization (nodes light up in sequence)
  - Error handling visualization (red borders, error messages on nodes)
  - Execution history with replay
  - Credential management per node

**What to steal for EMA:**
- n8n's execution visualization pattern: each node shows green (success) / red (failure) / yellow (running) states with execution time. Replicate this in EMA's pipe executor using `@xyflow/react`.
- The inline configuration panel pattern: clicking a node opens a side panel with typed input fields.
- Trigger → node chain → output visualization as a left-to-right flow.

#### Node-RED (Pattern Study)

- Flow-based programming tool. Browser-based editor using D3.js.
- Not React, but the flow-based programming paradigm is relevant.
- **What to steal:** The concept of "message passing" between nodes, where each node transforms and forwards data. Maps directly to EMA's pipe transforms.

---

### 4.3 Evolution (Prompt Engineering)

#### promptfoo

- **GitHub:** https://github.com/promptfoo/promptfoo
- **NPM:** `promptfoo`
- **License:** MIT (now part of OpenAI, remains open source)
- **Tech:** React 19, Vite, MUI v7

**Key UI patterns:**
- **Prompts Tab** — Side-by-side prompt variant comparison
- **Datasets Tab** — Test case definitions with variable sets
- **Evaluation History** — Pass/fail counts, scores, timestamps across versions
- **GitHub Action** — Automated prompt regression testing on PRs, opens web viewer for before/after comparison

**EMA mapping:** Directly applicable to EMA's proposal engine prompt management. Each pipeline stage (Generator, Refiner, Debater, Tagger) could have version-tracked prompts with promptfoo-style evaluation. The before/after comparison pattern is perfect for prompt iteration.

#### Feature Flag / A/B Testing Patterns

**Open source feature flag tools relevant to prompt versioning:**

| Tool | License | Key Pattern |
|------|---------|-------------|
| **Unleash** | Apache 2.0 | Toggle management with gradual rollout, segment-based targeting |
| **Flagsmith** | BSD 3-Clause | Feature flags + remote config, user segmentation, A/B testing |
| **GrowthBook** | MIT | Bayesian statistics for experiments, feature flags with targeting rules |

**EMA mapping:** Prompt version management could use feature-flag patterns — roll out new prompts to a percentage of proposal runs, measure quality scores, then promote or rollback. Flagsmith's dashboard patterns (toggle list, segment editor, experiment results) could inspire EMA's prompt evolution UI.

#### Langfuse Prompt Management

- **GitHub:** https://github.com/langfuse/langfuse
- **License:** MIT (core), some enterprise features
- **What:** Prompt versioning, playground, evaluation, cost tracking in one platform.
- **EMA mapping:** Langfuse's prompt playground pattern — test a prompt against multiple inputs and see results side-by-side — would be valuable for EMA's proposal engine tuning.

---

## Layer 5: Life/Productivity App Patterns

### 5.1 Habits

#### Killer UX Patterns from Top Apps

**Habitica** (gamification approach):
- RPG metaphor: completing habits = XP, gear, level ups
- Loss aversion: failing habits damages your character
- Social accountability: party system where everyone's habits affect the group
- Color-coded tasks: red (overdue) → green (on track) at a glance
- **Limitation:** RPG metaphor doesn't resonate with non-gamers
- GitHub: https://github.com/HabitRPG/habitica (GPL-3.0)

**Loop Habit Tracker** (minimalist approach):
- GitHub: https://github.com/iSoron/uhabits (GPL-3.0, Android)
- **Key insight:** Advanced streak formula where every repetition strengthens the habit and every miss weakens it, but a few misses after a long streak don't destroy progress. This is psychologically healthier than "don't break the chain."
- Supports complex schedules (3x/week, every other day)
- Home screen widgets for zero-friction tracking

**Streaks (iOS):**
- Limited to 12 habits max — forces prioritization
- Large circular progress indicators — visual clarity
- Health app integration for automatic tracking

#### React Components for Habits

**Calendar Heatmap (GitHub contribution graph style):**

| Package | NPM | License | Notes |
|---------|-----|---------|-------|
| `@uiw/react-heat-map` | `npm i @uiw/react-heat-map` | MIT | Lightweight, SVG-based, customizable colors |
| `react-calendar-heatmap` | `npm i react-calendar-heatmap` | MIT | SVG, expands to container, super configurable |
| `reactjs-calendar-heatmap` | `npm i reactjs-calendar-heatmap` | MIT | D3.js-based, calendar view |

**Recommendation for EMA:** Use `@uiw/react-heat-map` for habit visualization. It's lightweight, SVG-based, and MIT licensed. The GitHub contribution graph pattern is universally understood and provides instant visual feedback on consistency.

**Streak Tracker References:**
- [ilyaizen/streak-calendar](https://github.com/ilyaizen/streak-calendar) — Next.js productivity app with calendar visualization
- [lh0345/Habit-Tracker](https://github.com/lh0345/Habit-Tracker) — React + TypeScript with AI-powered predictions, Zod validation, modular architecture

#### What EMA Should Build

1. **Heat map calendar** as the primary habit view (steal from GitHub contributions)
2. **Loop-style flexible scoring** — not binary streaks but strength-based (habit gets weaker with misses but doesn't reset)
3. **Maximum 7-12 active habits** — enforce constraint to prevent tracking fatigue
4. **One-tap completion** from a widget/sidebar — minimize friction to zero
5. **Weekly review card** showing habit health trends

---

### 5.2 Journal

#### What Makes Journaling Stick (Pattern Analysis)

**Day One** (gold standard):
- Clean layout with "everything you need and nothing you don't"
- Streak calendar for momentum visualization
- Programmable reminders + daily journal prompts to eliminate blank-page anxiety
- Customizable templates for structured entries
- Integrations (Photos, Safari, Shortcuts) reduce entry friction
- End-to-end encryption builds trust for honest writing
- Passcode/biometric protection

**Daylio** (micro-journaling):
- No typing required — select mood emoji + activities
- Visual mood charts over time
- Correlation analysis (what activities correlate with good moods?)
- **Key insight:** Removing the writing requirement dramatically increases consistency

**Obsidian Daily Notes:**
- Template-based daily files
- Backlinks create automatic context web
- Dataview queries aggregate journal data
- **Key insight:** Structured metadata (mood::, energy::, tags) enables programmatic analysis

#### React Components for Journaling

**Mood/Energy Tracking:**
- [Chessman81/MoodMate](https://github.com/Chessman81/MoodMate) — React Native/Expo mood tracker with journaling and wellness insights. TypeScript.
- No standalone React mood-picker component on npm — this needs to be built custom.

**Rich Text Editors (for journal entry body):**

| Package | NPM | License | Notes |
|---------|-----|---------|-------|
| `@tiptap/react` | `npm i @tiptap/react` | MIT (core) | Headless rich text editor, highly extensible |
| `@lexical/react` | `npm i @lexical/react` | MIT | Meta's editor framework, built for performance |
| `@uiw/react-md-editor` | `npm i @uiw/react-md-editor` | MIT | Markdown editor with preview |

#### What EMA Should Build

1. **Two-mode entry:** Quick mode (Daylio-style mood/energy/activity selector, no typing) + Deep mode (rich text with templates)
2. **Daily prompt rotation** — AI-generated prompts based on recent context (from brain dumps, tasks, agent conversations)
3. **Mood/energy as structured data** — slider or emoji selector that writes to DB columns, not free text
4. **Weekly mood chart** — line graph of mood/energy over time with habit correlation overlay
5. **Streak visualization** — calendar heatmap (reuse the habit component) showing journaling consistency

---

### 5.3 Focus

#### What Makes Focus Apps Compelling (Pattern Analysis)

**Forest:**
- Visual tree growth as timer feedback — abstract time becomes tangible
- Three growth stages: Seedling (<60min), Growth (60-120min), Mature (>120min)
- **Loss aversion:** Leaving focus mode kills your tree (wilting animation)
- Unified forest theme with green color palette
- Multiplayer mode: team focus sessions where everyone must stay focused
- Real-world impact: earned coins plant actual trees (partnership with Trees for the Future)
- **Key insight:** The emotional cost of killing a tree is more motivating than the reward of growing one

**Pomofocus:**
- Clean, minimal timer with clear state transitions (Focus → Short Break → Long Break)
- Task list integrated with timer — select what you're working on
- Audio/visual notifications for state changes
- Customizable durations

#### React Components for Focus

| Package | NPM | License | Notes |
|---------|-----|---------|-------|
| `react-timer-hook` | `npm i react-timer-hook` | MIT | Hooks: useTimer (countdown), useStopwatch (count up), useTime (current time). Provides seconds, minutes, hours, isRunning, start, pause, reset. |
| `react-countdown-circle-timer` | `npm i react-countdown-circle-timer` | MIT | Animated SVG circle countdown. Visual and satisfying. |
| `react-circular-progressbar` | `npm i react-circular-progressbar` | MIT | Customizable circular progress indicator |

**Notable project:** [nikhilsaini2/focus-timer-pro](https://github.com/nikhilsaini2/focus-timer-pro) — Next.js + Tailwind + GSAP. Animated UI, productivity analytics, task management. Good reference for premium feel.

#### What EMA Should Build

1. **Organic growth metaphor** — not a tree (Forest owns that), but something that grows with focus time. A crystal forming, a nebula coalescing, or a circuit energizing. Fits the glass morphism void aesthetic.
2. **Loss aversion mechanic** — breaking focus should have a visible, slightly painful consequence (the growing thing dims/cracks).
3. **Task binding** — timer is always bound to a specific task or project. Focus time accrues to the entity.
4. **Session history** — visualize focus blocks on a day timeline (like Dagster's Gantt chart but for your day).
5. **Use `react-timer-hook`** for the core timer logic, `react-countdown-circle-timer` for the visual ring, and custom GSAP/CSS animations for the growth metaphor.

---

### 5.4 Responsibilities

#### What Drives Follow-Through (Pattern Analysis)

**Beeminder:**
- Financial stakes: pledge money that you lose if you fail
- "Bright red line" visualization: your data must stay above/below the line
- Flexible commitment contracts with built-in "out" clauses
- Auto-tracks via integrations (fitness trackers, GitHub, etc.)
- **Key insight:** The combination of financial stakes + visual "road" creates powerful accountability without requiring willpower

**StickK:**
- Commitment contracts with customizable consequences
- Referee system: designate someone to verify your compliance
- Anti-charity option: money goes to a cause you dislike if you fail
- Community support for similar goals

**Common patterns that work:**
1. **Visual "danger zone"** — clear indication when you're falling behind
2. **Escalating consequences** — small misses are forgivable, patterns are not
3. **External accountability** — human referee or automated tracking
4. **Integration with data sources** — reduce self-reporting (which is unreliable)

#### Health Score Visualization

**Patterns from healthcare dashboards:**
- Traffic light system: green (healthy) → yellow (at risk) → red (critical)
- Progress bars/rings with percentage completion
- Trend overlays showing movement toward/away from goals
- Sparklines for compact trend indication
- Milestone badges celebrating achievements

**React components for health visualization:**

| Package | NPM | License | Notes |
|---------|-----|---------|-------|
| `recharts` | `npm i recharts` | MIT | Composable chart library built on D3. Good for line/bar/area charts. |
| `react-sparklines` | `npm i react-sparklines` | MIT | Tiny inline charts for compact trend display |
| `react-circular-progressbar` | `npm i react-circular-progressbar` | MIT | Circular health score indicator |

#### What EMA Should Build

1. **Health score as a first-class visual** — each responsibility gets a 0-100 health ring (green/yellow/red) visible at a glance. Use `react-circular-progressbar`.
2. **Trend sparklines** — inline sparkline next to each responsibility showing 30-day health trend. Use `react-sparklines`.
3. **Danger zone alerts** — when health drops below threshold, the responsibility card gets a red glow/border with time-to-deadline.
4. **Cadence calendar** — show upcoming due dates on a timeline view, grouped by responsibility.
5. **Auto-tracking where possible** — link responsibilities to Git commits, journal entries, or task completions to reduce manual check-ins.
6. **Loop-style forgiveness** — a single miss shouldn't crater the health score. Use exponential decay, not binary pass/fail.

---

## Summary: Priority Component Recommendations

### Must-Have NPM Packages

| Package | Purpose in EMA | License |
|---------|---------------|---------|
| `@xyflow/react` | Pipe editor visual canvas | MIT |
| `@excalidraw/excalidraw` | Canvas app whiteboard | MIT |
| `@uiw/react-heat-map` | Habit + journal streak heatmaps | MIT |
| `react-timer-hook` | Focus timer core logic | MIT |
| `react-countdown-circle-timer` | Focus timer visual ring | MIT |
| `react-circular-progressbar` | Responsibility health scores | MIT |
| `recharts` | Charts across all apps | MIT |
| `react-sparklines` | Inline trend indicators | MIT |

### Study-and-Extract Patterns

| Source | Pattern to Extract |
|--------|-------------------|
| **CopilotKit / AG-UI** | Agent tool calls rendering as inline React components |
| **n8n** | Node execution state visualization (green/red/yellow) |
| **Temporal** | Horizontal timeline for execution traces |
| **Dagster** | Gantt-style parallel execution view |
| **AutoGen Studio** | Build / Playground / Gallery three-view architecture |
| **Rivet** | YAML-serializable graph format for version control |
| **promptfoo** | Side-by-side prompt variant comparison |
| **Forest** | Loss aversion + organic growth metaphor for focus |
| **Loop Habit Tracker** | Flexible streak scoring (strength-based, not binary) |
| **Day One** | Template-based journaling with prompts to reduce blank-page anxiety |
| **Daylio** | Micro-journaling (mood/activity selector, no typing required) |
| **Beeminder** | Visual "bright red line" for accountability tracking |

### Architecture Decisions

1. **Pipe editor:** Use `@xyflow/react` as the canvas engine. Nodes = triggers/transforms/actions. Custom node components for configuration and live state.
2. **Canvas app:** Embed `@excalidraw/excalidraw` as the primary whiteboard. MIT license, 89k stars, pure React.
3. **Agent UI:** Study CopilotKit's generative UI pattern. Consider adopting AG-UI protocol for agent-to-frontend communication.
4. **Observability:** VoltAgent's TypeScript framework with built-in dashboard is the closest match to EMA's architecture. Study its execution trace visualization.
5. **Prompt evolution:** Adopt promptfoo patterns for prompt versioning and evaluation. The React 19 + Vite + MUI stack aligns with modern tooling.
6. **Life apps:** Prioritize friction reduction over feature richness. One-tap habit completion, mood-emoji journaling, task-bound focus timer.
