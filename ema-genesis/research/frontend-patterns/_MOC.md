---
id: RESEARCH-FRONTEND-PATTERNS-MOC
type: moc
layer: research
title: "Frontend Patterns — Map of Content"
status: active
created: 2026-04-12
updated: 2026-04-12
author: frontend-brainstorm
tags: [moc, research, frontend, ui, self-pollination]
connections:
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: parent }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
  - { target: "[[vapps/CATALOG]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
---

# Frontend Patterns — Map of Content

> This category is **self-pollination**, not cross-pollination. The nodes under this folder document UI concepts already present in the old Tauri build or the current in-progress Electron renderer that deserve first-class record as genesis nodes. Some entries reference external repos; most are EMA-native patterns being formally captured.

## Scope

This category covers anything below the shell-chrome line — Launchpad, HQ (the widget dashboard), Dock, CommandBar, AmbientStrip, AppWindowChrome, the glass design system, vApp shell contracts, and interaction models like keyboard chords, voice, and approval flows.

It does NOT cover: backend/daemon concerns, CRDT/sync (see [[research/p2p-crdt/_MOC|p2p-crdt]]), knowledge graph rendering (see [[research/knowledge-graphs/_MOC|knowledge-graphs]]), or research ingestion UI (see [[research/research-ingestion/_MOC|research-ingestion]]).

## Nodes

| Node | What it is | Status | Signal |
|---|---|---|---|
| [[launchpad-one-thing-card]] | Single-priority card on the Launchpad home screen surfacing the most urgent item from tasks / proposals / brain dumps | Port | Self |
| [[dual-surface-shell]] | iii-lite commitment: one React codebase, two runtime targets (Electron window + browser tab), ship Electron-first with SDK discipline enforced from day one | Decision-precursor | Self |

## Pending nodes (to be added as design work progresses)

- `dock-iconic-nav.md` — vertical iconic app launcher, active-state indicator, tooltip delay
- `command-bar-omni-search.md` — cmd+k surface, category weighting, result ranking
- `ambient-strip-titlebar.md` — custom 32px titlebar, glass-ambient class, drag region semantics
- `app-window-chrome.md` — per-app frame with accent color stripe
- `glass-design-tokens.md` — void/base/surface tiers, opacity scale, blur layers
- `hq-tiled-zones.md` — HQ dashboard layout model (tiled zones, vApp widget view, per-space layouts)
- `vapp-widget-contract.md` — how a vApp exposes its widget view to HQ
- `space-org-chrome-dropdowns.md` — nested Space navigator as two flat dropdowns

## Related

- [[_meta/SELF-POLLINATION-FINDINGS]] — the master inventory this category pollinates into
- [[vapps/CATALOG]] — the canonical vApp list (35 entries)
- [[research/vapp-plugin/_MOC|vapp-plugin]] — external vApp/plugin architectures to steal from

#moc #research #frontend #self-pollination
