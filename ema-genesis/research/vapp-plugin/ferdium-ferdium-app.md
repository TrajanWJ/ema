---
id: RES-ferdium
type: research
layer: research
category: vapp-plugin
title: "ferdium/ferdium-app — git-installable recipe pattern for multi-service Electron shells"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/ferdium/ferdium-app
  stars: 4170
  verified: 2026-04-12
  last_activity: 2026-04-11
signal_tier: S
tags: [research, vapp-plugin, signal-S, ferdium, recipes, git-install]
connections:
  - { target: "[[research/vapp-plugin/_MOC]]", relation: references }
  - { target: "[[research/vapp-plugin/obsidianmd-obsidian-releases]]", relation: references }
---

# ferdium/ferdium-app

> Electron shell loading N third-party services as webviews. Each "recipe" is a separate git directory with a fixed file set. **400+ recipes in production.** This is EMA's vApp distribution model in active production today.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/ferdium/ferdium-app> |
| Sibling repo | `ferdium/ferdium-recipes` (the recipe registry) |
| Stars | 4,170 (verified 2026-04-12) |
| Last activity | 2026-04-11 |
| Signal tier | **S** |

## What to steal

### 1. The `ferdium-recipes` sibling repo pattern

Each recipe is a git directory containing:
```
recipe-name/
├── package.json     # metadata + version
├── index.js         # main entry
├── webview.js       # webview-side code
├── icon.svg
└── icon@2x.png
```

EMA's `vapps/<slug>/` directory layout:
```
vapps/<slug>/
├── vapp.json        # metadata (Siyuan-style)
├── main.js          # entry
├── webview.js       # iframe-side
├── icon.svg
└── assets/
```

### 2. `ema vapp install <git-url>` command

Recipes install via git URL. EMA's CLI gets:
- `ema vapp install https://github.com/user/my-vapp` → clones to `~/.local/share/ema/vapps/<slug>/`
- `ema vapp install <slug>` → installs from registry
- `ema vapp update <slug>` → git pull
- `ema vapp uninstall <slug>` → rm -rf

### 3. Recipe hot-reload

Ferdium reloads recipes without restarting the app. The MobX `RecipesStore.ts` watches the recipes directory and re-registers. EMA's Launchpad should do the same.

### 4. 400+ recipes is the proof

Production track record. The pattern works at scale, not just in theory.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` | Adopt the directory-per-vApp layout |
| `SCHEMATIC-v0.md` | Add `~/.local/share/ema/vapps/<slug>/` install path |
| `[[canon/specs/EMA-V1-SPEC]]` | Add `ema vapp` CLI verb set |

## Gaps surfaced

- EMA canon doesn't define a git-install command. Ferdium's recipe model shows the minimal file set a vApp needs.

## Notes

- MobX (`ServicesStore.ts`, `RecipesStore.ts`) — EMA uses Zustand; direct port but worth reading how they handle recipe hot-reload.
- The fork of the Franz/Rambox lineage — keeps the multi-service-shell pattern alive.

## Connections

- `[[research/vapp-plugin/obsidianmd-obsidian-releases]]` — registry pattern cousin
- `[[research/vapp-plugin/laurent22-joplin]]` — manifest cousin
- `[[vapps/CATALOG]]`

#research #vapp-plugin #signal-S #ferdium #recipes #git-install
