---
id: FRONTEND-DUAL-SURFACE-SHELL
type: research
layer: research
title: "Dual-Surface Shell (iii-lite)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: frontend-brainstorm
source: self
signal_tier: Decision-precursor
tags: [frontend, architecture, electron, browser, sdk, iii-lite]
connections:
  - { target: "[[research/frontend-patterns/_MOC]]", relation: parent }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
  - { target: "[[research/vapp-plugin/logseq-logseq]]", relation: references }
  - { target: "[[research/vapp-plugin/smapiot-piral]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
insight: "The architecture supports running the same React codebase as both an Electron desktop app and a browser tab. Ship Electron-only in v1, but enforce SDK discipline from day one so the browser target is a build flag later, not a rewrite."
---

# Dual-Surface Shell — iii-lite

## What it is

A commitment to **one React codebase, two runtime targets**:

1. **Electron window** (v1 ship target) — the primary desktop experience, with a custom titlebar (AmbientStrip), Dock, CommandBar, and full access to a local daemon via a preload bridge.
2. **Browser tab** (deferred ship, architecturally supported) — the same React app served from the daemon over HTTP, so you can access HQ from any browser when away from your desktop machine.

"Lite" means: the capability is designed in, but not shipped in v1. The browser build, auth flow, and chrome-degradation paths are deferred. What is NOT deferred: the SDK discipline that makes the browser target a future build flag rather than a future rewrite.

## Why

The old build had a separate `hq-frontend/` codebase — a React web app with 9 pages (dashboard, projects, executions, agents, brain-dump, actors, spaces, orgs, intents) talking to the same Phoenix daemon as the Tauri desktop app. Two codebases, same data, no code sharing. The new build absorbs HQ's concepts into the unified vApp catalog and runs everything from one surface.

Benefits:
- **One codebase, two targets, forever.** No divergence, no duplicated features.
- **SDK discipline by constraint.** vApps cannot use `window.electron.*` or any Electron-specific API directly. They must go through `@ema/core`, which has two transports under the hood: Electron preload bridge (IPC) or HTTP+WS client (browser). This alone prevents the 75-store IPC mess the current build inherited from the old Tauri renderer.
- **Free browser access later.** When v2 is ready, flip the build flag and ship a web build — no vApp rewrites.

Costs:
- Every vApp must be SDK-clean. No direct IPC calls.
- Shell chrome (AmbientStrip, window controls, drag regions) must have a no-op path for browser mode — deferred to v2 but the seams must exist now.
- Auth is a real item. Electron mode assumes local daemon trust (loopback). Browser mode eventually needs a token flow. Deferred to v2, but the SDK transport layer must be auth-aware from day one.

## Pattern to steal

- **[[research/vapp-plugin/logseq-logseq]]** `@logseq/libs` pattern — single SDK surface consumed by all plugins regardless of runtime.
- **[[research/vapp-plugin/smapiot-piral]]** shell API pattern — microfrontend shell with a versioned API contract. vApps bind to the contract, not to the shell.
- Electron's contextBridge + preload — standard pattern for typed IPC. Bridge exposes the same function names that the HTTP+WS client exposes, behind a common interface.

## What changes about the blueprint

- **New canon spec needed:** `canon/specs/VAPP-SDK-CONTRACT.md` — defines the `@ema/core` surface, plugin registration, IPC shape, event subscription, space-scoping, error handling. Queued as intent `INT-FRONTEND-VAPP-SDK-CONTRACT`.
- **New decision needed:** `DEC-NNN-dual-surface-shell.md` — locks the iii-lite commitment and defines v1/v2 split explicitly. This research node is its precursor.
- **Old hq-frontend is dead.** Its 9 pages fold into the 35-vApp catalog; the separate codebase is not ported.
- **Sidebar component (old build) is dead.** Dock replaced it in the current renderer.

## Gaps / open questions

- **Auth flow for browser target.** Token-based? OAuth against the daemon? Deferred, but needs an owner before v2.
- **Chrome degradation rules.** When running in browser mode, what does AmbientStrip become? Probably: collapse to just the Space/Org dropdowns + CommandBar, let the browser provide the window frame. Needs a visual spec.
- **Which vApps break first?** Anything using native file dialogs, global shortcuts, or tray icons in Electron-only mode. Need to audit which of the 35 vApps require Electron-only capabilities and mark them.
- **Build flag vs separate build.** Is there one `@ema/renderer` package that branches at build time, or two packages sharing everything? Leaning: one package, build flag.

## Canon integration

This node is a **decision precursor**. The full DEC card requires an intent + proposal in `ema-genesis/intents/`. Provisionally queued as `INT-FRONTEND-DUAL-SURFACE-SHELL`.

## Related

- [[launchpad-one-thing-card]] — lives inside Launchpad mode of this shell
- [[_meta/SELF-POLLINATION-FINDINGS]] — iii-lite resolves the "Frontend Zustand stores → SDK" replacement row
- [[research/vapp-plugin/logseq-logseq]], [[research/vapp-plugin/smapiot-piral]] — patterns to steal

#frontend #architecture #electron #browser #sdk #iii-lite
