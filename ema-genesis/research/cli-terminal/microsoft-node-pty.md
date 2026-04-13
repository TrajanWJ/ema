---
id: RES-node-pty
type: research
layer: research
category: cli-terminal
title: "microsoft/node-pty — official Node.js pseudoterminal library from VSCode team"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/microsoft/node-pty
  stars: 1867
  verified: 2026-04-12
  last_activity: 2026-04-06
  license: MIT
signal_tier: A
tags: [research, cli-terminal, signal-A, node-pty, pty, microsoft]
connections:
  - { target: "[[research/cli-terminal/_MOC]]", relation: references }
  - { target: "[[research/cli-terminal/Ark0N-Codeman]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
---

# microsoft/node-pty

> The official Node.js pseudoterminal library from Microsoft (VSCode terminal team). **Non-negotiable dependency** for EMA's agent runtime.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/microsoft/node-pty> |
| Stars | 1,867 (verified 2026-04-12) |
| Last activity | 2026-04-06 |
| Signal tier | **A** |
| License | MIT |
| Maintained by | VSCode terminal team |

## What to steal

### 1. The canonical API

```typescript
import * as pty from 'node-pty';

const proc = pty.spawn('claude', ['--print', '--output-format', 'stream-json'], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: '/home/user/project',
  env: process.env,
});

proc.onData((data) => {
  // bytes from the child's stdout
});

proc.write('hello\n');
proc.resize(120, 40);
proc.kill();
```

Just use it. AGENT-RUNTIME.md already names node-pty; no reason to invent.

### 2. Cross-platform support

- **Linux/macOS**: native pty
- **Windows**: ConPTY (Windows 10 1809+)

Canon says "Linux first, macOS second" — node-pty gives Windows for free if EMA later wants it. Worth noting.

### 3. TypeScript typings

`typings/node-pty.d.ts` are the exact signatures EMA should wrap. Type-safe out of the box.

### 4. VSCode is the production battle-test

VSCode's integrated terminal runs on node-pty. Same library, same maintainer team. The `[[research/cli-terminal/Ark0N-Codeman]]` 60fps streaming pipeline sits on top of node-pty.

## Changes canon

| Doc | Change |
|---|---|
| `AGENT-RUNTIME.md` line 132 | Already names node-pty. No change — confirming the pick is correct. |

## Gaps surfaced

- None — canon already picks this. Node included as prior-art anchor.

## Notes

- Maintained by the VSCode terminal team. Same team that owns xterm.js. Use both together.
- Native binding compilation — `electron-builder` needs the right native module config (see `[[research/vapp-plugin/alex8088-electron-vite]]` for the build template).

## Connections

- `[[research/cli-terminal/Ark0N-Codeman]]` — production pipeline using node-pty
- `[[research/cli-terminal/xtermjs-xterm_js]]` — terminal renderer that consumes node-pty output
- `[[research/cli-terminal/vercel-hyper]]` — reference Electron+pty integration
- `[[canon/specs/AGENT-RUNTIME]]`

#research #cli-terminal #signal-A #node-pty #microsoft
