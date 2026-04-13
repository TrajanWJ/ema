---
id: INT-SPRINT-2026-04-07
type: intent
layer: intents
title: "Sprint priorities from 2026-04-07 — CLI docs, intent triage, ExecutionsApp, north-star goals, HQ context"
status: preliminary
kind: historical-sprint
phase: archive
priority: medium
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/.superman/intents/current-sprint-priorities-2026-04-07-1-improve-cli-docum/"
recovered_at: 2026-04-12
original_author: human
original_date: "2026-04-07"
exit_condition: "This intent is archival — it captures what was on the sprint board as of 2026-04-07 in the old build. Exit is 'historical context preserved.' Individual sprint items that remain relevant should fork into their own intents."
connections:
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
tags: [intent, historical-sprint, archive, cli, recovered, preliminary]
---

# INT-SPRINT-2026-04-07 — Historical Sprint Board

## Original intent text (verbatim)

> Current sprint priorities (2026-04-07): 1) Improve CLI documentation and UX — help text, examples, error messages for all 23+ subcommands. 2) Triage 16 queued intent proposals. 3) Build ExecutionsApp frontend (P2). 4) Define north-star goals. 5) Harden HQ project context contract.

## Status

**Archival.** This sprint was active in the old Elixir build as of 2026-04-07. The old build has since been archived under `IGNORE_OLD_TAURI_BUILD/`. This intent preserves the sprint board for historical context but is not itself an active work item in the rebuild.

Individual line items that still matter in the rebuild should become their own intents. Analysis below.

## Per-item disposition for the rebuild

| # | Original item | Still relevant? | Disposition |
|---|---|---|---|
| 1 | Improve CLI documentation and UX for 23+ subcommands | **Yes** — the new CLI has equivalent surface area and the same UX gap | Fork into `INT-CLI-DOCS-SPRINT` when CLI port matures |
| 2 | Triage 16 queued intent proposals | **No** — those 16 proposals were in the old system and are gone with it | Skip. The new build starts with zero queued. |
| 3 | Build ExecutionsApp frontend | **Yes but reshaped** — ExecutionsApp was one of the 28 wired vApps in the old renderer. Under [[_meta/SELF-POLLINATION-FINDINGS]] §B catalog reconciliation, Executions is a system concept, not necessarily a first-class vApp in canon. | Fold into `INT-FRONTEND-VAPP-RECONCILIATION` |
| 4 | Define north-star goals | **Yes** — the rebuild needs these. | Fork into `INT-NORTH-STAR-GOALS` |
| 5 | Harden HQ project context contract | **Partial** — HQ as a separate web frontend is being absorbed into the iii-lite dual-surface shell. The "project context contract" concept survives but its implementation changes. | Fold into `INT-FRONTEND-VAPP-SDK-CONTRACT` |

## Why preserve this archivally

Sprint boards rot fast. But **what was on your sprint board last week** is also one of the best signals of **what you thought mattered** — and the rebuild should be informed by those priorities even if it doesn't execute them verbatim. This intent exists so the analysis table above doesn't get lost when the old build is eventually deleted.

## Related

- [[_meta/SELF-POLLINATION-FINDINGS]] — inventory the new build derives from
- Pending: `INT-CLI-DOCS-SPRINT`, `INT-NORTH-STAR-GOALS`, `INT-FRONTEND-VAPP-RECONCILIATION`, `INT-FRONTEND-VAPP-SDK-CONTRACT` — forks from this intent

#intent #historical-sprint #archive #recovered #preliminary
