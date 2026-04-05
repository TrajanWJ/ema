# W7-BRIDGE-FINISH-RESULT

**Status:** DONE_WITH_CONCERNS  
**Date:** 2026-04-03

## What changed

- Added `Ema.Agents.AgentMemory.get_memory_summary_async/3` as a non-breaking async sibling to the existing sync summary API.
- Added internal async handling in `AgentMemory` so on-demand memory summaries can use `Bridge.run_async/3` when a Claude call is needed.
- Normalized `AgentMemory` summary extraction so both sync and async paths convert Bridge responses to plain text before returning or persisting them.
- Added `Ema.Agents.AgentWorker.dispatch_to_domain_async/4` as an additive async entrypoint for callers that do not need an immediate Claude reply.
- Verified `lib/ema/pipes/actions/claude_action.ex` already has `execute_async/3`; left unchanged.

## What stayed sync and why

- `lib/ema/voice/voice_core.ex` stayed sync. Both Claude callsites produce immediate voice/text replies for the current request path, and there is no existing background reply-delivery path to swap in safely today.
- `lib/ema/agents/agent_worker.ex` runner path (`handle_runner_message/4`) stayed sync. It serves a `GenServer.call/3` request that must return the Claude reply inline.
- `lib/ema/agents/agent_worker.ex` existing `dispatch_to_domain/3` stayed sync because it is used by `lib/ema_web/controllers/agent_controller.ex` to answer the current HTTP request immediately. The new async sibling is additive for future non-blocking callers.
- `lib/ema/pipes/actions/claude_action.ex` was reviewed and left as-is because `execute_async/3` already exists.

## Compile result

Codex could not run `mix compile` inside its sandbox because Mix PubSub was blocked from opening a loopback socket (`:eperm`).

I then verified from a normal host shell:

```text
cd /home/trajan/Projects/ema/daemon && /home/trajan/.local/bin/mise exec -- mix compile
```

Result: compile completed successfully. The output showed only pre-existing warnings in unrelated files; no compile errors from the W7 bridge-finish edits.

Additional verification: `mise exec -- elixir -e 'for f <- ["lib/ema/agents/agent_memory.ex", "lib/ema/agents/agent_worker.ex"] do Code.string_to_quoted!(File.read!(f), file: f) end'` succeeded, so the edited files are syntactically valid Elixir.

## Exact files changed

- `lib/ema/agents/agent_memory.ex`
- `lib/ema/agents/agent_worker.ex`
- `../docs/W7-BRIDGE-FINISH-RESULT.md`
