# Golden Path: Goals And Calendar

This is the current operational planning path.

Use it for:

- human goals
- agent goals
- human schedule items
- agent virtual calendar blocks
- phased buildouts for agent work
- goal-linked proposals and executions

## Source Of Truth

- Goals live in SQLite table `goals`.
- Schedule and virtual planning blocks live in SQLite table `calendar_entries`.
- `intent_slug` is a bridge back to canon-backed intent truth.

These are operational planning objects. They do not replace `ema-genesis` intents.

## Goal-Driven Delivery Loop

The current active delivery slice is:

`goal -> proposal -> buildout -> execution -> result -> intent writeback`

Use the active backend CLI surfaces for this loop:

1. Create the runtime intent on the backend if it does not already exist.
2. Create a goal linked to that runtime intent.
3. Generate a durable proposal from that goal.
4. Approve the proposal on the active backend.
5. Create an agent buildout for phased work.
6. Start execution from the goal or directly from the approved proposal.
7. Transition execution phases, attach result evidence, and complete it.

Golden path example:

```bash
ema backend flow create-intent \
  --slug runtime-proposal-intent \
  --title "Drive a goal-linked planning slice" \
  --level execution \
  --kind implement \
  --status active \
  --actor-id actor_owner \
  --exit-condition "Execution completed with result evidence" \
  --scope services/core/goals/** services/core/calendar/**

ema goal create \
  --title "Strategist delivers backend planning slice" \
  --timeframe weekly \
  --owner-kind agent \
  --owner-id strategist \
  --intent runtime-proposal-intent

ema goal propose <goal_id> --actor-id strategist
ema goal context <goal_id>

ema backend proposal approve <proposal_id> --actor-id actor_owner

ema goal buildout <goal_id> \
  --start-at 2026-04-13T16:00:00.000Z \
  --plan-min 30 \
  --execute-min 120 \
  --review-min 45 \
  --retro-min 15

ema goal execute <goal_id> --buildout-id <buildout_id> --mode implement

ema backend flow phase <execution_id> --to idle --reason "execution bootstrapped"
ema backend flow phase <execution_id> --to plan --reason "start planning"
ema backend flow phase <execution_id> --to execute --reason "do the work"

ema backend flow result <execution_id> \
  --path ema-genesis/intents/runtime-proposal-intent/RESULT.md \
  --summary "Implemented and verified"

ema backend flow complete <execution_id> \
  --summary "Completed with linked evidence" \
  --intent-status completed \
  --intent-event "goal loop complete"
```

Expected state changes:

- `goal propose` inserts one durable proposal row in `loop_proposals`
- `backend proposal approve` moves proposal status to `approved`
- `goal buildout` inserts four `calendar_entries` rows sharing one `buildout_id`
- `goal execute` inserts one `executions` row and binds it to the buildout rows
- `backend flow phase` updates `execution_phase_transitions` and mirrors buildout phase status
- `backend flow result` stores `result_path` and `result_summary` on the execution row
- `backend flow complete` sets execution `status = completed`, timestamps completion, and can write linked intent status/events

## Goal Flow

Create a human goal:

```bash
ema goal create \
  --title "Ship active planning ledger" \
  --timeframe quarterly \
  --owner-kind human \
  --owner-id trajan \
  --intent int-recovery-wave-1
```

Create an agent goal:

```bash
ema goal create \
  --title "Strategist decomposes recovery tranche" \
  --timeframe weekly \
  --owner-kind agent \
  --owner-id strategist \
  --intent int-recovery-wave-1
```

List current goals:

```bash
ema goal list --owner-kind agent
```

## Calendar Flow

Create a human schedule block:

```bash
ema calendar create \
  --title "Human review block" \
  --kind human_commitment \
  --owner-kind human \
  --owner-id trajan \
  --start-at 2026-04-13T14:00:00.000Z \
  --end-at 2026-04-13T15:00:00.000Z
```

Create an agent virtual block manually:

```bash
ema calendar create \
  --title "execute: backend cleanup" \
  --kind agent_virtual_block \
  --owner-kind agent \
  --owner-id builder \
  --phase execute \
  --goal-id <goal_id> \
  --start-at 2026-04-13T15:00:00.000Z \
  --end-at 2026-04-13T18:00:00.000Z
```

Create a phased buildout automatically:

```bash
ema calendar buildout \
  --goal-id <goal_id> \
  --owner-id strategist \
  --start-at 2026-04-13T16:00:00.000Z \
  --plan-min 45 \
  --execute-min 180 \
  --review-min 45 \
  --retro-min 30
```

That writes four `calendar_entries` rows with:

- `entry_kind = agent_virtual_block`
- `owner_kind = agent`
- `owner_id = strategist`
- `phase = plan | execute | review | retro`
- one shared `buildout_id`

## Expected Writes

- `POST /api/goals`
  - inserts one row into `goals`
- `PUT /api/goals/:id`
  - updates the goal row in place
- `POST /api/calendar`
  - inserts one row into `calendar_entries`
- `POST /api/calendar/buildouts`
  - inserts a phased sequence into `calendar_entries`

## Current Scope

Real now:

- owned human and agent goals
- schedule entries for either humans or agents
- explicit phase-aware agent buildouts
- links from planning objects back to `intent_slug`, `goal_id`, `execution_id`

Deferred on purpose:

- automatic scheduling heuristics
- temporal energy inference
- old meeting-only planning model
- autonomous calendar driving workers
- actor/proposal/governance layers beyond the active durable proposal lifecycle
