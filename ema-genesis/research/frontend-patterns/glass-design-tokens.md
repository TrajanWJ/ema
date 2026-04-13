---
id: FRONTEND-GLASS-DESIGN-TOKENS
type: research
layer: research
title: "Glass Design Tokens (recovered) — void/base/surface tiers, opacity scale, blur layers, per-vApp accents"
status: preliminary
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/app/README.md + IGNORE_OLD_TAURI_BUILD/app/FRONTEND-FIXES.md + apps/renderer/src/styles/globals.css"
recovered_at: 2026-04-12
source: self
signal_tier: Port
connections:
  - { target: "[[research/frontend-patterns/_MOC]]", relation: parent }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
  - { target: "[[research/frontend-patterns/dual-surface-shell]]", relation: references }
tags: [frontend, glass, design-tokens, colors, typography, recovered, preliminary]
---

# Glass Design Tokens

## Core palette

| Token | Value | Purpose |
|---|---|---|
| `void` | `#060610` | Deepest background — behind everything |
| `base` | `#0A0C14` | Second layer — window interior |
| `surface-1` | `rgba(14, 16, 23, 0.40)` + 6px blur | Ambient — lightest glass tier (AmbientStrip) |
| `surface-2` | `rgba(14, 16, 23, 0.55)` + 20px blur | Standard — default vApp surface |
| `surface-3` | `rgba(14, 16, 23, 0.65)` + 28px blur | Elevated — modals, dropdowns, command bar |
| `border-glass` | `rgba(255, 255, 255, 0.06)` | 1px border on all glass surfaces |

## Opacity scale (text)

| Level | Opacity | Use |
|---|---|---|
| primary | 0.87 | Body text, primary labels |
| secondary | 0.60 | Secondary labels, timestamps |
| tertiary | 0.40 | Metadata, captions |
| muted | 0.25 | Placeholder, disabled, hints |

## Accent colors (per vApp)

Four core accents + any number of per-vApp overrides:

| Token | Value | Default vApps |
|---|---|---|
| `accent-primary` | `#2DD4A8` (teal) | Projects, Goals |
| `accent-secondary` | `#6B95F0` (blue) | Brain Dump, Tasks |
| `accent-tertiary` | `#A78BFA` (purple) | Proposals, Decisions |
| `accent-warning` | `#F59E0B` (amber) | Blockers, warnings |

Constraint: max 8 unique accents across the 35-vApp catalog. WCAG AA required on the void background.

## Typography

- **Sans:** system-ui stack (fallback: -apple-system, BlinkMacSystemFont, sans-serif)
- **Mono:** JetBrains Mono (fallback: SF Mono, Monaco, Menlo, monospace)

## The three glass classes (CSS contract)

Currently in `apps/renderer/src/styles/globals.css`:

```css
.glass-ambient   { background: var(--surface-1); backdrop-filter: blur(6px);  border: 1px solid var(--border-glass); }
.glass-surface   { background: var(--surface-2); backdrop-filter: blur(20px); border: 1px solid var(--border-glass); }
.glass-elevated  { background: var(--surface-3); backdrop-filter: blur(28px); border: 1px solid var(--border-glass); }
```

## Target package: `@ema/tokens`

Per [[_meta/SELF-POLLINATION-FINDINGS]] §A TIER REPLACE, this single-file CSS becomes the `@ema/tokens` npm package, built with [[research/vapp-plugin/argyleink-open-props|Open Props]] + `style-dictionary`. Package exports multiple formats (CSS custom properties, JSON, TypeScript constants) so vApps can consume tokens in whichever shape fits.

Motivation for package-over-file:
- The 35 vApps need shared tokens via npm import, not file copy
- Tree-shaking via postcss-jit-props (per SELF-POLLINATION TIER REPLACE note)
- Type safety for TypeScript vApps
- Tokens as a versioned dependency, not a global CSS import

## Rationale

The glass aesthetic is **EMA's design identity**. It's not decorative — it's the visual anchor that makes the app feel like a thinking space rather than a productivity spreadsheet. Dark-mode-only in v1 (explicit commitment in [[_meta/SELF-POLLINATION-FINDINGS]] §B.6 gaps section).

The 3-tier surface model maps to a natural mental hierarchy: ambient surfaces (titlebar, dock) recede, standard surfaces (vApp content) are the working layer, elevated surfaces (modals, command bar) demand attention.

## Gaps / open questions

- **Exact Open Props mapping.** Which Open Props primitives map to which EMA tokens?
- **Per-vApp accent assignment algorithm.** How are accents chosen per vApp? Hand-picked, or computed from vApp metadata?
- **Light mode.** Explicitly deferred to v2+ per SELF-POLLINATION §B.6. Needs a DEC card to lock the deferral.
- **Platform-specific adjustments.** macOS and Linux handle backdrop-filter differently; Windows may need a fallback.

## Related

- [[research/frontend-patterns/_MOC]] — parent
- [[research/frontend-patterns/dual-surface-shell]] — iii-lite commitment; tokens must work in both Electron and browser
- [[_meta/SELF-POLLINATION-FINDINGS]] §A TIER REPLACE entry for glass CSS
- Original source: `apps/renderer/src/styles/globals.css` + old build's `app/README.md`

#frontend #glass #design-tokens #colors #typography #recovered #preliminary
