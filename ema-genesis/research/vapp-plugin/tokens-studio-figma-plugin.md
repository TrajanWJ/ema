---
id: RES-tokens-studio
type: research
layer: research
category: vapp-plugin
title: "tokens-studio/figma-plugin — design tokens as DTCG-spec JSON with theme sets"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-f
source:
  url: https://github.com/tokens-studio/figma-plugin
  stars: 1566
  verified: 2026-04-12
  last_activity: 2026-04-10
signal_tier: A
tags: [research, vapp-plugin, signal-A, tokens-studio, dtcg, themes]
connections:
  - { target: "[[research/vapp-plugin/_MOC]]", relation: references }
  - { target: "[[research/vapp-plugin/argyleink-open-props]]", relation: references }
  - { target: "[[research/vapp-plugin/style-dictionary-style-dictionary]]", relation: references }
---

# tokens-studio/figma-plugin

> Figma plugin for managing design tokens as JSON with **multi-set themes**, GitHub sync, and DTCG-spec export. The format Figma + EMA can share.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/tokens-studio/figma-plugin> |
| Stars | 1,566 (verified 2026-04-12) |
| Last activity | 2026-04-10 (v2.11.3 March 2026) |
| Signal tier | **A** |
| License | AGPL (use the format, not the plugin code) |

## What to steal

### 1. DTCG token JSON format

Their JSON schema is converging on the **W3C Design Tokens Community Group draft spec**. This is the format EMA's glass aesthetic should target so it can interop with any Figma workflow.

### 2. Theme sets

Define "dark/amber accent" vs "dark/teal accent" as **overlays on the same base token tree**. EMA's hardcoded glass levels (`.glass-ambient`, `.glass-surface`, `.glass-elevated`) become themeable at runtime once ported into Tokens Studio JSON.

### 3. GitHub sync integration

The blueprint for "edit tokens in Figma, commit to EMA repo, CI regenerates CSS vars." Closes the loop between design and code.

## Changes canon

| Doc | Change |
|---|---|
| Stack decision | "Design tokens: DTCG JSON via Tokens Studio format" |
| New `apps/tokens/` | tokens.json + script to compile to CSS custom properties; replace hardcoded hex in globals.css with `var(--ema-surface-base)` etc. |

## Gaps surfaced

- EMA's entire design system lives in `globals.css` as hex codes. **No single source of truth that Figma and code share.** Any future designer contribution requires hand-syncing two places.

## Notes

- The plugin is AGPL — using the JSON format in EMA doesn't trigger copyleft, but forking the plugin code would.
- Just consume the format.
- Pairs with `[[research/vapp-plugin/style-dictionary-style-dictionary]]` for the build pipeline.

## Connections

- `[[research/vapp-plugin/argyleink-open-props]]` — alternative simpler model
- `[[research/vapp-plugin/style-dictionary-style-dictionary]]` — build pipeline

#research #vapp-plugin #signal-A #tokens-studio #dtcg
