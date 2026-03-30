# ENGINE-WIRING-LOG.md

**Date:** 2026-03-30  
**Author:** Coder (subagent ema-coder-2)  
**Status:** ✅ Complete — all 5 files compile cleanly

---

## Summary

All EMA daemon engine components wired. Proposal pipeline now uses PubSub for inter-stage messaging. SystemBrain subscribes to pipeline and session events. Compile verified: `mix compile` → `Generated ema app` (no warnings).

---

## Task 1: Proposal Engine Pipeline

### Architecture

```
Seed DB → Scheduler.dispatch_seed/1
              ↓
         Generator.generate/1 (GenServer cast)
              ↓ Task.Supervisor async
         Claude.Runner.run/2 → create_proposal
              ↓ Phoenix.PubSub broadcast {:proposals, :generated, proposal}
              ↓
         Refiner (subscribed to proposals:pipeline)
              ↓ Task.Supervisor async
         Claude.Runner.run/2 → update_proposal
              ↓ Phoenix.PubSub broadcast {:proposals, :refined, proposal}
              ↓
         Debater (subscribed to proposals:pipeline)
              ↓ Task.Supervisor async
         Claude.Runner.run/2 → update_proposal (steelman/red_team/synthesis/confidence)
              ↓ Phoenix.PubSub broadcast {:proposals, :debated, proposal}
              ↓
         Tagger (subscribed to proposals:pipeline)
              ↓ Task.Supervisor async
         Claude.Runner.run/2 model=haiku → add_tag × N
         update_proposal status="queued"
              ↓ Phoenix.PubSub broadcast {:proposals, :queued, proposal}
```

### Files Modified

| File | Change |
|------|--------|
| `proposal_engine/generator.ex` | Replaced direct `Refiner.refine/1` call with `PubSub.broadcast(:proposals, :generated)` |
| `proposal_engine/refiner.ex` | Converted from explicit `refine/1` API to PubSub subscriber; subscribes to `proposals:pipeline`; broadcasts `{:proposals, :refined}` |
| `proposal_engine/debater.ex` | Converted from explicit `debate/1` API to PubSub subscriber; subscribes to `proposals:pipeline`; broadcasts `{:proposals, :debated}` |
| `proposal_engine/tagger.ex` | Converted from explicit `tag/1` API to PubSub subscriber; subscribes to `proposals:pipeline`; sets status "queued"; broadcasts `{:proposals, :queued}` |
| `proposal_engine/scheduler.ex` | Cleaned up; fixed paused tick (was silently dropping ticks without rescheduling); logs dispatched count |

### PubSub Topic

All pipeline messages on topic: `"proposals:pipeline"`

Message format: `{:proposals, stage_atom, proposal_struct}`

Stages: `:generated` → `:refined` → `:debated` → `:queued`

### Error Handling

Each stage passes through to the next stage on Claude CLI failure by broadcasting the upstream proposal unchanged — the pipeline never deadlocks.

---

## Task 2: Responsibility Scheduler

**Status:** ✅ Already wired — no changes needed.

`Ema.Responsibilities.Scheduler` calls `Ema.Responsibilities.generate_due_tasks/0` which:
- Queries all active responsibilities with a non-nil, non-"ongoing" cadence
- Filters by `cadence_due?/1` (uses `last_checked_at` + cadence string for interval comparison)
- Creates a task via `Ema.Tasks.create_task/1` for each due responsibility
- Runs every 24 hours (configurable via `interval:` opt), first run 30s after boot

---

## Task 3: Session Integration

**Status:** ✅ Already wired — no changes needed.

`Ema.ClaudeSessions.SessionWatcher`:
- Polls `~/.claude/projects/**/*.jsonl` every 30 seconds
- Tracks file mtimes in state; processes only new/changed files
- `SessionParser.parse_file/1` → extracts session_id, timestamps, tool_calls, files_touched, token_count, project_path
- `SessionLinker.link/1` → matches project_path against `Project.linked_path` in DB
- Creates or updates `ClaudeSession` record
- Broadcasts `{:session_detected, %{id, session_id, status}}` on topic `"claude_sessions"`

---

## Task 4: Second Brain SystemBrain

**Status:** ✅ Enhanced — added proposals pipeline + session subscriptions.

### Subscriptions added

```elixir
Phoenix.PubSub.subscribe(Ema.PubSub, "proposals:pipeline")
Phoenix.PubSub.subscribe(Ema.PubSub, "claude_sessions")
```

### State files written to `vault_root/system/state/`

| File | Contents |
|------|----------|
| `projects.md` | Table of all notes in "projects" space |
| `notes.md` | All vault notes grouped by space |
| `proposals.md` | *(new)* List of queued proposals with confidence scores |

All writes are debounced (5 second delay, timer reset on each incoming event).

---

## Compile Result

```
Compiling 5 files (.ex)
Generated ema app
```

No warnings. No errors.
