# EMA Electron Foundation 2026-04-10

## Position

EMA should stop being treated as a shell migration and start being treated as a local-first TypeScript operating environment for human and agent work.

The architectural target is:

- Electron for desktop control and packaging
- React 19 + React Compiler for renderer performance and maintainability
- TanStack Router, Query, and Form for typed frontend state boundaries
- Hono for typed local service contracts
- SQLite plus Drizzle for durable local persistence
- Effect for workflows, retries, streams, and typed failures in the service layer
- MCP plus MCP Apps as the integration and bridgecode plane

## Adopt Now

### 1. Electron as the only desktop host

- Keep transparency, multi-window behavior, tray, shortcuts, and packaging in one place.
- Build app/window behavior as a platform layer, not scattered renderer code.
- Current implementation direction is correct because it preserves portable local packaging.

### 2. React 19 with React Compiler

- Use it as the renderer baseline instead of hand-maintained memoization sprawl.
- This fits EMA because the renderer is already large and state-heavy.
- Do not center the app on server components or a web-first framework abstraction.

### 3. TanStack for the frontend system

- Router for typed route boundaries.
- Query for async server state.
- Form for complex local mutation flows.
- This is the cleanest current frontend system for a large desktop UI without framework lock-in.

### 4. Hono for service contracts

- Use Hono as the long-term HTTP or RPC boundary between renderer, CLI, workers, and any future remote tier.
- Hono is a better target state than accumulating more Fastify-specific route glue everywhere.
- The short-term compatibility layer can stay, but the long-term boundary should be contract-first and shared.

### 5. Drizzle plus SQLite

- SQLite remains correct for a packaged desktop application.
- Drizzle gives explicit schema control and low ceremony.
- Keep one local data spine, not several storage models fighting each other.

### 6. Effect in services and workers

- This is the best replacement for the lost discipline that previously came from Elixir supervision and flow semantics.
- Use it for orchestration, typed failures, background work, retries, and observability.
- Do not force Effect into every renderer component.

### 7. MCP plus MCP Apps as the bridge layer

- EMA should expose tools, workflows, and UI surfaces in agent-native form.
- MCP Apps matters because it allows rich tool UIs that degrade gracefully.
- This is the most direct path to becoming bridgecode instead of just another Electron client.

## Adopt Next

### 1. TanStack DB

- Use it selectively where query-driven sync materially simplifies derived state.
- It is promising for EMA because a lot of UI state is really query projections over local entities.
- Do not make it the only state backbone before parity is stable.

### 2. tldraw sync

- Use it for whiteboard, spatial planning, and collaborative structured surfaces.
- This is one of the strongest available foundations for live canvas behavior.
- It is a better jump-off point than inventing a custom shared canvas stack.

### 3. TanStack Intent

- Use it to package agent skills and workflow intents with the app itself.
- This fits the project's direction toward protocol-native actions and reusable capability surfaces.

## Experimental Only

### 1. LiveStore

- Very interesting local-first model.
- Not mature enough to become the universal foundation yet.

### 2. PGlite

- Useful for embedded labs, plugin sandboxes, or portable project capsules.
- Not the main EMA persistence layer.

### 3. TanStack AI

- Worth watching, not mature enough to anchor the architecture.

### 4. Electric

- Strong future option for sync and collaboration.
- Do not use it as the core runtime if the goal is to eliminate Elixir from the product stack.

## Reject

- No new Elixir services.
- No new Tauri paths.
- No Express sprawl.
- No untyped service contracts.
- No second local database as a parallel source of truth.
- No broad rewrite of stores before contract compatibility exists.

## Architectural Thesis

EMA should be a local-first TypeScript operating environment whose tools, state, workflows, and UI surfaces are all addressable through typed contracts and agent-native interfaces.

That means:

- human UI and agent UI share capabilities
- desktop packaging is first-class
- services are explicit and typed
- workflows are durable
- the renderer stays fast without bespoke state machinery

## Source Notes

- React 19.2 and React Compiler: react.dev blog and compiler docs
- TanStack Router, Query, Form, DB, and Intent: tanstack.com official docs
- Hono and Hono RPC: hono.dev official docs
- Drizzle: drizzle.team docs
- Effect: effect.website docs
- MCP and MCP Apps: modelcontextprotocol.io docs
- tldraw sync: tldraw.dev docs
- Biome v2: biomejs.dev blog
