---
id: RES-waveterm
type: research
layer: research
category: cli-terminal
title: "wavetermdev/waveterm — Electron AI terminal with block composition model"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/wavetermdev/waveterm
  stars: 19439
  verified: 2026-04-12
  last_activity: 2026-04-10
signal_tier: A
tags: [research, cli-terminal, signal-A, waveterm, electron, block-model]
connections:
  - { target: "[[research/cli-terminal/_MOC]]", relation: references }
  - { target: "[[research/cli-terminal/vercel-hyper]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
---

# wavetermdev/waveterm

> Open-source AI-integrated terminal built on Electron with a Go backend. The **block composition model** is the right shape for EMA's Agent Live View vApp — terminal as one element among several, not the whole window.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/wavetermdev/waveterm> |
| Stars | 19,439 (verified 2026-04-12) |
| Last activity | 2026-04-10 |
| Signal tier | **A** |
| Stack | Go backend + Electron renderer + xterm.js |

## What to steal

### 1. The block composition model

Each tab contains multiple blocks arranged via a layout engine. Blocks can be:
- Terminal (xterm.js)
- Markdown preview
- File viewer
- AI chat panel
- Image viewer
- Custom widget

For EMA's Agent Live View, this is the right shape: a tab with the agent terminal as the centerpiece + side panels for "files touched" / "commands run" / "approvals pending." NOT just a raw terminal window.

### 2. Backend/frontend separation

Go backend holds long-running terminal state. Electron renderer is just a view. EMA's daemon ↔ Electron split should follow the same: backend state lives in a long-running process, Electron is a view layer.

### 3. xterm.js + React overlay pattern

The frontend is pure xterm.js in a BrowserWindow with a React overlay for the chrome (tab bar, side panels, controls). Exact stack EMA needs.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` vApp 23 (Agent Live View) + vApp 25 (Terminal) | Reference Wave's block model. Currently neither describes UI chrome wrapping the xterm.js pane. |
| `AGENT-RUNTIME.md` | Add "Composed View" pattern — terminal is the centerpiece but not the only element |

## Gaps surfaced

- CATALOG treats Agent Live View as "a terminal in a window." Wave shows it should be a composed view with the terminal as the centerpiece but not the only element. Otherwise vApp 23 is redundant with vApp 25.

## Notes

- Bigger than EMA needs, but the block model is directly portable.
- Go backend is less relevant than the TypeScript renderer.

## Connections

- `[[research/cli-terminal/vercel-hyper]]` — simpler Electron+xterm reference
- `[[research/cli-terminal/Ark0N-Codeman]]` — minimal alternative
- `[[research/cli-terminal/xtermjs-xterm_js]]`
- `[[canon/specs/AGENT-RUNTIME]]`

#research #cli-terminal #signal-A #waveterm #electron #block-model
