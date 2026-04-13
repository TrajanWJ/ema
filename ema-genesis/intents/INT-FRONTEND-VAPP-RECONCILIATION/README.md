---
id: INT-FRONTEND-VAPP-RECONCILIATION
type: intent
layer: intents
title: "vApp reconciliation — align old build's 48-vApp Tauri catalog with canon's 35-vApp catalog and the renderer's 28 wired tiles"
status: preliminary
kind: reconciliation
phase: discover
priority: critical
created: 2026-04-12
updated: 2026-04-12
author: frontend-brainstorm
exit_condition: "For each of the ~60 distinct vApp concepts across all three sources, a classification exists: (1) first-class canon vApp — add to CATALOG.md or merge into existing entry; (2) system/backend concept miscategorized as vApp — move to the service layer, unwire from renderer; (3) dead — delete from renderer, archive in executions. Every decision has a rationale. Renderer, canon CATALOG, and the recovered old-build inventory converge on one list."
connections:
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
  - { target: "[[vapps/CATALOG]]", relation: modifies }
  - { target: "[[research/frontend-patterns/_MOC]]", relation: references }
tags: [intent, reconciliation, vapp, catalog, frontend, critical, preliminary]
---

# INT-FRONTEND-VAPP-RECONCILIATION

## The problem

Three sources disagree about what a vApp is:

| Source | Count | Examples unique to it |
|---|---|---|
| Current renderer (`apps/renderer/src/App.tsx`) | 28 wired | Operator Chat, Agent Chat, Evolution, Campaigns, Governance, Babysitter, Storyboard, Decisions, Rhythm, Goals, HQ (as vApp), Voice (as vApp), Intent Schematic, Projects, Executions, Proposals |
| Canon catalog (`vapps/CATALOG.md`) | 35 listed | Notes, Schedule, Pomodoro, Time Blocking, File Manager, Email, Feeds, Research Viewer, Terminal, Machine Manager, Space Manager, Team Manager, Analytics, Services Manager, Network Manager, Permissions, Comms, Notifications Hub |
| Old Tauri build (wiki `Apps/vApp-Catalog.md`) | 48 total | Roughly the union of the above plus some |

The "28 vs 35" framing is wrong — the sets barely overlap. This is a **three-way reconciliation**, not a delta fill.

## What this intent does

For each distinct vApp concept across all three sources, classify:

1. **Canon vApp** — belongs in `vapps/CATALOG.md`. Either already there (verify spec) or needs to be added as a new numbered entry 36+.
2. **System concept, not a vApp** — Governance, Babysitter, Evolution, Campaigns may be better modeled as daemon subsystems than user-facing apps. Move to `services/` layer, don't list in the user catalog. Unwire from renderer if still present.
3. **Duplicate or alias** — e.g., "Canvas" and "Whiteboard" may be two names for the same catalog #9. Merge.
4. **Dead** — concept from the old build that isn't part of the new direction. Delete from renderer, archive mention in `_meta/SELF-POLLINATION-FINDINGS`.

## Scope note

This intent produces **decisions**, not code. The output is a reconciliation table (probably `_meta/VAPP-RECONCILIATION-TABLE.md`) and CATALOG.md edits. Actual wiring/unwiring of vApps in `apps/renderer/` is downstream work that follows from the reconciliation.

## Why critical

Every other frontend design decision (Launchpad tile grid, HQ dashboard widget sources, Dock icon list, CommandBar category scoring) depends on having **one** agreed-upon vApp list. Until this reconciles, "bring Launchpad to 35 tiles" is ambiguous because we don't know which 35.

## Gaps / open questions

- **Who decides for "system concept, not a vApp"?** This requires distinguishing user-facing surfaces from internal daemon mechanics, which is a judgment call. Needs a rule.
- **Does Permissions (catalog #33) need a UI at all in v1,** or does it live as config files? Similar question for Machine Manager, Services Manager, Network Manager — these are sysadmin-flavored and may not need first-class vApps.
- **HQ-as-vApp wiring in the current renderer.** HQ is the shell, not a vApp. The fact that it's wired as a tile in App.tsx is a remnant from when HQ was conceptually different. Reconciliation should remove it from vApp status.
- **Old build's 48 vApps** — the wiki claims 48. The actual tile count in the old Tauri app might differ. Needs verification.

## Related

- [[_meta/SELF-POLLINATION-FINDINGS]] §B — frontend layer inventory
- [[vapps/CATALOG]] — target of edits
- [[research/frontend-patterns/_MOC]] — frontend patterns subtree

#intent #reconciliation #vapp #catalog #frontend #critical #preliminary
