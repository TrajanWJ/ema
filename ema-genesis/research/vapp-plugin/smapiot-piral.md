---
id: RES-piral
type: research
layer: research
category: vapp-plugin
title: "smapiot/piral — micro-frontend framework with pilet + shell API"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/smapiot/piral
  stars: 1902
  verified: 2026-04-12
  last_activity: 2026-04-07
signal_tier: A
tags: [research, vapp-plugin, signal-A, piral, micro-frontend, pilet]
connections:
  - { target: "[[research/vapp-plugin/_MOC]]", relation: references }
  - { target: "[[research/vapp-plugin/logseq-logseq]]", relation: references }
---

# smapiot/piral

> React-based framework for shipping "pilets" — independently-built micro-frontend modules that register into a shell at runtime with a shared API. Nearly 1:1 with EMA's Launchpad + vApps + `@ema/core` SDK triangle.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/smapiot/piral> |
| Stars | 1,902 (verified 2026-04-12) |
| Last activity | 2026-04-07 (very active) |
| Signal tier | **A** |

## What to steal

### 1. The pilet + shell API model

```typescript
// pilet entry
export const setup = (api: PiletApi) => {
  api.registerTile('my-tile', MyTileComponent);
  api.registerPage('/my-page', MyPageComponent);
  api.registerMenuItem('Settings', MyMenuItem);
};
```

The shell exposes `PiletApi`. Pilets register tiles, menu items, pages, modals, notifications. EMA's `@ema/core` SDK should look exactly like this.

### 2. The pilet-api method names

Read Piral's `pilet-api` documentation before naming the EMA SDK methods. Likely already-solved 80% of the surface:
- `registerTile`
- `registerPage`
- `registerMenu`
- `registerNotification`
- `getCurrentUser`
- `getData` / `setData`
- `connect` / `disconnect`

EMA shouldn't reinvent these names.

### 3. Independent build + deployment per pilet

Each pilet builds independently with its own bundler and deploys as a single JS file. The shell loads them at runtime. EMA's git-installable vApps work the same way: each vApp builds itself, ships a bundle, the Launchpad loads it.

### 4. "Browser-first but the patterns translate to Electron"

Piral was designed for browser micro-frontends but the architectural concepts translate directly to Electron BrowserWindows. Treat each BrowserWindow as a "pilet" container.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` | Stub an `@ema/core` API surface doc with method names stolen from Piral |
| `EMA-GENESIS-PROMPT.md §3` | Launchpad is a "shell" (Piral vocabulary), not a "home window" |

## Gaps surfaced

- EMA canon has no document listing the `@ema/core` API surface. Piral's pilet-api documentation is the template.

## Notes

- 1.9k stars, very active.
- Browser-first but the architectural concepts translate.
- TypeScript-friendly.

## Connections

- `[[research/vapp-plugin/logseq-logseq]]` — SDK pattern cousin
- `[[research/vapp-plugin/_MOC]]`

#research #vapp-plugin #signal-A #piral #micro-frontend
