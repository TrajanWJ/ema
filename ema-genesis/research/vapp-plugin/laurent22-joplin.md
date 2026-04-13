---
id: RES-joplin
type: research
layer: research
category: vapp-plugin
title: "laurent22/joplin — Electron notes app with per-plugin BrowserWindow + iframe sandboxing"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/laurent22/joplin
  stars: 54309
  verified: 2026-04-12
  last_activity: 2026-04-12
signal_tier: S
tags: [research, vapp-plugin, signal-S, joplin, plugin-runtime, sandboxing]
connections:
  - { target: "[[research/vapp-plugin/_MOC]]", relation: references }
  - { target: "[[research/vapp-plugin/logseq-logseq]]", relation: references }
  - { target: "[[vapps/CATALOG]]", relation: references }
---

# laurent22/joplin

> 54k stars. The best-documented open-source sandboxing for a desktop note app. **Per-plugin BrowserWindow with iframe webviews + IPC proxy** is the exact pattern EMA needs for vApp isolation.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/laurent22/joplin> |
| Stars | 54,309 (verified 2026-04-12) |
| Last activity | 2026-04-12 |
| Signal tier | **S** |
| Stack | Electron + TypeScript + React Native (mobile) |

## What to steal

### 1. Plugin Runner pattern

Each plugin's main entry loads in a dedicated BrowserWindow. Any UI surface inside that window is a sandboxed iframe with `postMessage` to the plugin host. The "proxy converts the call to a plain string and uses IPC" approach is the exact isolation boundary EMA should build between vApp code and the EMA Core API.

### 2. Two-layer isolation model

```
┌─────────────────────────────────────┐
│  Main Process                       │
│  ↕  (typed IPC over preload bridge) │
│  Plugin Process (BrowserWindow)     │
│  ↕  (postMessage proxy)             │
│  Plugin UI (iframe webview)         │
└─────────────────────────────────────┘
```

Plugin code runs in a separate process. UI runs in a sandboxed iframe inside that process. EMA's vApps need both layers if third-party vApps are ever going to ship.

### 3. Plugin manifest + npm-packaged distribution

```json
{
  "manifest_version": 1,
  "id": "com.author.plugin-name",
  "app_min_version": "1.0",
  "version": "1.0.0",
  "name": "Plugin Name",
  "description": "...",
  "author": "...",
  "homepage_url": "...",
  "repository_url": "...",
  "keywords": [...]
}
```

Standardized manifest. EMA's `vapp.json` should follow this shape.

### 4. RemoteMessenger per channel

Joplin's mobile architecture uses `RemoteMessenger` subclasses per channel — directly portable to EMA if vApps ever go mobile. Editor, renderer, dialogs each in their own process with typed message-passing.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §3` | Add per-vApp process isolation requirement |
| `SCHEMATIC-v0.md` | Add IPC proxy layer between Core and vApps |
| `vapps/CATALOG.md` | Adopt Joplin-style two-layer isolation |

## Gaps surfaced

- EMA canon treats each vApp as "its own BrowserWindow" but never specifies whether the vApp code runs in the window's main process context or a sandboxed renderer. Joplin shows the two-layer model is necessary if you want to run untrusted third-party vApps later.

## Notes

- TypeScript + React Native (close to EMA's stack).
- The plugin API docs at joplinapp.org are the reference text. Read before designing EMA's vApp SDK.

## Connections

- `[[research/vapp-plugin/logseq-logseq]]` — SDK pattern cousin
- `[[research/vapp-plugin/siyuan-note-siyuan]]` — manifest cousin
- `[[research/vapp-plugin/obsidianmd-obsidian-releases]]` — git-install cousin
- `[[vapps/CATALOG]]`

#research #vapp-plugin #signal-S #joplin #plugin-runtime #sandboxing
