---
id: RES-tabby
type: research
layer: research
category: cli-terminal
title: "Eugeny/tabby — full-featured Electron terminal with SSH client"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/Eugeny/tabby
  stars: 70291
  verified: 2026-04-12
  last_activity: 2026-03-20
signal_tier: B
tags: [research, cli-terminal, signal-B, tabby, ssh, tab-manager]
connections:
  - { target: "[[research/cli-terminal/_MOC]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
---

# Eugeny/tabby

> 70k stars. Full-featured Electron terminal with SSH, serial, Telnet clients. **Read for the SSH-over-Electron implementation** since canon's cross-machine dispatch line says "ssh2" without details.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/Eugeny/tabby> |
| Stars | 70,291 (verified 2026-04-12) |
| Last activity | 2026-03-20 |
| Signal tier | **B** |
| Frontend | Angular |

## What to steal

### 1. Tab manager with strict lifecycle

Each tab has a lifecycle: `pending → active → background → closed`. Each tab has a kind: `terminal | ssh | settings | profile`. EMA's per-vApp BrowserWindow lifecycle should mirror this strictness.

### 2. Production SSH client implementation

Tabby has a real SSH-over-Electron implementation using `ssh2` (the npm lib EMA canon mentions). Read it for:
- Auth method handling (key / agent / password)
- Connection pool management
- Reconnection logic
- Connection profiles

### 3. Settings UI for connection profiles

EMA will need similar UI for per-agent / per-machine config.

## Changes canon

| Doc | Change |
|---|---|
| `AGENT-RUNTIME.md` Cross-Machine Dispatch | Add reference to Tabby's ssh2 implementation |

## Gaps surfaced

- EMA's SSH dispatch story is underspecified. Tabby shows what a real wiring looks like.

## Notes

- **Angular stack is a drawback** — EMA is React/vanilla. Read for patterns, don't port directly.
- 70k stars makes it production-credible.

## Connections

- `[[research/cli-terminal/vercel-hyper]]` — alternative reference
- `[[research/agent-orchestration/generalaction-emdash]]` — emdash's SSH model is the cleaner alternative
- `[[canon/specs/AGENT-RUNTIME]]`

#research #cli-terminal #signal-B #tabby #ssh
