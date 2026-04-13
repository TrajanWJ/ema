---
id: RES-siyuan
type: research
layer: research
category: vapp-plugin
title: "siyuan-note/siyuan — plugin.json manifest + multi-framework sample repos"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/siyuan-note/siyuan
  stars: 42549
  verified: 2026-04-12
  last_activity: 2026-04-11
signal_tier: S
tags: [research, vapp-plugin, signal-S, siyuan, manifest, multi-framework]
connections:
  - { target: "[[research/vapp-plugin/_MOC]]", relation: references }
  - { target: "[[research/vapp-plugin/logseq-logseq]]", relation: references }
  - { target: "[[research/vapp-plugin/laurent22-joplin]]", relation: references }
---

# siyuan-note/siyuan

> 42.5k stars. Plugin system declares compatibility via `plugin.json` with `backends` + `frontends` arrays, and ships **official sample repos for React+Vite AND Svelte+Vite**. The proof that "framework-agnostic" can be real, not aspirational.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/siyuan-note/siyuan> |
| Stars | 42,549 (verified 2026-04-12) |
| Last activity | 2026-04-11 |
| Signal tier | **S** |

## What to steal

### 1. The `plugin.json` manifest with compatibility arrays

```json
{
  "name": "my-plugin",
  "author": "...",
  "url": "...",
  "version": "1.0.0",
  "minAppVersion": "3.0.0",
  "backends": ["windows", "linux", "darwin", "all"],
  "frontends": ["desktop", "browser", "mobile"]
}
```

EMA should add a `vapp.json` with `runtimes: ["electron-desktop", "web", "mobile"]` so the Launchpad can filter/hide vApps per environment.

### 2. Official multi-framework sample repos

Siyuan maintains:
- `plugin-sample` (vanilla JS)
- `plugin-sample-vite` (vanilla + Vite)
- `plugin-sample-vite-svelte` (Svelte + Vite)

Plugin authors aren't locked into React. **EMA should publish the same: `vapp-sample-react`, `vapp-sample-svelte`, `vapp-sample-vanilla`.**

### 3. Why this matters

"Framework-agnostic" is cheap to claim and expensive to ship. Siyuan's approach — maintain separate official sample repos per framework — is the only way to prove the claim. Each sample is a working plugin with the SDK wired in correctly.

Without sample repos, every plugin author has to figure out the bundling + iframe + postMessage dance themselves. With samples, they `git clone` and edit.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` | Add `vapp.json` schema mirroring `plugin.json` |
| `EMA-GENESIS-PROMPT.md §3` | Framework-agnostic becomes concrete with sample repos |

## Gaps surfaced

- "Framework-agnostic" is cheap to claim. Without sample repos per framework, the 35 vApp catalog will end up React-only by default.

## Notes

- 42.5k stars, very active.
- TypeScript + Go.
- The sample-repo strategy is what EMA should commit to before shipping the vApp SDK.

## Connections

- `[[research/vapp-plugin/logseq-logseq]]` — SDK pattern cousin
- `[[research/vapp-plugin/laurent22-joplin]]` — process-isolation cousin
- `[[vapps/CATALOG]]`

#research #vapp-plugin #signal-S #siyuan #manifest #multi-framework
