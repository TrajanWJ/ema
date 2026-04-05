# W7 Prompts Runtime Integration

## Files Changed
- `lib/ema_web/controllers/prompt_controller.ex`
- `lib/ema_web/controllers/prompt_json.ex`
- `lib/ema_web/channels/prompts_channel.ex`

## What Was Wrong
- Prompt HTTP controller still hit the legacy `prompt_templates` context, so runtime versioned prompts in `prompts` were unreachable through the API.
- Channel clients only received an initial snapshot; runtime updates from `Ema.Prompts.Store` PubSub broadcasts were not forwarded consistently and payload shape differed from HTTP responses.
- There was no shared serializer for prompt payloads, so each surface exposed different fields and broke consumers expecting legacy keys like `name`, `body`, and `variables`.

## Changes Made
- Rebuilt `EmaWeb.PromptController` to read/write through `Ema.Prompts.Store`, preserve legacy keys for compatibility, and expose both `prompts` and `templates` arrays.
- Added `EmaWeb.PromptJSON` so both the controller and channel emit identical serialized prompt data with both runtime and legacy fields.
- Updated `EmaWeb.PromptsChannel` to reuse the serializer, return lobby snapshots keyed as `prompts`/`templates`, and push `prompt_updated` events whenever the store broadcasts.

## Verification
- `mise exec -- mix compile`
  ```
  Compiling 2 files (.ex)
  ...
  Generated ema app
  ```
- `mise exec -- mix ecto.migrate`
  ```
  23:53:46.885 [info] create index proposals_source_fingerprint_index
  23:53:46.886 [info] == Migrated 20260410010000 in 0.0s
  ```
- `mise exec -- mix ema.prompts.list --all`
  ```
  1 prompt(s):

    soul v1
      You are EMA ... (preview)
      id: prompt_1775274836569_feae88c6
  ```
- `LOG_LEVEL=error mise exec -- mix run -e '<hot reload script>'`
  ```
  before_version=3
  after_version=4
  restored_version=5
  ```
  (Script edits `priv/prompts/soul.md`, waits for the loader poll, and confirms the DB version bumps each time.)
- `mise exec -- mix precommit`
  ```
  Compilation failed due to warnings while using the --warnings-as-errors option
  ```
  (Existing warnings in unrelated modules block the alias; no new warnings were introduced by these changes.)

## Remaining Concerns
- `mix precommit` currently fails because long-standing warnings in modules such as `Ema.Babysitter.StreamChannels` violate the `--warnings-as-errors` flag; resolving them is outside this task’s scope.
- Loader poll interval is still 5s, so hot reload proof waits ~12s; shorten interval later if faster feedback is needed.
