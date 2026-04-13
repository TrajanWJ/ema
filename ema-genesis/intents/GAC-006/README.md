---
id: GAC-006
type: gac_card
layer: intents
title: "@ema/core SDK API surface — what methods does the SDK expose to vApps?"
status: pending
created: 2026-04-12
updated: 2026-04-13
author: research-round-1
category: gap
priority: high
connections:
  - { target: "[[vapps/CATALOG]]", relation: references }
  - { target: "[[research/vapp-plugin/logseq-logseq]]", relation: derived_from }
  - { target: "[[research/vapp-plugin/smapiot-piral]]", relation: derived_from }
  - { target: "[[research/vapp-plugin/laurent22-joplin]]", relation: derived_from }
---

# GAC-006 — @ema/core SDK API surface

## Question

EMA canon says vApps share access to "EMA Core API" — but the API doesn't exist. **What methods does `@ema/core` expose?** Without this document, every vApp will reinvent IPC and the 35-app catalog will fragment.

## Context

Round 1 surfaced three production references:

1. **Logseq's `@logseq/libs`** — single npm package + global proxy + framework-agnostic
2. **Piral's `pilet-api`** — micro-frontend shell API with `registerTile`, `registerPage`, `registerMenu`
3. **Joplin's plugin API** — typed API with `joplin.workspace`, `joplin.commands`, etc.

All three converge on roughly the same surface. EMA should pick names and ship them BEFORE the first vApp is built.

## Options

- **[A] Logseq-style flat namespace**: Single global `ema` object with all methods directly. `ema.intents.create({...})`, `ema.vault.search('q')`, `ema.agents.dispatch('coder', ...)`.
  - **Implications:** Simplest discovery. One import. Hard to namespace by domain.
- **[B] Piral-style registration API**: Shell API methods like `ema.registerTile`, `ema.registerPage`, `ema.registerMenu`. Plugin self-describes its surface.
  - **Implications:** Clean shell-vs-plugin contract. Less direct data access (vApps register handlers, the shell calls them).
- **[C] Joplin-style domain namespaces**: `ema.workspace.openWindow(...)`, `ema.commands.register(...)`, `ema.contentScripts.register(...)`. Domain-grouped.
  - **Implications:** Most ergonomic. Two-level namespace. Bigger API surface but easier to find what you need.
- **[D] Hybrid: domain namespaces + registration API + global event bus**: All three. Domains for direct access, registration for shell integration, events for cross-vApp coordination.
  - **Implications:** Most complete. Most API surface to maintain. **Recommended** for the long term.
- **[1] Defer**: Don't ship an SDK in v1; vApps directly use Electron IPC.
- **[2] Skip**: Until the first third-party vApp arrives, don't lock in.

## Recommendation

**[D]** with the API surface stubbed in `vapps/CATALOG.md` before any vApp code ships. Read Piral's `pilet-api` docs for method names — they've already solved 80% of this.

Initial surface (example):
```typescript
ema = {
  // Domain access
  intents: { create, list, get, update, delete, ... },
  proposals: { create, approve, reject, ... },
  vault: { search, read, write, link, ... },
  agents: { dispatch, list, status, ... },
  graph: { query, traverse, connect, ... },
  
  // Shell registration
  registerTile, registerPage, registerMenu, registerNotification,
  
  // Cross-vApp events
  events: { on, emit, off },
  
  // Lifecycle
  ready, dispose,
}
```

## What this changes

New canon doc: `vapps/SDK-API-SURFACE.md`. References `[[research/vapp-plugin/logseq-logseq]]`, `[[research/vapp-plugin/smapiot-piral]]`, `[[research/vapp-plugin/laurent22-joplin]]`. Locked before any vApp ships.

## Connections

- `[[vapps/CATALOG]]`
- `[[research/vapp-plugin/_MOC]]`

#gac #gap #priority-high #ema-core-sdk #api-surface
