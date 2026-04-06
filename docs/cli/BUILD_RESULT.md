# EMA CLI + TUI + Actor Model Build Result

Date: 2026-04-06
Session: Orchestrator build session

---

## What Was Completed

### Phase 0: Cleanup — IN PROGRESS (background agent)
- [x] Stale EmaCli.CLI identified (7 modules at `lib/ema_cli/`)
- [x] OpenClaw removal dispatched to background agent (55 files, ~400 refs)
- [ ] OpenClaw agent completing — editing security_auditor.ex and scattered refs
- [ ] deps.get for ratatouille/ex_termbox — not yet added
- Note: The linter has been actively improving code as we go

### Phase 1a: Actor/Container Migrations — DONE
7 migrations created, all compile clean.

### Phase 1b: Actor/Container Schemas + Context — DONE
7 schemas, 1 context module, 1 controller, routes added.
Linter improved schemas (renamed `type` → `actor_type`, restructured Tags, changed EntityData to composite PK).

### Phase 2: CLI Consolidation — PARTIAL
- [x] Discovered two Elixir CLIs: `Ema.CLI` (Optimus, 15 groups) and `EmaCli.CLI` (simple, 7 groups)
- [x] Decision: `Ema.CLI` is the real one (escript target points here)
- [x] Added 7 new command modules (actor, org, space, intent, gap, babysitter, note)
- [x] Added 28 Optimus spec stubs for linter-added command groups
- [x] Added dispatch clauses for all new commands
- [x] CLI now has ~40+ command groups registered
- [x] Compilation: 0 errors, 5 warnings
- [ ] BatchA agent completed 6 EmaCli modules in worktree (pipe, campaign, channel, ai-session, evolution, superman) — needs merge/adaptation

### Phase 3: TUI Foundation — NOT STARTED
Blocked on ratatouille dep addition.

---

## Files Created

| Path | Purpose |
|------|---------|
| `docs/cli/BUILD_PLAN.md` | Living coordination document |
| `docs/cli/BUILD_RESULT.md` | This file |
| `priv/repo/migrations/20260412000001_create_actors.exs` | Actors table |
| `priv/repo/migrations/20260412000002_create_tags.exs` | Tags + entity_tags tables |
| `priv/repo/migrations/20260412000003_create_entity_data.exs` | Per-actor key/value data |
| `priv/repo/migrations/20260412000004_create_container_config.exs` | Container settings |
| `priv/repo/migrations/20260412000005_create_phase_transitions.exs` | Phase audit trail |
| `priv/repo/migrations/20260412000006_create_actor_commands.exs` | Runtime CLI commands |
| `priv/repo/migrations/20260412000007_add_actor_id_to_core_tables.exs` | Add actor_id to tasks/goals/executions/proposals, container scoping to inbox_items |
| `lib/ema/actors/actor.ex` | Actor schema |
| `lib/ema/actors/tag.ex` | Tag schema (linter: merged with entity_tags) |
| `lib/ema/actors/entity_tag.ex` | EntityTag join schema |
| `lib/ema/actors/entity_data.ex` | EntityData schema (linter: composite PK) |
| `lib/ema/actors/container_config.ex` | ContainerConfig schema (linter: composite PK) |
| `lib/ema/actors/phase_transition.ex` | PhaseTransition schema (linter: added week_number, summary) |
| `lib/ema/actors/actor_command.ex` | ActorCommand schema (linter: simplified fields) |
| `lib/ema/actors/actors.ex` | Actors context module (linter: added ensure_default_human_actor, encode_json helpers) |
| `lib/ema_web/controllers/actor_controller.ex` | REST API for actors |
| `lib/ema/cli/commands/actor.ex` | CLI: actor list/show/create/transition/commands |
| `lib/ema/cli/commands/org.ex` | CLI: org list/show/create/invite (linter simplified) |
| `lib/ema/cli/commands/space.ex` | CLI: space list/show/create |
| `lib/ema/cli/commands/intent.ex` | CLI: intent list/show/tree/export |
| `lib/ema/cli/commands/gap.ex` | CLI: gap list/resolve/create-task/scan |
| `lib/ema/cli/commands/babysitter.ex` | CLI: babysitter state/config/nudge/tick (linter created) |
| `lib/ema/cli/commands/note.ex` | CLI: note list/show/create/delete (linter created) |

## Files Modified

| Path | What Changed |
|------|-------------|
| `lib/ema_web/router.ex` | Added actor CRUD routes |
| `lib/ema/cli/cli.ex` | Added ~28 spec stubs, dispatch clauses for actor/space/intent/gap, subcommand registrations |

## Migrations Added

| # | Table | Purpose |
|---|-------|---------|
| 1 | `actors` | First-class participants (human + agent) |
| 2 | `tags` + `entity_tags` | Universal tagging (linter merged into single table) |
| 3 | `entity_data` | Per-actor key/value metadata on any entity |
| 4 | `container_config` | Non-actor settings per container |
| 5 | `phase_transitions` | Append-only phase change audit trail |
| 6 | `actor_commands` | Runtime-registered CLI/TUI commands |
| 7 | ALTER tasks/goals/executions/proposals/inbox_items | Add actor_id and container scoping |

## CLI Commands Implemented (This Session)

```
ema actor list|show|create|transition|commands
ema org list|show|create|members|invite
ema space list|show|create
ema intent list|show|tree|export
ema gap list|resolve|create-task|scan
ema babysitter state|config|nudge|tick
ema note list|show|create|delete
```

Plus 28 Optimus spec stubs for linter-generated commands (superman, metamind, ralph, vectors, quality, dispatch-board, tokens, config, canvas, voice, integration, reflexion, ai-session, routing, git-sync, tunnel, file-vault, messages, team-pulse, metrics, feedback, dashboard).

## Decisions Made (ADRs)

1. **ADR-001: Consolidate Elixir CLIs** — `Ema.CLI` is the single entry point; `EmaCli.CLI` to be deleted
2. **ADR-002: OpenClaw removal** — Delete standalone modules, replace fallback paths with local-only
3. **ADR-003: Flat command namespace** — 2 levels max (`ema <noun> <verb>`)
4. **ADR-004: Transport mode by context** — Escript=HTTP, Mix task=Direct, --host=always HTTP
5. **ADR-005: TUI is a Mix task** — `mix ema.tui`, not escript

## Known Issues

1. BatchA agent created modules in wrong namespace (`EmaCli.*` instead of `Ema.CLI.Commands.*`) — needs manual merge
2. OpenClaw cleanup agent still running in worktree — not yet merged
3. 5 unused variable warnings in gap.ex and babysitter.ex
4. Linter made significant schema changes (composite PKs, field renames) — need to verify migration compatibility
5. Many linter-generated command modules exist but are HTTP-only stubs without Direct transport support

## What Remains

### Immediate (next session)
1. Merge OpenClaw cleanup worktree (when agent completes)
2. Run `mix ecto.migrate` to create new tables
3. Add ratatouille + ex_termbox deps
4. Create matching Ema.CLI.Commands modules for BatchA groups (pipe, campaign, channel, session, evolution, superman) with proper Optimus + transport support
5. Delete `lib/ema_cli/` directory (after extracting any useful patterns)

### Phase 3-4 (following sessions)
6. TUI foundation: Ratatouille app, dashboard screen, PubSub subscriptions
7. TUI screens: tasks, executions, proposals, agents, vault, focus
8. E2E testing of CLI commands against running daemon

## Single Next Instruction

`Merge the OpenClaw cleanup worktree, run mix ecto.migrate, then implement the 6 BatchA CLI command modules (pipe, campaign, channel, session, evolution, superman) in lib/ema/cli/commands/ with proper Optimus specs and Direct+HTTP transport support.`
