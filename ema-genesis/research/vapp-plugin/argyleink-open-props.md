---
id: RES-open-props
type: research
layer: research
category: vapp-plugin
title: "argyleink/open-props — multi-format design token library (CSS, JSON, JS)"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/argyleink/open-props
  stars: 5341
  verified: 2026-04-12
  last_activity: 2026-01-31
signal_tier: A
tags: [research, vapp-plugin, signal-A, open-props, design-tokens]
connections:
  - { target: "[[research/vapp-plugin/_MOC]]", relation: references }
  - { target: "[[research/vapp-plugin/style-dictionary-style-dictionary]]", relation: references }
---

# argyleink/open-props

> Framework-agnostic CSS custom property library. Same tokens shipped as CSS, JSON, AND JS. The right shape for EMA's `@ema/tokens` package.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/argyleink/open-props> |
| Stars | 5,341 (verified 2026-04-12) |
| Last activity | 2026-01-31 (stable, not abandoned) |
| Signal tier | **A** |

## What to steal

### 1. Multi-format export

Same token set ships as:
- `open-props.css` — CSS custom properties for plain CSS users
- `open-props.json` — for build-time consumption
- `open-props.js` — for JS-side consumption (Svelte/Vue/vanilla)

EMA's glass tokens (currently in `app/src/globals.css`) become `@ema/tokens` with the same multi-format export. Each vApp imports once and gets typed access.

### 2. `postcss-jit-props` integration

Tree-shaking for tokens: only the props you actually reference get injected into your CSS. Without this, 35 vApps each ship 30KB of unused tokens. **Bundle size matters at scale.**

### 3. Sub-atomic token philosophy

Tokens are the smallest reusable unit: `--size-fluid-3`, `--shadow-2`, `--color-blue-5`. Not "primary color" — `--color-blue-5`. Composition over abstraction.

For EMA: glass surface levels (`.glass-ambient`, `.glass-surface`, `.glass-elevated`) become primitive tokens (`--ema-blur-1`, `--ema-blur-2`, `--ema-blur-3`) that compose into the named layers.

### 4. Importable via npm

`npm install open-props` → `import 'open-props'` in your CSS. Versioned. Updateable. EMA's tokens become a real dependency, not a copy-pasted file.

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §3` | Design token system is now a concrete package contract, not a CSS file |
| `vapps/CATALOG.md` | Add `@ema/tokens` to the tooling list |

## Gaps surfaced

- Current EMA tokens live inside `app/src/globals.css` — a single app. For 35 independently-loaded vApps, tokens need to be their own npm/git package so every vApp imports once and automatically gets theme updates.

## Notes

- `postcss-jit-props` is the killer feature — tokens injected only for props you reference.
- Stable, not abandoned (last commit January 2026 is fine for a token library).

## Connections

- `[[research/vapp-plugin/style-dictionary-style-dictionary]]` — multi-platform alternative
- `[[research/vapp-plugin/_MOC]]`

#research #vapp-plugin #signal-A #open-props #design-tokens
