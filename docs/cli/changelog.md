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
