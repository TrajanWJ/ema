---
id: INT-FRONTEND-RESIZABLE-PANELS
type: intent
layer: intents
title: "Frontend resizable panels — VS Code-style splitters at every boundary, shell-level and in-vApp, per-space persistence"
status: active
kind: new-work
phase: discover
priority: high
created: 2026-04-13
updated: 2026-04-13
author: human
exit_condition: "Every shell-level boundary (Dock ↔ main ↔ inspector ↔ HQ widgets) and every in-vApp content boundary (list ↔ detail, editor ↔ preview, etc.) has a draggable resizer with min/max constraints, collapse-on-drag-to-zero, and per-space layout persistence. Works identically in Electron mode and (eventually) browser mode per iii-lite."
connections:
  - { target: "[[research/frontend-patterns/_MOC]]", relation: parent }
  - { target: "[[research/frontend-patterns/dual-surface-shell]]", relation: depends_on }
  - { target: "[[intents/INT-FRONTEND-VAPP-RECONCILIATION]]", relation: sibling }
  - { target: "[[canon/decisions/DEC-007-unified-intents-schema]]", relation: references }
tags: [intent, new-work, frontend, panels, splitters, layout, vscode, ux]
---

# INT-FRONTEND-RESIZABLE-PANELS

## The ask

The current renderer has fixed widths for the Dock, the AmbientStrip, and most vApp content areas. The user wants **VS Code-style draggable splitters everywhere** — at every shell boundary and inside every vApp's internal content layout. Drag handles at the edges of every pane; collapse to a thin rail when dragged to zero; restore on click.

## Two scopes

### Scope A — Shell-level panels

The Shell currently renders Dock + main content (per-vApp window chrome) + an optional Inspector (not yet built). Under this intent:

- **Dock ↔ main:** vertical splitter at the right edge of the Dock. Drag to widen the Dock (show labels + recents) or narrow it (icon-only, ultra-compact).
- **Main ↔ inspector:** vertical splitter at the right edge of the main pane, opening an Inspector pane on the right. Inspector is a contextual surface — for whatever vApp is active, it shows: metadata, related nodes, history, quick actions.
- **Top ↔ AmbientStrip:** the AmbientStrip stays a fixed 32px (no drag) — it's a titlebar, not a content pane.
- **Bottom ↔ status bar / terminal:** horizontal splitter at the bottom edge. Optional terminal vApp pane (per `vapps/CATALOG` #25 Terminal) docks here.

When the Inspector is dragged to zero width, it collapses to a thin rail (~6px) that the user can click to restore. Same for the bottom pane.

### Scope B — In-vApp content panels

Every vApp that has multiple content regions gets internal splitters. Examples:

- **Brain Dump:** inbox list ↔ item detail
- **Tasks:** task list ↔ task detail ↔ subtask checklist
- **Wiki:** tree ↔ note content ↔ outline
- **Intent Schematic / Blueprint:** intent tree ↔ intent body ↔ GAC queue
- **Canvas / Whiteboard:** layers panel ↔ canvas ↔ properties panel
- **Operator Chat / Agent Chat:** chat list ↔ message thread ↔ context panel
- **Pipes:** trigger list ↔ pipe definition ↔ run history
- **Settings:** category nav ↔ setting form

Every vApp picks its own internal layout. The `@ema/glass` system provides the shared splitter primitive.

## The pattern (cribbed from VS Code)

Three levels of resizability:

1. **Major regions.** Shell-level panes (Dock, main, inspector, bottom). Drag handle is 4px wide, hover-highlights to 8px with a colored bar. Dragging shows a ghost line.
2. **Internal regions.** vApp internal panes. Same handle width and hover behavior. Each region has min and max widths/heights from its content's data attributes.
3. **Collapse-on-zero.** When a region is dragged below its `minSize`, it snaps to zero (collapsed). A thin click-to-restore rail remains. The next click expands it back to its default size or its last-non-zero size.

Splitter handles are visually quiet by default (1px line in `border-glass`) and turn into a thicker accent-color bar on hover. Cursor changes to col-resize / row-resize.

## Library choice (proposed)

**Use [`react-resizable-panels`](https://github.com/bvaughn/react-resizable-panels)** for the splitter primitive. Reasoning:

- React-native, no DOM hacks
- Supports nested panels (essential for shell + in-vApp combo)
- Persistence hooks built in (we add a per-space wrapper)
- Maintained, used by Storybook, broadly tested
- Small bundle (~5KB)

Alternatives considered:
- **`react-split-pane`** — older, less actively maintained
- **Custom splitter** — more flexibility but the boilerplate is real and we have higher-value work
- **CSS grid + JS resize** — fragile under nested layouts

## Per-space layout persistence

Per [[canon/decisions/DEC-007-unified-intents-schema]] Three Truths model, the **Workspace state domain** holds non-canonical UI state. Pane sizes belong here. Storage:

- **Per-space, per-vApp, per-pane.** Key: `(space_id, vapp_id, pane_id) → size_pct`.
- **Storage:** local JSON at `.ema/workspace/panel-layouts.json` per V1-SPEC §9.
- **Lifecycle:** on resize, debounced write (100ms). On vApp open, read and apply. On space switch, swap layout snapshot.
- **Defaults:** if no saved layout for a space/vApp combo, use the vApp's declared defaults.
- **Reset:** `ema-glass` exposes a `useResetPaneLayouts(scope)` hook; vApps can offer a "reset layout" menu item.

## iii-lite compatibility

Per [[research/frontend-patterns/dual-surface-shell]], the architecture must support running the same React code in Electron and in a browser tab.

- Splitters work identically in both runtimes — they're CSS + JS, no Electron APIs.
- Pane layout storage abstracts the persistence backend: Electron mode writes to `.ema/workspace/panel-layouts.json` via the preload bridge; browser mode writes to `localStorage` keyed by space.
- Both backends sit behind one `useLayoutStorage(spaceId)` hook so vApps don't see the difference.

## Min/max + collapse behavior

| Region | minSize (px) | maxSize (px) | Default | Collapse threshold |
|---|---|---|---|---|
| Dock | 48 | 240 | 56 (icon-only) | none — dock never collapses |
| Inspector | 0 | 600 | 320 | drag below 80 → collapse to rail |
| Bottom pane | 0 | 600 | 200 | drag below 60 → collapse to rail |
| In-vApp list panes | 200 | 600 | 280 | drag below 120 → collapse to rail |
| In-vApp detail panes | 320 | unbounded | flex | never collapse |

`minSize` and `maxSize` are vApp-overridable via the splitter's props.

## Implementation plan (high level — execution defers to a proposal)

1. **Add `react-resizable-panels`** to `apps/renderer/package.json`.
2. **Create `@ema/glass/Panels`** wrapper module exposing typed `Panel`, `PanelGroup`, `PanelResizeHandle`, `useLayoutStorage(spaceId)`. Glass tokens applied to all handles.
3. **Refactor `Shell.tsx`** to use a top-level horizontal `PanelGroup` for Dock + main + inspector, and a vertical group for top + bottom.
4. **Update each wired vApp** (currently 28) to use internal `PanelGroup`s where applicable. This is the bulk of the work — per-vApp judgment.
5. **Wire the layout storage** to `.ema/workspace/panel-layouts.json` via the renderer preload bridge.
6. **Verify Electron + bowser-mode-stub** that the same component tree runs in both with no Electron-specific code in vApps.

## Gaps / open questions

- **Which vApps need internal splitters and which don't?** A simple settings panel doesn't need them. A canvas absolutely does. Per-vApp decision needed during implementation.
- **Snap points.** VS Code snaps to 25/50/75% on drag. Should we? Probably yes — gesture comfort.
- **Touch / pen support.** Splitter handles need to be touch-friendly. A 4px handle is too thin for fingers; widen on touch input.
- **Keyboard accessibility.** WCAG requires keyboard control. `react-resizable-panels` supports arrow keys; verify default behavior matches our needs.
- **Animation.** Should pane resizes animate smoothly or be instant? VS Code is instant; some other apps animate. Lean instant.
- **Storage schema migrations.** If we add a new pane to a vApp, old saved layouts won't have it. Need a defaulting strategy.
- **Per-monitor vs per-window persistence.** Multi-monitor users may want different layouts per monitor. v2+, defer.

## Why this is high-priority

The renderer is the daily-driver surface. A productivity OS without resizable panes feels rigid and constrains how each user wants to organize their attention. Every user has different ratios for list/detail, chat/context, tree/note. The cost of adding splitters once (with a shared primitive) is small; the cost of NOT having them is daily friction across every vApp forever.

## Related

- [[research/frontend-patterns/_MOC]] — parent
- [[research/frontend-patterns/dual-surface-shell]] — iii-lite compatibility constraint
- [[intents/INT-FRONTEND-VAPP-RECONCILIATION]] — must finish reconciliation before knowing which vApps get which splitters
- [[canon/decisions/DEC-007-unified-intents-schema]] — Three Truths model classifies pane sizes as workspace-state domain
- VS Code as the reference UX

#intent #new-work #frontend #panels #splitters #layout #vscode #ux
