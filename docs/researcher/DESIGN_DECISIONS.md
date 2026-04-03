# EMA Design Decisions

**Researcher Agent — Design Review Layer**
**Date:** 2026-04-03
**Status:** Living document — decisions logged as they're made, with rationale and alternatives considered

---

## How to Read This File

Each entry answers: **Why did we choose this?** Not what we chose (the code says that), but why — and what we rejected.

Format: Decision → Context → Options Considered → Chosen Approach → Rationale → Risk

---

## Architecture Decisions

### DD-001: Elixir/OTP as the Daemon Backbone

**Context:** EMA needs long-running background processes (proposal pipeline, harvesters, session watchers, agent genservers). This is process management, not request-response.

**Options considered:**
- Node.js with Worker threads — familiar, but complex error handling for long-running processes
- Python (FastAPI + threading) — easy to write, poor fault isolation
- Go — good concurrency, but no built-in supervision tree
- Elixir/OTP — supervision trees, let-it-crash philosophy, process isolation

**Chosen:** Elixir/OTP

**Rationale:** The proposal pipeline is exactly the kind of work OTP was designed for. Each pipeline stage is an independent actor. Stage crashes don't cascade. `rest_for_one` supervision means Generator going down auto-restarts without killing the queue. The Phoenix PubSub system is the correct event bus for this kind of domain-event-driven architecture.

**Risk:** Elixir is less common — fewer external contributors. Trajan knows it well enough. Acceptable.

---

### DD-002: SQLite Over PostgreSQL

**Context:** EMA is a local-first, single-user application on a personal workstation.

**Options considered:**
- PostgreSQL — mature, widely known, good tooling
- SQLite — embedded, zero setup, file-based
- DynamoDB / cloud DB — nonstarter, conflicts with local-first principle

**Chosen:** SQLite via `ecto_sqlite3`

**Rationale:** Zero setup. No separate process to manage. File lives at `~/.local/share/ema/ema.db`. Backups are a file copy. WAL mode handles concurrent reads from daemon + migrations. Single user means no connection pooling needed. If EMA eventually goes multi-device (P2P sync), CRDT-based sync (DeltaCrdt) is the plan — not migrating to PostgreSQL.

**Risk:** SQLite write performance under heavy parallel proposal generation. Mitigated by WAL mode + connection pool tuning.

---

### DD-003: Tauri 2 + React (Not Electron, Not Web-Only)

**Context:** EMA needs a desktop app shell. Privacy, performance, and local access matter.

**Options considered:**
- Electron — Chromium + Node.js bundled, heavy (300MB+), memory hungry
- Web-only (browser app) — no local file access without CORS workarounds
- Native (SwiftUI/Qt) — no, wrong platform, too narrow
- Tauri 2 — Rust shell + system webview, 5-15MB binary

**Chosen:** Tauri 2 with React 19

**Rationale:** Tauri uses the system WebView — no bundled Chromium. Binary is ~10MB vs Electron's 300MB. React 19 with Zustand is a known, maintainable stack. Tauri gives real local file access via Rust plugins. Per-window webviews enable the multi-app window model (each app opens in its own window).

**Risk:** Tauri 2 is newer — some edge cases. System WebView behavior varies across macOS/Linux. Mitigated by glass aesthetic CSS that works well in both WebKit and Blink.

---

### DD-004: Glass Morphism Aesthetic

**Context:** EMA needs a visual identity that feels premium, futuristic, and matches its "personal AI operating system" positioning.

**Options considered:**
- Standard dark mode (Material Dark, VS Code style) — clean but generic
- Skeuomorphic — dated
- Glass morphism — frosted glass surfaces, blur, depth layering
- Terminal aesthetic (ExecuDeck predecessor) — monochrome, hacker aesthetic

**Chosen:** Glass morphism with dark void base

**Rationale:** The design spec (2026-03-29) defines this clearly. Void background (`#060610`), glass surfaces with `backdrop-filter: blur()`, subtle borders. Three glass tiers: ambient (6px, 40%), surface (20px, 55%), elevated (28px, 65%). This creates visual hierarchy without heavy shadows. The aesthetic communicates "AI-native" better than generic dark UI. It's also distinctive — users won't confuse it with Notion or Linear.

**Risk:** `backdrop-filter` performance on some systems. Fallback: solid backgrounds. Glass transitions degrade to flat backgrounds gracefully.

**UX validation:** The glass hierarchy works well for distinguishing:
- Ambient (overall app background)
- Surface (cards, panels)
- Elevated (modals, dropdowns, hover states)

Trajan's workflow is primarily at-desk on a modern machine with a capable GPU. Performance is acceptable.

---

### DD-005: Claude CLI as Primary AI Backend (Not API)

**Context:** EMA needs to call Claude for proposal generation, agent chat, session analysis.

**Options considered:**
- Anthropic API (HTTP) — standard approach, full control over parameters
- Claude Code CLI (`claude --print`) — uses existing Max subscription, no extra billing
- OpenRouter (multi-model) — flexibility, but cost unpredictability
- Local models (Ollama) — free, private, but quality gap for complex reasoning

**Chosen:** Claude Code CLI as primary, with multi-provider bridge designed for future

**Rationale:** Trajan has a Claude Max subscription. Using the CLI means no separate API billing. The `--print --output-format json` pattern is reliable. The bridge architecture (`Ema.Claude.Bridge`) is provider-agnostic — switching to API or adding OpenRouter is a config change, not a rewrite.

**Risk:** CLI invocation has higher latency than HTTP API (process spawn overhead). Mitigated by Claude CLI's session reuse. Also means EMA can't run on machines without Claude CLI installed — acceptable for personal use.

---

### DD-006: PubSub as Pipeline Bus (Not Direct GenServer Calls)

**Context:** The proposal pipeline has 5 stages. How do stages communicate?

**Options considered:**
- Direct GenServer.call/cast — tight coupling, manual supervision wiring
- GenStage / Broadway — powerful but complex, overkill for this load
- Phoenix.PubSub — already in the system, event-driven, decoupled
- Process mailbox chaining — simple but obscures flow

**Chosen:** Phoenix.PubSub for stage-to-stage communication

**Rationale:** Each stage subscribes to the previous stage's "completed" event. Generator publishes `{:proposals, :generated, proposal}`. Refiner subscribes to `:generated`. This means:
1. Stages are fully decoupled — Refiner doesn't know Generator exists
2. Adding a new stage requires only subscribing to the right event
3. Monitoring is easy — subscribe to all proposal events in one place
4. The same events drive the Pipes system — no separate event bus needed

**Risk:** Event delivery is async — no backpressure. If Generator produces faster than Refiner can consume, the PubSub mailbox grows. Mitigated by making proposal generation CPU-limited (each Claude call takes 10-60s).

---

### DD-007: Stock Pipes = Transparent System Behaviors

**Context:** EMA has many built-in behaviors (proposal auto-approve, task generation from responsibilities). Where does the logic live?

**Options considered:**
- Hardcoded in each GenServer — fast, but invisible and non-modifiable
- Configuration files — inflexible, requires restart
- Pipes system with stock defaults — visible, modifiable, disable-able

**Chosen:** All stock behaviors are default pipes

**Rationale:** "Approved Proposal → Task" is a pipe. "Session Detected → Parse & Link" is a pipe. This means every behavior in EMA is visible in the Pipes app — users can see, modify, and disable anything. The system is self-documenting. Adding new built-in behaviors requires writing a pipe definition, not a GenServer. This directly addresses a key design principle: "The pipes *are* the documentation."

**Risk:** Performance overhead — every domain event goes through the Executor. Mitigated by the executor's efficient pattern matching on trigger_pattern strings.

---

### DD-008: Second Brain as EMA-Owned (Separate from Obsidian Vault)

**Context:** EMA needs a knowledge store. Trajan already uses an Obsidian vault at `~/Documents/obsidian_first_stuff/twj1/`.

**Options considered:**
- Read/write to existing Obsidian vault directly — single source of truth
- Read-only from Obsidian, write to own store — hybrid
- Completely separate `~/.local/share/ema/vault/` — clean isolation

**Chosen:** Separate EMA vault with optional Obsidian bridge

**Rationale:** The Obsidian vault has its own structure, frontmatter conventions, and plugins. EMA's Second Brain needs structured typed wikilinks (`[[type::note]]`), typed edges in the graph, automatic system brain updates, and Claude-generated content. Contaminating the personal Obsidian vault with auto-generated machine content would degrade it. Keeping them separate lets each evolve independently. The VaultHarvester can read from Obsidian as a source without writing to it.

**Risk:** Knowledge fragmentation — user maintains two vaults. Mitigated by: (a) EMA vault is focused on work-related knowledge, (b) future "Import from Obsidian" will allow intentional migration.

---

## UX Decisions

### DD-009: Glass Tier Hierarchy in Information Architecture

**Context:** How do we visually distinguish levels of information importance in the UI?

**Decision:** Three-tier glass system maps to information hierarchy:
- **Ambient** (40% opacity, 6px blur): background, lowest density info
- **Surface** (55%, 20px): primary content cards, panels
- **Elevated** (65%, 28px): modals, hover states, dropdowns, focused items

**Rationale:** Users build visual intuition for depth. A card that "lifts" on hover (switching from surface to elevated) communicates interactivity. Modals feel distinct from inline cards. This is more nuanced than "dark background, lighter cards."

---

### DD-010: Confidence Score as Colored Dot (Not Percentage)

**Context:** Proposals have a confidence score from 0.0 to 1.0. How to display it?

**Options considered:**
- Show raw number: "0.73" — precise but requires interpretation
- Progress bar — takes up too much space in list view
- Color-coded dot — instant heuristic (teal = high, blue = medium, amber = low)
- Star rating — subjective connotations

**Chosen:** Color-coded 8px dot, left-aligned on proposal card

**Rationale:** At a glance, Trajan needs to know "should I look at this now?" not "what's the exact confidence?". The dot answer that instantly. The exact number is available on expand. Color mapping: teal ≥0.7, blue 0.4-0.7, amber <0.4. This maps to traffic-light intuition without using literal red (red is for Kill action).

---

### DD-011: Three-Button Action Pattern (Green/Yellow/Red)

**Context:** Every proposal needs three actions: approve, redirect, kill.

**Options considered:**
- Right-click context menu — hidden, non-discoverable
- Swipe gestures — mobile UX, not desktop
- Inline buttons — always visible, takes space
- Single action + dropdown — reduces cognitive load but hides options

**Chosen:** Three inline buttons: ● Approve / ◐ Redirect / ✕ Kill

**Rationale:** The decision moment is the core of the proposals feature. It should be frictionless. Requiring a right-click or dropdown for the most common actions would reduce usage. The three symbols (filled circle, half-circle, X) use shape + color to communicate meaning without relying on color alone (accessibility).

**Redirect flow detail:** Yellow button first click shows a text input inline — user types redirect note before confirming. This prevents accidental redirects and captures the user's intent.

---

### DD-012: Multi-Window App Model (Not Tabs)

**Context:** EMA has 15+ apps (Proposals, Tasks, Projects, Agents, etc.). How to navigate?

**Options considered:**
- Single-page app with sidebar navigation — standard, but limits multitasking
- Browser-style tabs — familiar but adds mental overhead
- Independent windows per app — like macOS Finder "Always Open in New Window"
- Workspaces / virtual desktops — too complex

**Chosen:** Launcher grid (Launchpad) → each app opens in its own `WebviewWindow`

**Rationale:** Power users need to see Proposals and Tasks simultaneously. Multi-window makes this natural — two app windows side by side. Each window is independent with its own state. The Dock shows green dots for running apps. The Launchpad is the home screen. This matches how Trajan uses macOS (multiple windows, Mission Control to manage).

**Risk:** Window management fatigue. Mitigated by: window size/position persistence via `WorkspaceController`, and the Dock always showing which apps are open.

---

## Integration Decisions

### DD-013: Superman Client as Optional Enhancement (Not Core Dependency)

**Context:** Superman IDE provides code intelligence (gap detection, flow analysis, autonomous modification). Should EMA depend on it?

**Options considered:**
- Hard dependency — always require Superman running
- Optional — `SupermanClient.available?/0` before each call, graceful fallback
- Bake the functionality in — reimplement code intelligence in Elixir

**Chosen:** Optional HTTP client with graceful degradation

**Rationale:** Superman is a separate service on `localhost:3000`. It won't always be running. EMA's core features (proposals, tasks, vault, agents) work without it. Superman enhances the code health and intent map features. Making it optional means EMA works on any machine, not just Trajan's specific setup.

---

### DD-014: Phoenix Channel per Feature Domain (Not Single Websocket)

**Context:** Frontend apps need real-time updates from the daemon.

**Options considered:**
- Single WebSocket connection, multiplexed by message type — simpler, but tight coupling
- One channel per feature domain — each app joins its channel on mount
- Server-Sent Events — unidirectional, simpler but no client-to-server events

**Chosen:** Phoenix Channels — one channel topic per feature domain

**Rationale:** Phoenix Channels are Phoenix's idiomatic pattern. Each store calls `connect()` to join its channel (`proposals:queue`, `tasks:lobby`, `agents:lobby`, etc.). This means:
- Feature isolation — a broken proposals channel doesn't affect tasks
- Targeted broadcasts — `Phoenix.PubSub.broadcast("tasks:lobby", "task_updated", ...)` hits only the tasks channel
- Authentication per channel (future) — can restrict channel access without touching other features

---

## Decision Log (Chronological)

| ID | Decision | Date | Author |
|---|---|---|---|
| DD-001 | Elixir/OTP backbone | 2026-03-29 | Trajan + Architect |
| DD-002 | SQLite over PostgreSQL | 2026-03-29 | Trajan |
| DD-003 | Tauri 2 + React 19 | 2026-03-29 | Trajan |
| DD-004 | Glass morphism aesthetic | 2026-03-29 | Trajan |
| DD-005 | Claude CLI as primary AI backend | 2026-03-29 | Trajan |
| DD-006 | PubSub as pipeline bus | 2026-03-30 | Architect (spec) |
| DD-007 | Stock pipes = transparent behaviors | 2026-03-30 | Architect (spec) |
| DD-008 | Separate EMA vault from Obsidian | 2026-03-30 | Architect (spec) |
| DD-009 | Glass tier IA hierarchy | 2026-03-29 | Trajan |
| DD-010 | Confidence dot (not %) | 2026-03-30 | Spec |
| DD-011 | Three-button action pattern | 2026-03-30 | Spec |
| DD-012 | Multi-window app model | 2026-03-29 | Trajan |
| DD-013 | Superman as optional | 2026-03-30 | Architect (spec) |
| DD-014 | Phoenix Channel per domain | 2026-03-30 | Architect (spec) |
