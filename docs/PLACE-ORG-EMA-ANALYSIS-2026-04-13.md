# PLACE.ORG -> EMA Import Analysis

Date: 2026-04-13
Status: pattern-donor analysis for EMA day-1 human use

## What `place.org` gets right

`place.org` is strongest where it reduces friction for a human operator:

- fast ambient capture
- strong app registry / launcher conventions
- clear cross-surface handoff between capture, tasks, and journal
- local-first ownership signals like export/import/reset
- a desktop shell that makes tools feel immediately reachable

Its strongest productivity stack is:

`quick capture -> inbox -> tasks / journal / notes -> focus`

## What EMA already does better

EMA already has the more truthful operational spine:

- real backend services for:
  - `brain-dump`
  - `tasks`
  - `goals`
  - `calendar`
  - `user-state`
  - `human-ops`
- a backend-backed `human_ops_day`
- backend-derived `daily_brief` and `agenda`
- agent schedule shown inside the same day frame as human commitments

That means EMA should copy `place.org` workflow patterns, not its desktop theatrics.

## What EMA should import

### 1. Ambient capture from anywhere

This is the highest-leverage pattern for day-1 use.

If capture only exists inside a dedicated app, the system loses the moment when
the operator actually remembers the thing.

Imported now:

- global quick capture overlay in the renderer shell
- shortcut: `Ctrl+Shift+Space`
- truthful destinations only:
  - `Brain Dump`
  - `Task`
  - `Today Note`

### 2. Registry-level surface discipline

`place.org` benefits from a strong app contract. EMA already has the beginnings
of this with `APP_CONFIGS`, the Launchpad registry, and shell routing.

EMA should keep moving toward:

- one capability map for product surfaces
- one source of shell labels / icons / status
- fewer stale life surfaces presented as first-class truth

### 3. Cross-surface handoff

EMA should treat routing as a product feature:

- capture can become inbox or task
- task and calendar should feed day context
- review should turn back into scheduling, de-scoping, or delegation

### 4. Ownable local system behavior

`place.org`’s backup/reset/export direction is worth copying later, but only
after EMA’s current day/task/calendar spine is more stable.

## What EMA should not copy

- desktop-environment mimicry as a product center
- placeholder apps that look real but are not backed by domain truth
- duplicate persistence planes for the same object
- a detached journal/focus/responsibility stack that floats beside real work
- generic settings tables used as business-data storage

## Current EMA product implication

The day-1 center remains:

- `Desk`
- `Agenda`
- `Brain Dump`
- `Tasks`
- `Goals`

Older `Journal`, `Focus`, `Responsibilities`, and `Habits` shells should not be
treated as more authoritative than the active Human Ops stack until they are
re-verified against a live backend owner.

## Immediate next imports after this pass

1. Make Launchpad and Dock reflect the truthful center of gravity around `Desk`, `Agenda`, `Brain Dump`, `Tasks`, and `Goals`.
2. Keep improving `Agenda` as the single schedule action surface over `calendar_entries`.
3. Add review/recovery read models before adding new standalone life objects.
4. Reconnect notes/wiki only after their trust boundary is re-verified.
