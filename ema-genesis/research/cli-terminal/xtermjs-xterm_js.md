---
id: RES-xterm-js
type: research
layer: research
category: cli-terminal
title: "xtermjs/xterm.js — the canonical browser/Electron terminal emulator"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/xtermjs/xterm.js
  stars: 18000
  verified: 2026-04-12
  last_activity: 2026-04-11
  license: MIT
signal_tier: A
tags: [research, cli-terminal, signal-A, xterm-js, terminal-emulator]
connections:
  - { target: "[[research/cli-terminal/_MOC]]", relation: references }
  - { target: "[[research/cli-terminal/microsoft-node-pty]]", relation: references }
  - { target: "[[research/cli-terminal/Ark0N-Codeman]]", relation: references }
---

# xtermjs/xterm.js

> The canonical terminal emulator for browsers and Electron. Powers VSCode's integrated terminal, Hyper, Tabby, Wave, Codeman. **Non-negotiable dependency** for EMA's Agent Live View vApp.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/xtermjs/xterm.js> |
| Stars | ~18,000 (verified 2026-04-12) |
| Last activity | 2026-04-11 |
| Signal tier | **A** |
| Maintained by | VSCode terminal team (same as `[[research/cli-terminal/microsoft-node-pty]]`) |
| License | MIT |

## What to steal

### 1. Just use it

xterm.js is the standard. AGENT-RUNTIME.md already names it.

### 2. The addon ecosystem

Official addons:
- `xterm-addon-fit` — auto-resize
- `xterm-addon-search` — find in scrollback
- `xterm-addon-web-links` — clickable URLs
- `xterm-addon-serialize` — save scrollback to JSON
- `xterm-addon-canvas` / `xterm-addon-webgl` — renderer choices

EMA needs at minimum: `fit`, `search`, `web-links`. Maybe `serialize` for session export.

### 3. Performance via WebGL renderer

The WebGL renderer hits 60fps reliably. Critical for the `[[research/cli-terminal/Ark0N-Codeman]]` anti-flicker pipeline to actually deliver smooth output.

### 4. Same maintainer team as node-pty

VSCode terminal team maintains both. Use them together.

## Changes canon

None — canon already names xterm.js. This node anchors the prior art.

## Gaps surfaced

- None directly. Canon is correct on this pick.

## Notes

- Maintained by Microsoft's VSCode terminal team alongside `[[research/cli-terminal/microsoft-node-pty]]`.
- Use the WebGL renderer in production, not the canvas fallback.

## Connections

- `[[research/cli-terminal/microsoft-node-pty]]` — pty backend
- `[[research/cli-terminal/Ark0N-Codeman]]` — production stack reference
- `[[research/cli-terminal/wavetermdev-waveterm]]` — block model alternative
- `[[research/cli-terminal/vercel-hyper]]` — minimal Electron+xterm reference

#research #cli-terminal #signal-A #xterm-js
