# Intent Attachment Implementation Spec

Date: 2026-04-06

## Scope

Implement the first execution slice of the `INTENT-ACTOR-SESSION` contract:

- attach actor to intent
- attach execution to intent
- attach session to intent
- inspect runtime bundle for an intent

This slice is intentionally narrow. It does not redesign executions, session ingestion, or UI surfaces.

## Canonical APIs

### Context

- [intents.ex](/home/trajan/Projects/ema/daemon/lib/ema/intents/intents.ex)

New canonical helpers:

- `attach_actor/3`
- `attach_execution/3`
- `attach_session/4`
- `get_runtime_bundle/1`

### HTTP

- [intents_controller.ex](/home/trajan/Projects/ema/daemon/lib/ema_web/controllers/intents_controller.ex)
- [router.ex](/home/trajan/Projects/ema/daemon/lib/ema_web/router.ex)

New routes:

- `POST /api/intents/:id/actors`
- `POST /api/intents/:id/executions`
- `POST /api/intents/:id/sessions`
- `GET /api/intents/:id/runtime`

### CLI

- [intent.ex](/home/trajan/Projects/ema/daemon/lib/ema/cli/commands/intent.ex)
- [cli.ex](/home/trajan/Projects/ema/daemon/lib/ema/cli/cli.ex)

New commands:

- `ema intent attach-actor <intent_id> --actor=<actor_id_or_slug>`
- `ema intent attach-execution <intent_id> --execution=<execution_id>`
- `ema intent attach-session <intent_id> --session=<session_id> --session-type=claude_session|ai_session|agent_session`
- `ema intent runtime <intent_id>`

### MCP

- [tools.ex](/home/trajan/Projects/ema/daemon/lib/ema/mcp/tools.ex)
- [server.ex](/home/trajan/Projects/ema/daemon/lib/ema/mcp/server.ex)
- [mcp_controller.ex](/home/trajan/Projects/ema/daemon/lib/ema_web/controllers/mcp_controller.ex)

New tools:

- `ema_attach_intent_actor`
- `ema_attach_intent_execution`
- `ema_attach_intent_session`
- `ema_get_intent_runtime`

## Data Rules

- `intent_links` remains the semantic bridge table.
- runtime home tables remain authoritative in their own domains.
- attachments validate target existence before inserting a link.
- session links should prefer explicit types:
  - `claude_session`
  - `ai_session`
  - `agent_session`

## Runtime Bundle Shape

The runtime bundle should include:

- `intent`
- `actors`
- `executions`
- `sessions`
- `links`
- `lineage`

Each actor/execution/session entry should include:

- the link metadata
- a lightweight record summary for immediate operator and agent use

## Non-Goals

This slice does not:

- infer attachments automatically
- backfill all imported intent links
- unify `claude_sessions` and `ai_sessions`
- add UI affordances beyond existing generic surfaces

## Done When

- actor, execution, and session attachments can be created from HTTP, CLI, and MCP
- runtime bundle loads from the intent side
- MCP HTTP bridge and stdio MCP route the new tools consistently
- compile succeeds for this slice
