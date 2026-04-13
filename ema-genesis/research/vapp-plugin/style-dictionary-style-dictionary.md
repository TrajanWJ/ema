---
id: RES-style-dictionary
type: research
layer: research
category: vapp-plugin
title: "style-dictionary/style-dictionary — Amazon design token build pipeline"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
source:
  url: https://github.com/style-dictionary/style-dictionary
  stars: 4595
  verified: 2026-04-12
  last_activity: 2026-04-10
signal_tier: A
tags: [research, vapp-plugin, signal-A, style-dictionary, design-tokens, multi-platform]
connections:
  - { target: "[[research/vapp-plugin/_MOC]]", relation: references }
  - { target: "[[research/vapp-plugin/argyleink-open-props]]", relation: references }
---

# style-dictionary/style-dictionary

> Amazon-born build system that transforms a single source of design tokens into CSS, JS, JSON, Swift, Android, Figma, and custom formats. **Tokens are SOURCE; outputs are GENERATED.**

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/style-dictionary/style-dictionary> |
| Stars | 4,595 (verified 2026-04-12) |
| Last activity | 2026-04-10 (very active) |
| Signal tier | **A** |

## What to steal

### 1. Source-of-truth design tokens

```json
{
  "color": {
    "blue": {
      "5": { "value": "#0066ff" }
    }
  }
}
```

Single JSON source. Build pipeline transforms into:
- CSS custom properties
- JS module exports
- iOS Swift constants
- Android XML resources
- Figma plugin format
- Custom formats via plugin

### 2. Build-time vs runtime split

Style Dictionary is a build tool. The output formats are runtime artifacts. EMA's tokens become a build pipeline:

```
@ema/tokens-source/         # JSON source files
  ↓ (style-dictionary build)
@ema/tokens/                 # generated multi-format outputs
  ├── css/tokens.css
  ├── js/tokens.js
  ├── json/tokens.json
  └── (future: ios, android, figma)
```

### 3. Pair with Open Props

Use `[[research/vapp-plugin/argyleink-open-props]]`'s default CSS token set NOW (zero build config). Add Style Dictionary as the build tool when EMA needs cross-platform token export (mobile vApps, browser extension, etc.).

## Changes canon

| Doc | Change |
|---|---|
| `EMA-GENESIS-PROMPT.md §3` | Tokens are source, outputs are generated — not hand-written CSS |

## Gaps surfaced

- EMA has no token SOURCE — glass colors live in `globals.css` as the canonical record. Works for Electron-only but breaks the moment you ship a mobile vApp or browser extension that needs the same palette.

## Notes

- 4.6k stars, very active.
- More powerful than Open Props for the long term; more complex to set up.
- **Phase plan: Open Props now → Style Dictionary when cross-platform is needed.**

## Connections

- `[[research/vapp-plugin/argyleink-open-props]]` — simpler alternative for v1
- `[[research/vapp-plugin/_MOC]]`

#research #vapp-plugin #signal-A #style-dictionary #design-tokens #multi-platform
