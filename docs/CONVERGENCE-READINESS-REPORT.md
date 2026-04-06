# Convergence Readiness Report

**Date:** 2026-04-06  
**Scope:** Intent/Actor/Session/Execution/MCP seam verification  
**Verdict:** Safe for bounded autonomous work with noted caveats

---

## Verified Contract: What Is Safe To Rely On

### Semantic Layer (intents)

The canonical intent store is implemented and consistent across all surfaces:

| Surface | Module | Status |
|---------|--------|--------|
| Context | `daemon/lib/ema/intents/intents.ex` | CRUD, tree, links, lineage, status propagation, runtime bundle, attach verbs — all present |
| HTTP | `daemon/lib/ema_web/controllers/intents_controller.ex` | 10 actions: index, show, create, update, delete, tree, status, lineage, runtime, create_link + attach_actor, attach_execution, attach_session |
| CLI | `daemon/lib/ema/cli/commands/intent.ex` | list, show, tree, export, create, context, link, attach-actor, attach-execution, attach-session, runtime |
| MCP | `daemon/lib/ema/mcp/tools.ex` | 8 tools: get_intents, create_intent, get_intent_tree, get_intent_context, attach_intent_actor, attach_intent_execution, attach_intent_session, get_intent_runtime |
| Channel | `daemon/lib/ema_web/channels/intents_channel.ex` | join, push created/status_changed, get_tree, get_intent, create |
| Server routing | `daemon/lib/ema/mcp/server.ex` | All 8 intent tools explicitly routed to `Tools.call` |

**Verdict:** The intent/attachment contract is consistent across all 5 surfaces. Safe to use.

### Link Schema

`intent_links` (at `daemon/lib/ema/intents/intent_link.ex`) accepts:

- **14 linkable_types:** execution, intent, proposal, task, goal, brain_dump, session, claude_session, ai_session, agent_session, actor, harvest, vault_note, doc
- **10 roles:** origin, evidence, derived, related, superseded, context, owner, assignee, operator, runtime
- **9 provenances:** manual, approved, execution, session, harvest, cluster, import, inferred, system

This matches the INTENT-ACTOR-SESSION-CONTRACT.md exactly. The schema validates all three enums.

### Runtime Bundle

`get_runtime_bundle/1` returns:
- intent (serialized)
- actors (filtered links + hydrated record summaries)
- executions (filtered links + hydrated record summaries)
- sessions (filtered links + hydrated for claude_session, ai_session, agent_session)
- all links (serialized)
- lineage (last 20 events)

Hydration uses safe `case` lookups — returns nil for missing records, no crashes.

### Attachment Verbs

All three attachment functions validate target existence before creating a link:
- `attach_actor/3` — looks up actor by ID or slug
- `attach_execution/3` — verifies execution exists
- `attach_session/4` — normalizes session_type, fetches session record, maps provenance

The `normalize_session_type` correctly maps legacy `"session"` → `"claude_session"`.

---

## Remaining Risks (ordered by severity)

### 1. Migration Not Yet Run (BLOCKS LIVE USE)

The `intents`, `intent_links`, and `intent_events` tables don't exist in the running DB yet. The migration (`20260412000012`) and import script (`priv/repo/seeds/import_intents.exs`) are ready but unexecuted.

**To unblock:** `mix ecto.migrate && mix run priv/repo/seeds/import_intents.exs`

### 2. ema_create_task MCP Tool Boundary (RESOLVED)

Per `docs/CLAUDE-CODEX-ENGINE-LAUNCH.md` and the current CLI wiring, `ema_create_task` now sends the same flat field map that `/api/tasks` expects. The Node-level MCP wrapper merely proxies that payload over HTTP, so nothing strips the envelope anymore.

**Reminder:** run a quick `ema_create_task` call from Codex/Claude to confirm the auto-generated task appears in EMA after you run `mix phx.server`.

### 3. MCP Server Is Node.js Wrapper, Not Native Elixir

Per `docs/CLAUDE-CODEX-ENGINE-LAUNCH.md`: Claude uses `node ~/bin/ema-mcp-server.js`, not `mix ema.mcp.stdio`. The Node wrapper proxies to `http://localhost:4488/api`. This means:
- MCP tool calls go through HTTP, not direct Elixir module calls
- The `log_mcp_call` audit endpoint now exists (fixed this session), so logging should work
- Response envelope parsing depends on what the Node wrapper does to JSON responses

**Risk:** If the Node wrapper modifies response shapes, MCP tools may get unexpected data. Verify with a live `ema_get_intents` call.

### 4. Populator PubSub Format Depends on Broadcaster

The Populator handles `{"execution:completed", %{execution: execution}}` — verified correct against the broadcaster. But it does NOT subscribe to `"goals"` (confirmed by reading the code — operator removed goals subscription).

**Implication:** Goals don't auto-create intents. This is a deliberate design choice, not a bug.

### 5. Imported Bootstrap Data Has Weak Linkage

The import script creates intents from `.superman/intents/` folders and old `intent_nodes`, but these imports have:
- Lineage events (actor: "migration") — good
- No operational links (no intent_links to executions/sessions) — expected, these are historical

**Implication:** `get_runtime_bundle` for imported intents will show empty actors/executions/sessions. New intents created via brain dump or MCP will have proper links.

### 6. Two CLI Surfaces Still Exist

`Ema.CLI` (Optimus, canonical) and `EmaCli` (HTTP, legacy) both expose intent commands. Per the readiness audit, `EmaCli` should be treated as compatibility-only. New attachment verbs are in `Ema.CLI` only.

---

## What Is Safe for Autonomous Engine Work

| Capability | Safe? | Notes |
|-----------|-------|-------|
| Create intents via MCP | Yes | `ema_create_intent` → POST /api/intents, controller reads flat params |
| Attach actors/executions/sessions | Yes | All three verbs validated, existence-checked |
| Query intent tree | Yes | `ema_get_intent_tree` with optional project_id |
| Get runtime bundle | Yes | Hydrates linked records, handles missing gracefully |
| Brain dump → auto-intent | Yes (after migrate) | Populator subscribes to brain_dump, creates level-4 intents |
| Execution → intent update | Yes (after migrate) | Populator handles execution:completed, advances phase |
| Intent lineage inspection | Yes (after migrate) | Events emitted on all state changes |
| Context assembly with intents | Partial | ContextAssembler tries new Intents first, falls back to IntentMap |

---

## Go-Live Checklist

```bash
# 1. Run migration
cd /home/trajan/Projects/ema/daemon
mix ecto.migrate

# 2. Import existing data + self-bootstrap
mix run priv/repo/seeds/import_intents.exs

# 3. Verify
mix run -e "IO.inspect(Ema.Intents.status_summary())"
mix run -e "IO.inspect(length(Ema.Intents.list_intents()))"

# 4. Test MCP (from a Claude Code session)
# Call ema_get_intents to verify the Node wrapper passes through correctly

# 5. Test brain dump flow
# ema dump "test intent creation flow" 
# Then: ema intent tree --project=ema
```

---

## Files Referenced

| File | Role |
|------|------|
| `daemon/lib/ema/intents/intents.ex` | Canonical context module |
| `daemon/lib/ema/intents/intent.ex` | Schema: 6 levels, 7 kinds, 8 statuses, 10 source_types |
| `daemon/lib/ema/intents/intent_link.ex` | Schema: 14 linkable_types, 10 roles, 9 provenances |
| `daemon/lib/ema/intents/intent_event.ex` | Schema: 17 event types |
| `daemon/lib/ema/intents/populator.ex` | PubSub: brain_dump + execution → intent |
| `daemon/lib/ema_web/controllers/intents_controller.ex` | HTTP: 10+ actions |
| `daemon/lib/ema/cli/commands/intent.ex` | CLI: 11 subcommands |
| `daemon/lib/ema/mcp/tools.ex` | MCP: 8 intent tools |
| `daemon/lib/ema/mcp/server.ex` | Routing: all 8 explicitly listed |
| `daemon/lib/ema_web/channels/intents_channel.ex` | WebSocket: join, push, request |
| `daemon/lib/ema/second_brain/system_brain.ex` | Projection: debounced intents.md |
| `daemon/priv/repo/migrations/20260412000012_create_intents_engine.exs` | Migration |
| `daemon/priv/repo/seeds/import_intents.exs` | Import + bootstrap |
