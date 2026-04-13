---
id: RES-electron-react-boilerplate
type: research
layer: research
category: vapp-plugin
title: "electron-react-boilerplate/electron-react-boilerplate — typed IPC pattern reference"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/electron-react-boilerplate/electron-react-boilerplate
  stars: 24233
  verified: 2026-04-12
  last_activity: 2025-09-22
signal_tier: A
tags: [research, vapp-plugin, signal-A, erb, ipc, typed]
connections:
  - { target: "[[research/vapp-plugin/_MOC]]", relation: references }
  - { target: "[[research/vapp-plugin/alex8088-electron-vite]]", relation: references }
---

# electron-react-boilerplate

> Canonical Electron + React + TypeScript starter. The **typed IPC event catalog pattern** is what EMA needs to prevent the Joplin "stringly-typed proxies" problem.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/electron-react-boilerplate/electron-react-boilerplate> |
| Stars | 24,233 (verified 2026-04-12) |
| Last activity | 2025-09-22 (maintenance mode but not dead) |
| Signal tier | **A** |

## What to steal

### 1. The typed IPC pattern

```typescript
// shared/ipc-types.ts — single source of truth
export type IpcChannels = {
  'graph:query': {
    request: { dql: string };
    response: { results: Object[] };
  };
  'intent:create': {
    request: { title: string; priority: Priority };
    response: { id: string };
  };
};

// main/ipc.ts
ipcMain.handle('graph:query', async (_, { dql }) => {
  return await graph.query(dql);
});

// renderer/ipc.ts (via preload)
const result = await window.ema.invoke('graph:query', { dql: '...' });
```

`ipcMain.handle` + `ipcRenderer.invoke` typed end-to-end via the shared `IpcChannels` type. **Compile-time errors if you mismatch.**

### 2. Auto-update integration

Built-in autoUpdater wiring. EMA needs a similar update mechanism eventually.

### 3. Production build config

Webpack + electron-builder + native module handling. EMA can crib the config wholesale.

## Changes canon

| Doc | Change |
|---|---|
| `SCHEMATIC-v0.md` | IPC call surface needs a TypeScript contract doc, not just a prose description |

## Gaps surfaced

- **Typed IPC is a hard prerequisite EMA has not committed to.** Without it, SDK calls decay into untyped postMessage strings and every vApp reinvents its own wrapper.

## Notes

- Maintenance mode (last commit Sep 2025) — older but pattern is stable
- 24k stars makes it the canonical reference even if updates have slowed
- Combine with `[[research/vapp-plugin/alex8088-electron-vite]]` for Vite-based builds + ERB's IPC patterns

## Connections

- `[[research/vapp-plugin/alex8088-electron-vite]]` — modern alternative build tool
- `[[research/vapp-plugin/_MOC]]`

#research #vapp-plugin #signal-A #erb #ipc #typed
