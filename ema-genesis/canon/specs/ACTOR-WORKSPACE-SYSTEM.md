---
id: SPEC-ACTOR-WORKSPACE-SYSTEM
type: canon
subtype: spec
layer: canon
title: "Actor & Workspace Architecture — humans and agents as first-class actors with 5-phase cadence, composite-key EntityData, polymorphic Tags, append-only PhaseTransitions"
status: preliminary
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "~/.local/share/ema/vault/wiki/Architecture/Actor-Workspace-Architecture.md"
recovered_at: 2026-04-12
connections:
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
  - { target: "[[intents/INT-AGENT-COLLABORATION]]", relation: references }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
tags: [canon, spec, actors, workspace, phase-cadence, entity-data, tags, recovered, preliminary]
---

# Actor & Workspace System

> **Recovery status:** Preliminary. Core identity layer — both humans and agents are Actors with the same schema. Already marked TIER PORT in [[_meta/SELF-POLLINATION-FINDINGS]] §A as `Ema.Actors` (phase cadence + EntityData composite key + Tag polymorphic + PhaseTransition append-only log). This spec is the prose version.

## What it is

Actors are the **unit of agency** in EMA. Humans and agents both count. Every Actor has identity, a current executive-management phase, capabilities, and config. Work attributed to an Actor is traceable. Per-Actor annotations (EntityData) and tags scope naturally.

The system is EMA's **"first native workspace"** — the old build's framing was that the Actor table is what makes a space actually a collaborative workspace and not just a folder.

## Actor schema

```
actor {
  id:            string  (primary key, UUID)
  slug:          string  (human-readable identifier, e.g., "trajan", "agent-strategist")
  name:          string  (display name)
  actor_type:    enum    { human, agent }
  phase:         enum    { idle, plan, execute, review, retro }
  status:        enum    { active, inactive, paused }
  capabilities:  json    (what the actor can do — array of capability strings)
  config:        map     (actor-specific configuration)
}
```

## The 5-phase cadence

Every actor cycles through five phases:

| Phase | Meaning |
|---|---|
| `idle` | Not currently engaged on anything. Available for assignment. |
| `plan` | Figuring out what to do. Agents: running the Strategist role; humans: brainstorming. |
| `execute` | Doing the work. Agents: running in a worktree with a tool session; humans: hands on keyboard. |
| `review` | Checking the work before commit. Agents: running the Reviewer role; humans: reading the diff. |
| `retro` | Reflecting on what happened. Agents: running the Coach/Archivist roles; humans: writing a session log. |

Transitions are logged to an **append-only `phase_transitions` table** so you can always reconstruct an actor's history of what it was doing at any point in time.

## EntityData (per-actor annotations)

Each Actor can attach structured data to arbitrary entities in the system. The composite primary key is:

```
(actor_id, entity_type, entity_id, key)
```

Example: Actor `trajan` (human) attaches `{priority: high}` to Intent `INT-NERVOUS-SYSTEM-WIRING`, becomes the row `(trajan, intent, INT-NERVOUS-SYSTEM-WIRING, priority) → high`.

This lets different actors (humans or agents) hold different opinions about the same entity without overwriting each other. Agents can record their own priority assessments separately from humans.

## Tags (polymorphic, actor-scoped)

The Tag table is polymorphic — it can tag any entity type. Schema:

```
(entity_type, entity_id, tag, actor_id, namespace)
```

Note: `actor_id` is part of the tag, not a foreign key on the tagged entity. Two actors can tag the same intent with different tags (or even the same tag in different namespaces) without conflict.

## PhaseTransition (append-only log)

Every phase change writes a new row. Immutable. Never deleted. Fields include: `actor_id`, `from_phase`, `to_phase`, `reason`, `timestamp`, `context` (arbitrary JSON).

Why append-only: audit trail, replay capability, debugging. If an agent gets stuck in `execute` for too long, you can look at the log and see exactly when and why it entered that phase.

## Seed actors in the old build

The old build seeded **4 actors**:
- `trajan` — the human (actor_type: human)
- `agent-strategist` — the Strategist (actor_type: agent, role prompt at [[canon/specs/agents/AGENT-STRATEGIST]])
- `agent-coach` — the Coach (actor_type: agent, role prompt at [[canon/specs/agents/AGENT-COACH]])
- `agent-archivist` — the Archivist (actor_type: agent, role prompt at [[canon/specs/agents/AGENT-ARCHIVIST]])

The wiki noted 17 agents were bootstrapped but only 3 active — the "3 active" is this set. The other 14 had decorative schema entries but no prompts or capabilities wired.

## Integration points

- **Phase cadence enforcement** — part of [[intents/INT-AGENT-COLLABORATION]]. Currently the phases are properties but transitions aren't guarded.
- **Worktree isolation** — when an agent enters `execute`, it claims a git worktree so parallel work doesn't collide. Part of [[intents/INT-AGENT-COLLABORATION]].
- **Actor-scoped queries** — all the major vApps filter their views by "which actor is the current caller." The human sees human-tagged data + agent-tagged data with different styling. The agent sees its own EntityData + the human's in read mode.

## Why this survives the rewrite

The schema is **plain SQLite-friendly**: standard tables, composite keys, append-only logs. Nothing Elixir-specific. Ports directly to `better-sqlite3`. The phase cadence is a state machine that fits xstate or a hand-rolled FSM in TypeScript. Per [[_meta/SELF-POLLINATION-FINDINGS]] §A effort estimate: Medium.

## Gaps / open questions

- **Capability strings format.** What does `capabilities: [...]` actually contain? Action names? Role names? Permission strings? The old schema stored JSON — exact values TBD.
- **Config map contents.** Same question — what lives in `config`?
- **Phase transition guards.** Which transitions are allowed? Presumably `idle → plan → execute → review → retro → idle` but can you skip? Go backwards? Needs explicit rules.
- **Concurrent executes.** Can one actor be in `execute` phase on two things at once? If not, what's the queuing model?
- **Human phase detection.** How does the system know the human is in `execute` vs `idle`? Keyboard activity? Explicit signal? Per-vApp heuristic?

## Related

- [[canon/specs/EMA-V1-SPEC]] — parent spec
- [[canon/specs/AGENT-RUNTIME]] — sibling (actors run on top of the runtime)
- [[canon/specs/agents/_MOC]] — the 3 recovered agent prompts
- [[intents/INT-AGENT-COLLABORATION]] — wiring intent that depends on this spec
- [[_meta/SELF-POLLINATION-FINDINGS]] §A TIER PORT `Ema.Actors`
- Original source: `~/.local/share/ema/vault/wiki/Architecture/Actor-Workspace-Architecture.md`

#canon #spec #actors #workspace #phase-cadence #recovered #preliminary
