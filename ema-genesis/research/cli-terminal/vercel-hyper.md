---
id: RES-hyper
type: research
layer: research
category: cli-terminal
title: "vercel/hyper — canonical Electron + xterm.js + node-pty terminal"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/vercel/hyper
  stars: 44606
  verified: 2026-04-12
  last_activity: 2026-04-06
signal_tier: A
tags: [research, cli-terminal, signal-A, hyper, electron-reference]
connections:
  - { target: "[[research/cli-terminal/_MOC]]", relation: references }
  - { target: "[[research/cli-terminal/microsoft-node-pty]]", relation: references }
  - { target: "[[research/cli-terminal/xtermjs-xterm_js]]", relation: references }
---

# vercel/hyper

> 44k stars. The canonical Electron + xterm.js + node-pty terminal. 10+ years old, still actively maintained. **Read `app/terminal.ts` and `app/session.ts`** for how stdin/stdout crosses IPC between main and renderer.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/vercel/hyper> |
| Stars | 44,606 (verified 2026-04-12) |
| Last activity | 2026-04-06 |
| Signal tier | **A** |
| Stack | TypeScript + Electron + xterm.js + node-pty |

## What to steal

### 1. The minimal Electron + xterm + pty wiring

Read `app/terminal.ts` and `app/session.ts` end-to-end. **This is THE reference implementation** for "terminal in a BrowserWindow." Copy the IPC pattern between main process (which owns the pty) and renderer (which renders xterm.js).

### 2. Plugin architecture

Plugins are npm packages that can mutate config, decorate the terminal, or inject React components. EMA's vApp SDK should borrow this — npm-packaged plugins with a typed API surface.

### 3. Native module packaging for Electron

Hyper handles native node-pty bindings via electron-builder. EMA will hit the exact same packaging problem; copy the build config.

### 4. Vercel-maintained

Stable, well-funded, battle-tested. The tech debt is manageable.

## Changes canon

| Doc | Change |
|---|---|
| `AGENT-RUNTIME.md` | Explicitly name Hyper as the reference Electron shell implementation |
| `EMA-GENESIS-PROMPT.md §4` | Reference Hyper for native-module packaging guidance |

## Gaps surfaced

- Canon doesn't address native-module packaging for Electron (node-pty needs per-platform binaries). **Hyper's build setup is the template.**

## Notes

- Kitchen-sink app — grep for the pty/xterm wiring slice and copy that.
- Ignore the plugin UI, theming, splitting, etc. unless EMA wants those features.

## Connections

- `[[research/cli-terminal/microsoft-node-pty]]`
- `[[research/cli-terminal/xtermjs-xterm_js]]`
- `[[research/cli-terminal/Ark0N-Codeman]]`
- `[[research/cli-terminal/wavetermdev-waveterm]]` — alternative Electron approach

#research #cli-terminal #signal-A #hyper #electron-reference
