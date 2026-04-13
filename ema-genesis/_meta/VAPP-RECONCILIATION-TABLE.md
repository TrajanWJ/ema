---
id: META-VAPP-RECONCILIATION-TABLE
type: meta
layer: _meta
title: "vApp Reconciliation Table — side-by-side of old Tauri (48), current renderer (28 wired), and canon CATALOG (35)"
status: preliminary
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "apps/renderer/src/App.tsx + ema-genesis/vapps/CATALOG.md + ~/.local/share/ema/vault/wiki/Apps/vApp-Catalog.md"
recovered_at: 2026-04-12
connections:
  - { target: "[[vapps/CATALOG]]", relation: references }
  - { target: "[[intents/INT-FRONTEND-VAPP-RECONCILIATION]]", relation: data_source }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
tags: [meta, vapp, reconciliation, catalog, recovered, preliminary]
---

# vApp Reconciliation Table

> **Purpose:** Side-by-side comparison of three vApp catalogs that disagree. Used as source data for [[intents/INT-FRONTEND-VAPP-RECONCILIATION]]. This table is **descriptive, not prescriptive** — it says what each source has, not what the final reconciled list should be. The intent is where decisions happen.
>
> **Why a table instead of editing CATALOG.md directly:** User chose side-by-side reconciliation over fat-catalog preliminary additions. Cleaner, easier to reverse, decisions stay centralized in the intent.

## Sources

- **Tauri (48):** `~/.local/share/ema/vault/wiki/Apps/vApp-Catalog.md` (old build era)
- **Wired (28):** `apps/renderer/src/App.tsx` APP_REGISTRY (current renderer)
- **Canon (35):** `ema-genesis/vapps/CATALOG.md` (genesis canonical)

## Reconciliation table

| # | Concept | Tauri | Wired | Canon | Notes |
|---|---|---|---|---|---|
| 1 | Notes | — | — | ✅ (#1) | Canon-only. Renderer has no Notes vApp — brain dump is the capture surface. |
| 2 | Tasks / To-Do | ✅ | ✅ | ✅ (#2) | All three. Direct match. |
| 3 | Schedule / Calendar | — | — | ✅ (#3) | Canon-only. Not in old build. |
| 4 | Responsibilities | ✅ | ✅ | ✅ (#4) | All three. Direct match. |
| 5 | Brain Dumps | ✅ | ✅ | ✅ (#5) | All three. Direct match. |
| 6 | Pomodoro / Focus | ✅ | ✅ | ✅ (#6) | Renderer calls it "Focus." Direct match. |
| 7 | Time Blocking | — | — | ✅ (#7) | Canon-only. |
| 8 | Graphing / Charting | — | — | ✅ (#8) | Canon-only. |
| 9 | Whiteboard / Canvas | ✅ | ✅ + ✅ | ✅ (#9) | Renderer wires **both** Canvas and Whiteboard as separate tiles. Canon has them as one vApp. **Merge.** |
| 10 | File Manager | — | — | ✅ (#10) | Canon-only. |
| 11 | Email / Messaging | — | — | ✅ (#11) | Canon-only. |
| 12 | Journal / Log | ✅ | ✅ | ✅ (#12) | All three. Direct match. |
| 13 | Code Editor / IDE | — | — | ⚠️ (#13 DEFERRED) | Canon-only, already marked deferred. |
| 14 | Wiki Viewer | ✅ | ✅ | ✅ (#14) | Renderer calls it "Wiki." Direct match. |
| 15 | Graph Visualizer | — | — | ✅ (#15) | Canon-only. |
| 16 | Feeds | — | — | ✅ (#16) | Canon-only. |
| 17 | Research Viewer | — | — | ✅ (#17) | Canon-only. |
| 18 | Blueprint / Schematic Planner | — | ✅ | ✅ (#18) | Renderer calls it "Intent Schematic." Match canon #18, rename in renderer. |
| 19 | Agent Hub | ✅ | ✅ | ✅ (#19) | Renderer calls it "Agents." Direct match. |
| 20 | Agent Calendar | — | — | ✅ (#20) | Canon-only. |
| 21 | Agent Scratchpads | — | — | ✅ (#21) | Canon-only. |
| 22 | Agent Plans / Status | — | — | ✅ (#22) | Canon-only. |
| 23 | Agent Live View | — | — | ✅ (#23) | Canon-only. |
| 24 | Agent Comms | — | ✅ | ✅ (#24) | Renderer has "Agent Chat" — maps here. |
| 25 | Terminal | — | — | ✅ (#25) | Canon-only. |
| 26 | Machine Manager | — | — | ✅ (#26) | Canon-only. |
| 27 | Space Manager | — | — | ✅ (#27) | Canon-only. Partial SpaceSwitcher in renderer but no full vApp. |
| 28 | Team Manager | — | — | ✅ (#28) | Canon-only. |
| 29 | Settings | ✅ | ✅ | ✅ (#29) | All three. Direct match. |
| 30 | Analytics | — | — | ✅ (#30) | Canon-only. |
| 31 | Services Manager | — | — | ✅ (#31) | Canon-only. |
| 32 | Network / Peer Manager | — | — | ✅ (#32) | Canon-only. |
| 33 | Permissions | — | — | ✅ (#33) | Canon-only. May not need a vApp in v1 — could be config. |
| 34 | Comms | — | ✅ | ✅ (#34) | Renderer has "Operator Chat" — maps here (cross-space chat). |
| 35 | Notifications Hub | — | — | ✅ (#35) | Canon-only. |
| 36 | **Projects** | ✅ | ✅ | — | **System concept, not vApp.** Projects are a hierarchy level within spaces. Move to services layer, unwire. |
| 37 | **Executions** | ✅ | ✅ | — | **System concept, not vApp.** Executions are operational records. Move to services layer, unwire. |
| 38 | **Proposals** | ✅ | ✅ | — | **System concept, not vApp.** Proposals are the proposal pipeline's output. Move to services layer, unwire. |
| 39 | **Pipes** | ✅ | ✅ | — | Canon-worthy as vApp. **Add to catalog.** See [[canon/specs/PIPES-SYSTEM]]. |
| 40 | **Evolution** | ✅ | ✅ | — | **Unclear** — probably tied to Phase 3 Autonomous Reasoning. Fold into [[intents/INT-AUTONOMOUS-REASONING-PHASE3]]? |
| 41 | **Whiteboard** | ✅ | ✅ | merge | Duplicate of Canvas (#9). Merge/delete. |
| 42 | **Storyboard** | ✅ | ✅ | — | **Unclear purpose.** Needs reconciliation decision. |
| 43 | **Decision Log** | ✅ | ✅ | — | Consider adding as new canon entry. Tracks architectural decisions at project level. |
| 44 | **Campaigns** | ✅ | ✅ | — | **System concept, not vApp.** Related to proposal pipeline. Unwire. |
| 45 | **Governance** | ✅ | ✅ | — | **System concept, not vApp.** Related to approval flows. Unwire or absorb into Permissions. |
| 46 | **Babysitter** | ✅ | ✅ | — | **System concept.** See [[canon/specs/BABYSITTER-SYSTEM]]. Move to services layer. |
| 47 | **Habits** | ✅ | ✅ | — | Canon-worthy as vApp. **Add to catalog.** Paired with Pomodoro/Focus. |
| 48 | **Goals** | ✅ | ✅ | — | Canon-worthy as vApp. **Add to catalog.** Paired with Blueprint Planner. |
| 49 | **Rhythm (Temporal)** | ✅ | ✅ | — | **Unclear purpose.** Needs reconciliation decision. |
| 50 | **Voice** | ✅ | ✅ | — | **Modality, not vApp.** Voice is an input mode for Brain Dumps per canon #5. Unwire as standalone vApp. See [[canon/specs/EMA-VOICE]]. |
| 51 | **HQ** | — | ✅ | — | **Shell, not vApp.** HQ is the dual-surface shell per [[research/frontend-patterns/dual-surface-shell]]. Unwire. |
| 52 | **Operator Chat** | — | ✅ | merge #34 | Maps to Comms (#34). |
| 53 | **Agent Chat** | — | ✅ | merge #24 | Maps to Agent Comms (#24). |
| 54 | **Focus (life category)** | ✅ | ✅ | merge #6 | Same as Pomodoro (#6). Merge. |

## Summary counts (proposed dispositions)

| Disposition | Count | Items |
|---|---|---|
| Direct match across all 3 | 8 | Tasks, Responsibilities, Brain Dumps, Focus, Journal, Wiki Viewer, Agent Hub, Settings |
| Canon-only (add to renderer) | 23 | Notes, Schedule, Time Blocking, Graphing, File Manager, Email, Code Editor (deferred), Graph Visualizer, Feeds, Research Viewer, Agent Calendar, Agent Scratchpads, Agent Plans, Agent Live View, Terminal, Machine Manager, Space Manager, Team Manager, Analytics, Services Manager, Network Manager, Permissions, Notifications Hub |
| Renderer-only, add to canon | 4 | Pipes, Habits, Goals, Decision Log |
| Renderer-only, system concept (unwire, don't add) | 7 | Projects, Executions, Proposals, Campaigns, Governance, Babysitter, HQ |
| Duplicate (merge) | 3 | Whiteboard→Canvas, Operator Chat→Comms, Agent Chat→Agent Comms |
| Modality/shell confusion (unwire as vApp) | 2 | Voice (it's an input mode), HQ (it's the shell) |
| Unclear — needs decision | 3 | Evolution, Storyboard, Rhythm |

## Next actions

Handled via [[intents/INT-FRONTEND-VAPP-RECONCILIATION]]. This table is the data; the intent is the decision process.

## Related

- [[intents/INT-FRONTEND-VAPP-RECONCILIATION]] — the decision intent
- [[vapps/CATALOG]] — canonical vApp catalog (will be updated per intent outcome)
- [[_meta/SELF-POLLINATION-FINDINGS]] §B — frontend layer context

#meta #vapp #reconciliation #catalog #recovered #preliminary
