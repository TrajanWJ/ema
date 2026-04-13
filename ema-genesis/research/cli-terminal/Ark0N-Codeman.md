---
id: RES-Codeman
type: research
layer: research
category: cli-terminal
title: "Ark0N/Codeman — exact EMA stack in miniature with 60fps anti-flicker pipeline"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/Ark0N/Codeman
  stars: 299
  verified: 2026-04-12
  last_activity: 2026-04-11
signal_tier: S
tags: [research, cli-terminal, signal-S, codeman, xterm-pipeline, ghost-session-recovery]
connections:
  - { target: "[[research/cli-terminal/_MOC]]", relation: references }
  - { target: "[[research/cli-terminal/microsoft-node-pty]]", relation: references }
  - { target: "[[research/cli-terminal/xtermjs-xterm_js]]", relation: references }
  - { target: "[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
---

# Ark0N/Codeman

> **Closest architectural peer to EMA's agent runtime.** Web UI managing Claude Code in tmux with the exact PTY → xterm.js pipeline EMA needs. The 60fps anti-flicker recipe is gold. Read the source for the SSE batching implementation before writing any of it yourself.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/Ark0N/Codeman> |
| Stars | 299 (verified 2026-04-12) |
| Last activity | 2026-04-11 (active) |
| Signal tier | **S** |
| Stack | Fastify + node-pty + tmux CLI + React/xterm.js |

## What to steal

### 1. The 6-layer streaming pipeline (the killer recipe)

```
PTY Output → 16ms Server Batch → DEC 2026 Wrap → SSE → Client rAF → xterm.js (60fps)
```

This is a solved anti-flicker recipe. Every step matters:
- **16ms server-side batching** prevents flooding the wire
- **DEC 2026 line wrap** preserves terminal semantics
- **SSE (Server-Sent Events)**, not WebSocket — simpler, unidirectional, browser-native
- **Client requestAnimationFrame** smooths render to 60fps
- **xterm.js** does the actual terminal emulation

EMA's frontend spec says "xterm.js" but doesn't specify the plumbing. Codeman makes it concrete.

### 2. Ghost session discovery

On daemon boot, Codeman scans for orphaned tmux sessions tagged with its environment marker. Any session that EMA spawned previously gets reattached. **EMA gets daemon-restart recovery for free** if it adopts the tag convention.

### 3. Environment-tagged session convention

Each tmux session is tagged with `EMA_DAEMON_INSTANCE_ID` so EMA never kills sessions it didn't spawn. Critical for multi-instance scenarios and accidental cleanup.

### 4. Token-aware auto-compact

Claude Code-specific: Codeman tracks context fill % and triggers `/compact` at 110k tokens, `/clear` at 140k. EMA agents should do the same.

### 5. Local-echo overlay

Keystrokes render immediately in the terminal even if the WebSocket round-trip is slow. Massive UX win for SSH-over-laggy-network scenarios.

## Changes canon

| Doc | Change |
|---|---|
| `AGENT-RUNTIME.md` | Add "Rendering Pipeline" section documenting the 6-layer pipeline as canonical. Add "Session Recovery" section with ghost discovery. |
| `vapps/CATALOG.md` Agent Live View | Mandate the anti-flicker pipeline + local-echo overlay |

## Gaps surfaced

- AGENT-RUNTIME says "xterm.js" but doesn't spell out the batching/backpressure pipeline
- No recovery story for what happens when the Electron main process crashes while agents are mid-run
- No environment tagging — agents could be killed by an unrelated EMA instance

## Notes

- **Closest stack match for EMA.** Only difference: Codeman is browser-delivered, EMA is Electron. Port the server half verbatim.
- 299 stars but daily commits. Read the source for the SSE batching implementation specifically — it's the kind of thing you do not want to redrive.

## Connections

- `[[research/cli-terminal/microsoft-node-pty]]` — the lower layer
- `[[research/cli-terminal/xtermjs-xterm_js]]` — the upper layer
- `[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]` — coordination cousin
- `[[canon/specs/AGENT-RUNTIME]]`

#research #cli-terminal #signal-S #codeman #xterm-pipeline #ghost-session-recovery
