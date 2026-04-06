# EMA CLI + Actor Model Build Plan

Generated: 2026-04-06
Orchestrator: Claude Opus 4.6 session

---

## System Snapshot

| Metric | Value |
|--------|-------|
| Total route groups in router | ~65 domains |
| Total REST endpoints | ~463 routes across 81 controllers |
| Total context modules (lib/ema/**/*.ex) | 378 files |
| Total Ecto schemas | 90 files with `use Ecto.Schema` |
| Total migrations | 89 |
| Total PubSub topics | ~50 unique topic patterns across 124 files |
| Total WebSocket channels | 37 |
| OpenClaw references to remove | 55 files, ~400 references |
| Domain directories (lib/ema/*/) | 63 |
| Escript entry module | `Ema.CLI` in mix.exs (`escript: [main_module: Ema.CLI, name: "ema", app: nil]`) |
| Existing Elixir CLI (Ema.CLI) | 15 command groups, Optimus-based, Owl output, Direct+HTTP transport |
| Stale Elixir CLI (EmaCli.CLI) | 7 command groups, HTTP-only, no Optimus — superseded |
| Python CLI (scripts/ema) | 20 command groups, ~55 subcommands, 1969 lines — external HTTP client |
| Deps present | optimus ~> 0.5, owl ~> 0.12 |
| Deps missing | ratatouille, ex_termbox |
| Compilation | Clean (0 errors, 0 warnings) |

---

## Key Discovery: Two Elixir CLIs Exist

1. **`lib/ema/cli/cli.ex`** — `Ema.CLI` (v3.0.0)
   - Optimus arg parser, 15 command groups (task, proposal, vault, focus, agent, exec, goal, brain-dump, habit, journal, resp, seed, engine, dump, status)
   - Transport abstraction: `Direct` (in-node, calls context modules) + `Http` (Req-based REST)
   - Output: `Ema.CLI.Output` using Owl tables + Jason JSON
   - Helpers: `Ema.CLI.Helpers` with extract_list/extract_record/compact_map
   - **This is the real CLI. The escript target points here.**

2. **`lib/ema_cli/cli.ex`** — `EmaCli.CLI`
   - Simple hand-rolled arg parser, 7 commands (intent, proposal, session, quality, routing, health, test)
   - HTTP-only, no transport abstraction
   - **Stale. Should be merged or deleted.**

**Decision: Consolidate into `Ema.CLI`. Delete `EmaCli.CLI` and its submodules after extracting any unique commands (intent, session, quality, routing, test).**

---

## Phase 0: Cleanup

### 0a: Delete stale EmaCli.CLI modules

Files to remove:
- `lib/ema_cli/cli.ex`
- `lib/ema_cli/health.ex`
- `lib/ema_cli/intent.ex`
- `lib/ema_cli/proposal.ex`
- `lib/ema_cli/quality.ex`
- `lib/ema_cli/routing.ex`
- `lib/ema_cli/session.ex`
- `lib/ema_cli/test_runner.ex`

First: extract unique functionality from intent/quality/routing/session/test into `Ema.CLI.Commands.*` equivalents.

### 0b: OpenClaw removal

55 files with ~400 references. Strategy: **Disable, don't delete wholesale.** Many modules (agents, babysitter, execution dispatcher) have OpenClaw as a fallback path. Approach:

1. **Config:** Remove OpenClaw config blocks from `config/runtime.exs`, `config/test.exs`
2. **Application.ex:** Remove `maybe_start_openclaw` and vault sync starters, remove `OpenClawSync.sync()` post-start hook
3. **Core modules with OpenClaw fallback paths:** In `executions/dispatcher.ex`, `agents/agent_worker.ex`, `claude/adapters/openclaw.ex`, `babysitter/*` — replace OpenClaw dispatch with no-op or local-only path
4. **Standalone OpenClaw modules (safe to delete):**
   - `lib/ema/openclaw/` (entire directory: agent_bridge, channel_delivery, client, config, dispatcher, event_ingester, gateway_rpc)
   - `lib/ema/integrations/openclaw/` (entire directory: vault_mirror, vault_reconciler, vault_sync, vault_sync_supervisor, sync_entry)
   - `lib/ema/agents/openclaw_sync.ex`
   - `lib/ema/claude/openclaw_runner.ex`
   - `lib/ema/claude/adapters/openclaw.ex`
   - `lib/ema_web/controllers/openclaw_controller.ex`
   - `lib/ema_web/channels/openclaw_channel.ex`
5. **Router:** Remove OpenClaw routes
6. **Scattered references:** grep and fix remaining references in babysitter, stream_channels, agent_worker, etc.

### 0c: Add TUI deps

```elixir
{:ratatouille, "~> 0.5"},
{:ex_termbox, "~> 1.0"}
```

### 0d: Verify clean boot

- `mix deps.get`
- `mix compile` — 0 errors
- `mix phx.server` — starts without crash
- `mix escript.build` — produces working binary

---

## Phase 1: Actor/Container Data Model

### 1a: Migrations

| # | Migration | Table | Columns | Type |
|---|-----------|-------|---------|------|
| 1 | create_actors | `actors` | id, space_id, type (human/agent), name, slug, capabilities (map), config (map), phase (string), phase_started_at, status, inserted_at, updated_at | CREATE |
| 2 | create_tags | `tags` | id, name, slug, color, actor_id (who created), space_id, entity_type, entity_id, inserted_at | CREATE |
| 3 | create_entity_data | `entity_data` | id, actor_id, entity_type, entity_id, key, value (map), inserted_at, updated_at | CREATE |
| 4 | create_container_config | `container_config` | id, container_type (space/project/task), container_id, key, value (map), inserted_at, updated_at | CREATE |
| 5 | create_phase_transitions | `phase_transitions` | id, actor_id, from_phase, to_phase, reason, metadata (map), inserted_at | CREATE |
| 6 | create_actor_commands | `actor_commands` | id, actor_id, command_name, description, handler_module, handler_function, args_spec (map), inserted_at, updated_at | CREATE |
| 7 | add_container_to_inbox | `brain_dump_items` | ADD container_type, container_id (nullable) | ALTER |
| 8 | add_actor_space_to_tasks | `tasks` | ADD space_id, actor_id (nullable) | ALTER |
| 9 | add_actor_space_to_goals | `goals` | ADD space_id, actor_id (nullable) | ALTER |
| 10 | add_actor_space_to_executions | `executions` | ADD space_id, actor_id (nullable) | ALTER |
| 11 | add_actor_space_to_proposals | `proposals` | ADD space_id, actor_id (nullable) | ALTER |

All new columns **nullable** — zero breakage to existing data.

### 1b: Schemas

| Module | Table | Notes |
|--------|-------|-------|
| `Ema.Actors.Actor` | actors | belongs_to :space, has_many :tags, :entity_data, :phase_transitions, :actor_commands |
| `Ema.Actors.Tag` | tags | polymorphic: entity_type + entity_id |
| `Ema.Actors.EntityData` | entity_data | per-actor key/value on any entity |
| `Ema.Actors.ContainerConfig` | container_config | non-actor settings per container |
| `Ema.Actors.PhaseTransition` | phase_transitions | append-only audit trail |
| `Ema.Actors.ActorCommand` | actor_commands | runtime-registered CLI/TUI commands |

### 1c: Context Modules

| Module | Public API |
|--------|-----------|
| `Ema.Actors` | list_actors/1, get_actor/1, get_actor_by_slug/1, create_actor/1, update_actor/2, transition_phase/3 |
| `Ema.Actors.Tags` | list_tags/1, create_tag/1, add_tag/3, remove_tag/3, tags_for_entity/2 |
| `Ema.Actors.Data` | get_data/3, set_data/4, list_data/2, delete_data/3 |
| `Ema.Actors.Config` | get_config/2, set_config/3, list_config/1 |
| `Ema.Actors.Commands` | register_command/1, unregister_command/2, list_commands/1, execute_command/3 |

### 1d: Controllers & Routes

| Route | Controller | Action |
|-------|-----------|--------|
| GET/POST /api/actors | ActorController | index, create |
| GET/PUT/DELETE /api/actors/:id | ActorController | show, update, delete |
| POST /api/actors/:id/transition | ActorController | transition_phase |
| GET/POST /api/actors/:id/tags | ActorController | list_tags, add_tag |
| DELETE /api/actors/:id/tags/:tag_id | ActorController | remove_tag |
| GET/PUT/DELETE /api/actors/:id/data/:key | ActorController | get_data, set_data, delete_data |
| GET/POST /api/actors/:id/commands | ActorController | list_commands, register_command |

---

## Phase 2: CLI Consolidation + Full Coverage

### 2a: Consolidate entry points

1. Delete `lib/ema_cli/` directory entirely
2. Extract unique commands (intent, quality, routing, session, test) into `lib/ema/cli/commands/`
3. Update `mix.exs` escript to confirm `main_module: Ema.CLI`
4. Verify `mix escript.build && ./ema --help`

### 2b: Add missing command groups

The existing `Ema.CLI` has 15 groups. The daemon has ~65 domains. Priority additions:

**Batch A — High value, endpoints exist:**
| Command Group | Context Module | Key Functions |
|---------------|---------------|---------------|
| `superman` | Ema.Superman.* | ask, context, health, index, gaps, flows |
| `pipe` | Ema.Pipes | list/get/create/update/delete/toggle/fork, catalog, history |
| `campaign` | Ema.Campaigns | list/get/create/update/delete, start_run, advance, list_runs |
| `channel` | Ema.Channels.* | list, health, inbox, send, messages |
| `session` | Ema.Claude.SessionManager | list, create, resume, fork |
| `evolution` | Ema.Evolution | rules, signals, stats, scan, propose, activate, rollback |

**Batch B — Medium value:**
| Command Group | Context Module |
|---------------|---------------|
| `org` | Ema.Org |
| `space` | Ema.Spaces |
| `intent` | Ema.Intelligence.IntentMap |
| `gap` | Ema.Intelligence.GapScanner |
| `memory` | Ema.Intelligence.SessionMemory |
| `babysitter` | Ema.Babysitter.* |
| `dispatch` | Ema.Executions (dispatch board view) |
| `note` | Ema.Notes / Ema.SecondBrain |
| `decision` | Ema.Decisions |

**Batch C — Lower priority:**
| Command Group | Context Module |
|---------------|---------------|
| `canvas` | Ema.Canvas.CanvasContext |
| `contact` | Ema.Contacts |
| `finance` | Ema.Finance |
| `invoice` | Ema.Invoices |
| `routine` | Ema.Routines |
| `meeting` | Ema.Meetings |
| `prompt` | Ema.Prompts.Store |
| `temporal` | Ema.Temporal |
| `security` | Ema.Intelligence.SecurityAuditor |
| `vm` | Ema.Intelligence.VmMonitor |
| `token` | Ema.Intelligence.TokenTracker |
| `clipboard` | Ema.Clipboard |
| `tunnel` | (HTTP only) |
| `file-vault` | Ema.FileVault |

**Batch F — Actor model (after Phase 1):**
| Command Group | Context Module |
|---------------|---------------|
| `actor` | Ema.Actors |
| `tag` | Ema.Actors.Tags |
| `data` | Ema.Actors.Data |
| `config` | Ema.Actors.Config |

### 2c: CLI command template

Each new command module follows this exact pattern (from the working `task.ex`):

```elixir
defmodule Ema.CLI.Commands.Pipe do
  alias Ema.CLI.Output

  @columns [{"ID", :id}, {"Name", :name}, {"Status", :status}, ...]

  def handle([:list], parsed, transport, opts) do
    case transport do
      Ema.CLI.Transport.Direct ->
        case transport.call(Ema.Pipes, :list_pipes, []) do
          {:ok, pipes} -> Output.render(pipes, @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
      Ema.CLI.Transport.Http ->
        case transport.get("/pipes") do
          {:ok, body} -> Output.render(extract_list(body, "pipes"), @columns, json: opts[:json])
          {:error, reason} -> Output.error(reason)
        end
    end
  end
  # ... show, create, update, delete, toggle, etc.
end
```

---

## Phase 3: Owl Live Screens

No separate TUI app. Rich terminal output using Owl (already a dep) with `Owl.LiveScreen` for live-updating views.

### 3a: Enhance `ema watch` with Owl.LiveScreen

Replace the current polling loop in `ema watch` with `Owl.LiveScreen.start_link/1` for flicker-free live updates. When running via Direct transport (Mix task), subscribe to PubSub topics and render on events. When running via HTTP, poll with configurable interval.

### 3b: Rich dashboard for `ema status`

Use `Owl.Table`, `Owl.Box`, and `Owl.Data.tag` for colored, structured output in `ema status` — replace the current ASCII box with Owl-rendered panels.

### 3c: Live execution stream for `ema exec logs`

Stream execution events using Owl.LiveScreen when running in Direct transport mode. Falls back to polling in HTTP mode.

### Key Owl features to use:
- `Owl.Table.new/2` — already used in Output.table
- `Owl.LiveScreen` — live-updating terminal regions
- `Owl.Data.tag/2` — colored text (already used in Output.success/warn)
- `Owl.Box.new/2` — bordered panels for dashboard
- `Owl.ProgressBar` — for long-running operations

---

## Open Questions

1. **Optimus nested subcommand depth** — Optimus supports 2 levels (`ema task list`). For `ema superman intent list` (3 levels), need either a flat alias (`ema intent list`) or a custom parser extension. **Decision: Use flat aliases. `ema intent list` not `ema superman intent list`.**

2. **escript vs Mix task for CLI** — `app: nil` means the escript doesn't boot the OTP app. Direct transport tries `whereis(Ema.Repo)` which won't work from escript. Options: (a) change to `app: :ema` (heavy, slow startup), (b) use HTTP transport in escript mode, Direct transport only when running as Mix task. **Decision: Keep `app: nil`. Escript uses HTTP. `mix ema.cli` uses Direct. Transport.resolve already handles this.**

3. **Live output** — Owl.LiveScreen provides live-updating terminal regions without a separate TUI app. Works in both escript (HTTP polling) and Mix task (PubSub events) modes. No new deps needed.

---

## Decisions Made

### ADR-001: Consolidate Elixir CLIs
- Merge `EmaCli.CLI` unique commands into `Ema.CLI`
- Delete `lib/ema_cli/` directory
- `Ema.CLI` is the single entry point
- Rationale: Two CLIs with overlapping functionality, different architectures, shared deps. One must go.

### ADR-002: OpenClaw removal strategy
- Delete standalone OpenClaw modules entirely
- Replace fallback paths in core modules with local-only dispatch
- Keep OpenClaw config keys as dead code briefly (removed in next pass)
- Rationale: OpenClaw is no longer the architecture center. EMA dispatches locally.

### ADR-003: Flat command namespace
- All commands at `ema <noun> <verb>` (2 levels max)
- No 3-level nesting (`ema superman intent list` → `ema intent list`)
- Aliases documented in command tree
- Rationale: Optimus limitation + CLI ergonomics

### ADR-004: Transport mode by context
- Escript (`app: nil`) → HTTP transport automatically
- Mix task (`mix ema.cli`) → Direct transport automatically
- `--host` flag → always HTTP transport
- Rationale: Already implemented in Transport.resolve, just needs documentation

### ADR-005: Owl live screens, not separate TUI
- Use `Owl.LiveScreen` for live-updating terminal output in `ema watch` and `ema exec logs`
- No new deps — Owl ~> 0.12 already present
- Escript (HTTP) polls; Mix task (Direct) subscribes to PubSub
- Rationale: Simpler, no extra dep, same visual result for the single-user case
