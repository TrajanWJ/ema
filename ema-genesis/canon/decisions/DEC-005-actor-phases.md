---
id: DEC-005
type: canon
subtype: decision
layer: canon
title: "Actor work lifecycle = idle → plan → execute → review → retro (ported from old Elixir Actors)"
status: active
implementation_status: pending
implementation_tracked_by: "[[intents/INT-RECOVERY-WAVE-1]] Stream 3"
implementation_target_paths:
  - "shared/schemas/actor-phase.ts"
  - "services/core/actors/"
  - "phase_transitions table in shared/schemas/"
created: 2026-04-12
updated: 2026-04-13
author: recovery-wave-1
decided_by: human
supersedes:
  - "canon/specs/AGENT-RUNTIME.md (gains an 'Actor Work Phases' section)"
connections:
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
  - { target: "[[intents/GAC-003/README]]", relation: references }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: derived_from }
tags: [decision, canon, locked, actors, phases, work-lifecycle]
---

# DEC-005 — Actor Work Lifecycle Phases

> **Status:** Locked 2026-04-12. Orthogonal to `[[intents/GAC-003/README]]` — that card answered the agent *runtime state* question; this decision answers the *work lifecycle* question.

## The Decision

An Actor moves through five work phases in a directed but skippable cycle:

```
idle → plan → execute → review → retro → idle
```

| Phase | Meaning |
|---|---|
| **idle** | Default. Awaiting assignment or start signal. No work in flight. |
| **plan** | Planning. Architecture, design, spec work. No code edits yet. |
| **execute** | Active execution. File edits, tool calls, side effects. |
| **review** | Self-review and introspection. Running tests, re-reading diffs, gathering verification. |
| **retro** | Retrospective. Writing learnings, producing the execution record, distilling what to propagate. |

Phase transitions are **append-only**. Every transition writes a row to an immutable `phase_transition` table (Drizzle) with `{actor_id, from_phase, to_phase, reason, summary, transitioned_at}`. Actors can skip phases (e.g. `idle → execute` directly for trivial work) but cannot rewind — a "back to plan" is a *new* transition, not an undo.

## Why

### The vocabulary already existed and works

The old Elixir `Ema.Actors.Actor` module (Appendix A.5 of `[[_meta/SELF-POLLINATION-FINDINGS]]`) ran on exactly this vocabulary for a year of production use. `@phases ~w(idle plan execute review retro)` with `phase_transition` as the append-only log. It didn't break. It's already a well-understood vocabulary in the old build's corpus of intents, executions, and log lines. Porting rather than re-deriving saves a design pass and keeps continuity.

### Orthogonal to runtime state

`[[intents/GAC-003/README]]` answered the agent *runtime process state* question (`working / idle / blocked / error / context-full / paused / crashed`). That's about whether the Claude subprocess is alive. This decision is about what *kind of work* the actor is doing. The two compose:

```
actor.runtime_state: working        |  actor.phase: execute
actor.runtime_state: idle           |  actor.phase: review    ← normal, thinking
actor.runtime_state: context-full   |  actor.phase: execute   ← needs compaction mid-work
actor.runtime_state: blocked        |  actor.phase: plan      ← waiting on clarification
```

Both axes must be observable. A dashboard row looks like `actor=researcher-1 · phase=execute · runtime=working`.

### Append-only transitions enable retrospection

The `phase_transition` log is how the Retro phase gets its material. Instead of asking "what happened during this intent?" the retro agent replays the log. This is also how the Reflexion injector works in the old `Ema.Executions.Dispatcher`: past phase transitions become context for future prompts. Do not change the append-only property.

## What This Changes

- `canon/specs/AGENT-RUNTIME.md` gains an **Actor Work Phases** section referencing this decision. The existing lifecycle language (`DETECT → CONFIGURE → LAUNCH → WORK → REPORT → IDLE`) is *runtime supervision* and stays separate — it's about process management, not work state.
- New Zod schema `shared/schemas/actor-phase.ts` exporting the union type and a Drizzle `phase_transition` table definition.
- Any Dispatcher, Reflexion-injector, or execution-record writer in the new build consults the phase log.
- The Blueprint vApp's Actor dashboard renders both axes.

## What This Does NOT Change

- Runtime state (GAC-003's 7-state enum) stays in its own field, measured by heartbeat classification.
- `AGENT-RUNTIME.md` supervision lifecycle stays separate.
- Intent kind (`implement`, `research`, `port`, etc.) is a third orthogonal axis.

## Connections

- `[[intents/GAC-003/README]]` — runtime state axis (orthogonal)
- `[[canon/specs/AGENT-RUNTIME]]` — primary canon target, gains Actor Work Phases section
- `[[_meta/SELF-POLLINATION-FINDINGS]]` Appendix A.5 — source vocabulary
- `[[intents/INT-RECOVERY-WAVE-1/README]]` — the intent this decision is executed under
- Old Elixir source: `IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/actors/actor.ex`, `phase_transition.ex`

#decision #canon #locked #actors #phases #work-lifecycle #recovery-wave-1
