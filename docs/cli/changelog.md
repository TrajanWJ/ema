# CLI Changelog

## 2026-04-06

- Started native CLI/TUI build documentation.
- Removed exposed OpenClaw HTTP routes and Phoenix channel wiring from the daemon surface.
- Removed OpenClaw startup hooks from `Ema.Application`.
- Removed OpenClaw-specific runtime config blocks.
- Simplified `bin/ema` task/proposal dispatch to use `/api/executions` directly and removed the `sync openclaw` command.
- Removed stale migration backup file `20260407000001_add_agent_intent_to_tasks.exs.bak`.
- Verified `mix compile` succeeds and `mix phx.routes` contains no OpenClaw routes.
- Verified `mix test` passes: `562 tests, 0 failures, 8 excluded`.
- Attempted to add Ratatouille/ExTermbox for TUI work, but reverted the dependency add after `ex_termbox` failed to build under Python 3.12 because its waf toolchain imports the removed `imp` module.
- Files:
  - `bin/ema`
  - `daemon/config/runtime.exs`
  - `daemon/lib/ema/application.ex`
  - `daemon/lib/ema_web/router.ex`
  - `daemon/lib/ema_web/user_socket.ex`
  - `daemon/lib/ema_web/controllers/openclaw_controller.ex`
  - `daemon/lib/ema_web/channels/openclaw_channel.ex`
  - `daemon/priv/repo/migrations/20260407000001_add_agent_intent_to_tasks.exs.bak`
  - `docs/cli/changelog.md`
  - `docs/cli/command-tree.md`
  - `docs/cli/decisions/001-reuse-existing-native-cli.md`
  - `docs/cli/decisions/002-tui-dependency-blocker.md`

## 2026-04-06 Phase 1

- Added corrective migration `20260412000008_align_actor_container_contract.exs` to align the live SQLite schema with the additive actor/container contract.
- Rebuilt empty actor-side support tables for tags, entity data, container config, phase transitions, and actor commands to the new contract.
- Added missing container fields in Ecto schemas for spaces, projects, tasks, goals, inbox items, executions, and proposals.
- Added `Ema.Tags`, `Ema.EntityData`, `Ema.ContainerConfig`, and `Ema.PhaseTransitions` wrapper modules over the actor context.
- Added actor/container HTTP controllers for tags, entity data, container config, and phase transitions, and expanded actor routes.
- Added default human-actor bootstrap on app start outside test.
- Preserved test stability by avoiding implicit `actor_id` defaults on legacy endpoints and by suppressing brain-dump async side effects in test mode.
- Verified:
  - `mix ecto.migrate` applied `20260412000008`
  - `mix phx.routes` includes `/api/actors`, `/api/tags`, `/api/entity-data`, `/api/container-config`, `/api/phase-transitions`, `/api/spaces`
  - `mix compile` succeeds
  - `Application.ensure_all_started(:ema)` seeds actor `{"human", "human", "human"}`
- Residual blocker:
  - `mix test` remains flaky with 1 failure because unrelated async/background codepaths still hit unresolved OpenClaw and sandbox ownership issues outside this actor/container slice.
- Files:
  - `daemon/priv/repo/migrations/20260412000008_align_actor_container_contract.exs`
  - `daemon/lib/ema/actors/actor.ex`
  - `daemon/lib/ema/actors/actor_command.ex`
  - `daemon/lib/ema/actors/actors.ex`
  - `daemon/lib/ema/actors/bootstrap.ex`
  - `daemon/lib/ema/actors/container_config.ex`
  - `daemon/lib/ema/actors/entity_data.ex`
  - `daemon/lib/ema/actors/phase_transition.ex`
  - `daemon/lib/ema/actors/tag.ex`
  - `daemon/lib/ema/container_config.ex`
  - `daemon/lib/ema/entity_data.ex`
  - `daemon/lib/ema/phase_transitions.ex`
  - `daemon/lib/ema/tags.ex`
  - `daemon/lib/ema/brain_dump/brain_dump.ex`
  - `daemon/lib/ema/brain_dump/item.ex`
  - `daemon/lib/ema/goals/goal.ex`
  - `daemon/lib/ema/tasks/task.ex`
  - `daemon/lib/ema_web/controllers/actor_controller.ex`
  - `daemon/lib/ema_web/controllers/container_config_controller.ex`
  - `daemon/lib/ema_web/controllers/entity_data_controller.ex`
  - `daemon/lib/ema_web/controllers/phase_transition_controller.ex`
  - `daemon/lib/ema_web/controllers/tag_controller.ex`
  - `docs/cli/changelog.md`
