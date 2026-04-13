---
id: RES-utility-explorer
type: research
layer: research
category: life-os-adhd
title: "mduffster/utility-explorer — weekly-flex block tracking for ADHD executive function"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-user-seeds
source:
  url: https://github.com/mduffster/utility-explorer
  stars: unknown
  verified: 2026-04-12
  last_activity: 2026
signal_tier: S
tags: [research, life-os-adhd, signal-S, weekly-flex, blocks, adhd, personal-cli, focus-coach]
connections:
  - { target: "[[research/life-os-adhd/_MOC]]", relation: references }
  - { target: "[[research/_extractions/mduffster-utility-explorer]]", relation: has_extraction }
  - { target: "[[canon/specs/HABITS]]", relation: references }
  - { target: "[[canon/specs/FOCUS-COACH]]", relation: references }
  - { target: "[[research/life-os-adhd/adrianwedd-ADHDo]]", relation: references }
---

# mduffster/utility-explorer

> Personal ADHD productivity CLI (`ue`) that tracks **weekly-flex blocks** — recurring activities with a weekly target instead of a daily binary. Blocks "at risk" surface when the math says you can't hit the weekly goal in the days remaining. This is Trajan's **primary prior art** for the EMA personal layer — the mental model comes from here.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/mduffster/utility-explorer> |
| Stars | unknown (small repo, clone succeeded) |
| Size | 492 KB |
| Language | Python (Click + Rich + SQLite + Anthropic SDK) |
| Last activity | 2026 (active) |
| License | not specified (treat as all-rights-reserved) |
| Signal tier | **S** — user's direct prior art |

## What to steal for EMA

### 1. Weekly-flex block targets (the mental model)

A "block" is a recurring activity with a **weekly** target, not a daily binary. `weekly_target = 3` means "hit Workout 3 times a week, any 3 days." `weekly_target = 0` means daily (every day). Everything else is derived:

- **Remaining** = `target - completed`
- **Slack** = `days_left - remaining` (how many more days can you skip)
- **Status** tiers:
  - `impossible` — `remaining > days_left` (can't hit it)
  - `at_risk` — `slack <= 1`
  - `try_to_do` — high/mid-priority block under halfway, or low-priority with ≤2 days slack
  - `daily_pending` — daily block not done today

This schema goes directly into EMA's `habits` or `responsibilities` domain. The existing EMA `Responsibilities` module has *cadence* + *health_score* but no explicit weekly-flex math — this is the missing piece.

### 2. The three-tier status sort (impossible > at_risk > try_to_do > daily_pending)

`ue.utils.analysis.get_at_risk_blocks()` is a 100-line function that encodes the entire mental model. It returns a sorted list of blocks needing attention, weighted by workstream priority. EMA needs this verbatim in `Ema.Responsibilities.HealthCalculator`.

### 3. Morning/evening routines (`ue am` / `ue pm`)

- `ue am` — "start your day": overdue tasks, deadlines, at-risk blocks, today's calendar, commits this week, needs-response inbox, **suggested focus** (top 1 item from the at-risk sort). One screen. No clutter.
- `ue pm` — "end your day": interactive block check-in (`Prompt.ask()` for each block with `done/skip/partial/n/a`), wins capture, tomorrow preview.

This is the core pattern: EMA needs these as first-class agent loops, not hidden behind settings.

### 4. AI focus recommendation (Anthropic Haiku)

`ue.focus.get_focus()` builds a structured context (overdue tasks, upcoming, at-risk blocks, needs-response, today's calendar), hands it to `claude-3-haiku-20240307` with a deliberately terse system prompt:

> Give ONE specific action, not a list. Consider time of day and energy (mornings often better for hard tasks). Don't moralize or add productivity platitudes.

Output format is locked: `FOCUS: [thing] / WHY: [reasoning]`. 200 tokens max. This is the **anti-sycophancy ADHD coach** EMA has been waving at.

### 5. "Effective date" with 2am day boundary

`ue.utils.dates.get_effective_date()` treats the day as rolling over at **2am**, not midnight. Running `ue pm` at 12:41am still counts as the previous day. This is the single most important small detail — EMA's journal / habits / daily notes should all respect this boundary for night-owl usability.

### 6. Workstream priority → focus ordering

Workstreams are user-defined categories (`work`, `health`, `blog`). Each has a priority (`high`/`mid`/`low`). Focus and block ordering use workstream priority to break ties. This matches EMA's existing `Projects` + prospective "life areas" model cleanly — EMA just needs to add a `priority` field.

### 7. Catchup loop

`ue catchup` — detects consecutive days where no block was logged, presents them in a list (`1. Monday, Apr 8`), lets user pick a range to backfill. This is the "I lost 3 days" recovery workflow. EMA doesn't have this anywhere — it's essential for ADHD reality.

### 8. Config-driven workstreams + repos stored in `~/.utility-explorer/config.json`

JSON file with `workstreams`, `git_repos`, `last_sync`, `git_mode`. No "setup wizard." `ue workstream add work -p high` just edits JSON. EMA has settings but they live in SQLite — for user-owned config (workstreams, tracked repos, integration preferences), JSON-at-path is more inspectable.

## Changes canon

| Canon doc | Change |
|---|---|
| `canon/specs/HABITS.md` | Add **weekly-flex target** as the primary habit type (not daily-binary). Port the 4-tier status model (impossible/at_risk/try_to_do/daily_pending). |
| `canon/specs/FOCUS-COACH.md` (new) | Create this spec. Document the "one action, no list, anti-platitude" Haiku prompt as the EMA focus coach contract. |
| `canon/specs/LIFE-OS.md` (new) | Document the `am`/`pm` routine as a first-class EMA pattern — the daily open + close loops. |
| `canon/specs/TEMPORAL.md` (new or in LIFE-OS) | Document the **2am effective date boundary** — EMA's day rolls over at 2am for night-owl usability. |
| `canon/specs/CATCHUP.md` (new, small) | Document the "I lost N days — let me backfill" workflow. |
| `intents/INT-life-layer` | Bump priority — utility-explorer proves the user already thinks in this shape. |

## Gaps surfaced

- EMA has `Ema.Responsibilities` with `cadence` + `health_score` but NO weekly-flex math. Needs a port of `get_at_risk_blocks()`.
- EMA has no morning/evening loop concept. Needs `ema am` / `ema pm` CLI verbs and a vApp equivalent.
- EMA has no focus coach. `Ema.Claude.Runner` exists but nothing stitches overdue tasks + blocks + calendar into a one-shot Haiku call.
- EMA has no "2am day boundary" — a subtle but important omission for ADHD users.
- EMA has no catchup flow. Missed days just vanish.

## Notes

- Python, not TypeScript, but everything here is small and pure — porting is mechanical.
- The whole CLI is ~2500 lines. The key logic files are `db.py` (540 lines), `commands/routines.py` (545 lines), `utils/analysis.py` (245 lines), `focus.py` (180 lines).
- Uses Click for CLI routing with command groups (`task`, `block`, `log`, `mark`, `workstream`) — same pattern as EMA's target `ema <noun> <verb>`.
- Uses Rich for terminal output (colors, panels, tables, prompts). EMA's CLI should too.
- Lazy imports inside command bodies keep `ue --help` fast (<100ms). EMA escript does this already.
- Author built it for himself ("I originally built this to help keep track of things for my ADHD brain"). Every UX decision is lived-in, not theoretical.

## Connections

- `[[research/life-os-adhd/_MOC]]`
- `[[research/_extractions/mduffster-utility-explorer]]` — source extractions
- `[[research/life-os-adhd/adrianwedd-ADHDo]]` — ADHDo is another ADHD personal OS, different shape
- `[[research/life-os-adhd/cielecki-life-navigator]]` — life-navigator has similar morning/evening loop
- `[[canon/specs/HABITS]]`
- `[[canon/specs/FOCUS-COACH]]` (to be created)
- `[[canon/specs/LIFE-OS]]` (to be created)

#research #life-os-adhd #signal-S #weekly-flex #blocks #adhd #personal-cli #focus-coach #prior-art
