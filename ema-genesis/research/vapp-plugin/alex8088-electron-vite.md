---
id: RES-electron-vite
type: research
layer: research
category: vapp-plugin
title: "alex8088/electron-vite — Vite tooling for Electron with main/preload/renderer split"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/alex8088/electron-vite
  stars: 5345
  verified: 2026-04-12
  last_activity: 2026-04-09
signal_tier: S
tags: [research, vapp-plugin, signal-S, electron-vite, build-tooling, main-preload-renderer]
connections:
  - { target: "[[research/vapp-plugin/_MOC]]", relation: references }
  - { target: "[[research/vapp-plugin/electron-react-boilerplate-electron-react-boilerplate]]", relation: references }
---

# alex8088/electron-vite

> Vite build tooling for Electron with strict main/preload/renderer separation, HMR, and source protection. The minimum viable build setup for EMA's BrowserWindow-per-vApp architecture.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/alex8088/electron-vite> |
| Stars | 5,345 (verified 2026-04-12) |
| Last activity | 2026-04-09 (very active) |
| Signal tier | **S** |

## What to steal

### 1. The main/preload/renderer project layout

```
electron-app/
├── src/
│   ├── main/          # Electron main process (Node.js)
│   │   └── index.ts
│   ├── preload/       # Preload scripts (sandbox bridge)
│   │   └── index.ts
│   └── renderer/      # Browser-side code
│       ├── index.html
│       └── src/
└── electron.vite.config.ts
```

EMA's vApp canon explicitly says "Electron BrowserWindow per vApp." The `src/main/`, `src/preload/`, `src/renderer/` split is the minimum viable structure.

### 2. Per-window preload as the SDK injection point

The `preload.ts` per window becomes the natural place to expose `@ema/core`:

```typescript
// preload.ts
import { contextBridge } from 'electron';
import { createEmaApi } from '@ema/core';

contextBridge.exposeInMainWorld('ema', createEmaApi());
```

Now the renderer's `window.ema` is typed and isolated. No `nodeIntegration: true`. No security holes.

### 3. HMR for Electron

Hot module reload across main + preload + renderer. EMA's dev loop benefits.

### 4. Source protection

Bytecode-compiled main process for production builds. Reduces obvious source exposure.

## Changes canon

| Doc | Change |
|---|---|
| `SCHEMATIC-v0.md` | The Tauri diagram needs an Electron alternative — electron-vite is the build tool |
| `EMA-GENESIS-PROMPT.md §3` | State explicitly: preload script is the SDK injection point |

## Gaps surfaced

- **CONTRADICTION resolved already (per project CLAUDE.md update):** EMA stack is Electron, not Tauri. Canon needs to delete all remaining Tauri references in `SCHEMATIC-v0.md`.

## Notes

- 5.3k stars, very active.
- Pairs with `[[research/vapp-plugin/electron-react-boilerplate-electron-react-boilerplate]]` for the IPC pattern.
- TypeScript-first.

## Connections

- `[[research/vapp-plugin/electron-react-boilerplate-electron-react-boilerplate]]` — IPC patterns
- `[[research/vapp-plugin/_MOC]]`

#research #vapp-plugin #signal-S #electron-vite #build-tooling
