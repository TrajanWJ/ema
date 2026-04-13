---
id: FRONTEND-LAUNCHPAD-ONE-THING
type: research
layer: research
title: "Launchpad One Thing Card"
status: active
created: 2026-04-12
updated: 2026-04-12
author: frontend-brainstorm
source: self
signal_tier: Port
tags: [frontend, launchpad, adhd, prioritization, self-pollination]
connections:
  - { target: "[[research/frontend-patterns/_MOC]]", relation: parent }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
  - { target: "[[vapps/CATALOG]]", relation: references }
insight: "The first surface a user sees on launch should display exactly one thing to do next, not a list of things to choose from. Decision fatigue is the first hostile force in an ADHD life OS."
---

# Launchpad One Thing Card

## What it is

A card on the Launchpad home screen that surfaces **a single top-priority item** — not a list. The card is ranked across multiple source stores (tasks, proposals, brain dumps, executions awaiting approval) and the winner is displayed with enough context that the user can act on it in one click without opening any vApp.

**Current implementation:** `apps/renderer/src/components/dashboard/OneThingCard.tsx`, consumed by `apps/renderer/src/components/layout/Launchpad.tsx` alongside greeting, date, and system stats.

## Pattern to steal (from ourselves)

This is self-pollination — the pattern already exists in the current renderer. What needs to survive the rewrite:

1. **Cross-store ranking.** The card draws from at least five stores (tasks, proposals, brain-dumps, executions, intents) and picks the winner by a priority function. The function itself is not yet formalized.
2. **One thing, not a list.** The card shows a single item. No pagination, no carousel, no "top 3." This is the core ADHD-friendly commitment.
3. **Actionable in place.** The card has an action button that advances the item (complete the task / approve the proposal / open the brain-dump for processing) without requiring a navigation into the owning vApp.
4. **Passive data pull, not push.** Nothing notifies the user that the card changed. They see it when they look at the Launchpad.

## What changes about the blueprint

- Every vApp that wants to contribute candidates to the One Thing card must expose a `priorityCandidates()` method in its widget contract (see pending `vapp-widget-contract.md`).
- The ranking function is a piece of genesis-canon behavior, not vApp-owned. It lives alongside the Launchpad spec. It should be explainable to the user ("this is why this item is on top today") and overridable per-space.
- Under the iii-lite dual-surface commitment ([[dual-surface-shell]]), the One Thing card must work identically in Electron and browser — it cannot depend on native notification APIs.

## Gaps / open questions

- **Ranking function not specified.** Current implementation's scoring is ad-hoc inside OneThingCard.tsx. Needs to become a named, testable function in the Launchpad canon spec.
- **Per-space awareness.** Should the One Thing respect the current Space dropdown, or should it fall back to cross-space when the current space is empty? Leaning: respect current space strictly.
- **"Stuck state" handling.** If the top item hasn't moved in 3 days, does the card surface a nudge ("still this?") or silently demote it? Needs a decision.
- **Focus mode interaction.** When the user is in a Focus session (vApp #6), should the One Thing card hide or switch to showing only the focused item?

## Canon integration

This node is a **precursor** to a DEC card covering the Launchpad home-screen spec. The full locked decision requires an intent + proposal in `ema-genesis/intents/`. Provisionally queued as `INT-FRONTEND-LAUNCHPAD-HQ-HOME`.

## Related

- [[dual-surface-shell]] — the One Thing card lives inside Launchpad mode of the dual-surface HQ shell
- [[_meta/SELF-POLLINATION-FINDINGS]] — master inventory of survivors from the old build
- [[vapps/CATALOG]] — the 35 vApps the card can pull from

#frontend #launchpad #adhd #prioritization #port
