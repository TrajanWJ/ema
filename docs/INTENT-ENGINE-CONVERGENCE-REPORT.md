# Intent Engine Convergence Report

Date: 2026-04-06
Scope: Bounded readiness pass per `INTENT-ENGINE-BOOTSTRAP-START.md`

## Verified Contract Status

### 1. Semantic Core — PASS

Runtime code in `daemon/lib/ema/intents/` is internally consistent:

- **Intent schema** (`intent.ex`): 6 levels (vision/goal/project/feature/task/execution), 8 statuses, 7 kinds, 9 source types. Valid.
- **IntentLink schema** (`intent_link.ex`): 14 linkable types including all 3 session types + actor + intent. 10 roles including `owner`/`assignee`/`operator`/`runtime`. 9 provenance classes. Matches the actor-session contract.
- **IntentEvent schema** (`intent_event.ex`): 17 event types. Missing `projection_rebuilt` from spec — acceptable since projections aren't automated yet.
- **Context module** (`intents.ex`): Full CRUD, tree ops, attach helpers for actor/execution/session, runtime bundle, status propagation. All attachment helpers validate target existence before linking.

### 2. Populator (Brain Dump → Intent, Execution → Intent) — PASS

`populator.ex`:
- Brain dump creates level-4 task intent with `source_fingerprint` dedup, `medium` provenance, and `origin` link. Correct.
- Execution completion: 3-step fallback (existing link → brain_dump anchor → intent_slug). Creates `derived` link with `execution` provenance. Correct.
- Both paths match the contract.

### 3. Dispatcher Intent Linking — PASS with note

`dispatcher.ex:173-194`: `maybe_link_intent_to_execution/1` creates `derived`/`execution` link when `intent_slug` is set. This is a **second** code path for the same operation as `Populator.find_or_attach_intent_for_execution/1`. Both use `on_conflict: :nothing` so duplicates are harmless, but the redundancy should be noted for future consolidation.

### 4. MCP Intent Tools — FIXED

8 MCP tools registered in both stdio (`server.ex:226-233`) and HTTP bridge (`mcp_controller.ex:52-59`). Tool routing is symmetric.

**Fixes applied:**
- `ema_get_intents`: Was returning `%{"intents" => [...]}` as the intents value instead of unwrapping the list. Fixed to extract `body["intents"]`.
- `ema_get_intent_tree`: Same issue — was returning `%{"tree" => [...]}` wrapper. Fixed to extract `body["tree"]`.
- `ema_get_intent_context`: Lineage response was returning `%{"events" => [...]}` wrapper. Fixed to extract `body["events"]`.
- Level names in tool descriptions were stale (said "mission"/"objective" for levels 1/3). Fixed to match runtime: goal/feature.
- Status enum in tool description included non-existent "draft". Fixed to match runtime: `planned active researched outlined implementing complete blocked archived`.

### 5. CLI Intent Semantics — FIXED

**Canonical CLI** (`Ema.CLI.Commands.Intent`): All 11 subcommands implemented with both Direct and HTTP transport. Matches the contract verbs.

**Legacy CLI** (`EmaCli.Intent`): 8 subcommands, HTTP-only. Covers: search, list, graph, trace, create, context, status, link. No attachment commands — acceptable for compatibility surface.

**Fix applied:**
- Both CLIs defaulted the `intent link` role to `"depends_on"`, which is not a valid role in `IntentLink.@roles`. Changed to `"related"`. Without this fix, every `ema intent link` call without an explicit `--role` flag would fail Ecto validation.

### 6. HTTP Routes — PASS

Router (`router.ex:420-430`): All attachment routes present:
- `GET /api/intents/status`
- `GET /api/intents/tree`
- `GET /api/intents/:id/tree`
- `GET /api/intents/:id/lineage`
- `GET /api/intents/:id/runtime`
- `POST /api/intents/:id/actors`
- `POST /api/intents/:id/executions`
- `POST /api/intents/:id/sessions`
- `POST /api/intents/:id/links`
- Standard CRUD via `resources "/intents"`

### 7. WebSocket Channel — PASS with gap

`IntentsChannel` broadcasts: `intent_created`, `intent_status_changed`, `intent_linked`. Client requests: `get_tree`, `get_intent`, `create`.

**Gap:** No channel events for actor/session/execution attachment or lineage changes. The contract calls for these but they are Phase 4 work per the readiness audit.

### 8. Context Assembly — PASS with note

`ContextAssembler` (`memory/context_assembler.ex`):
- Hot tier correctly pulls from `Ema.Intents` with fallback to legacy `IntentMap`. Correct transitional behavior.
- The two planned ContextInjector keys (`:intents`, `:host_knowledge`) are documented but not implemented. This is a known gap, not a regression.

### 9. Wiki Accuracy — PASS

All three wiki pages checked:
- `Intent-System.md`: Accurate. Schema, context module, populator, MCP tools all match runtime.
- `Context-Assembly.md`: Accurate. Three context modules correctly described. Intent-aware context correctly listed as "Designed" not "Working".
- `Knowledge-Topology.md`: Accurate. Uses `intent_links` (not stale `intent_edges`). Three truths model matches runtime.

## Stale Doc Claims (docs/ only, not wiki)

| Doc | Claim | Reality |
|-----|-------|---------|
| `INTENT-ENGINE-SPEC.md:41,83` | `intent_edges` table exists | No such table in runtime. Relationships are via `intent_links` with `linkable_type: "intent"`. |
| `INTENT-ENGINE-SPEC.md:196` | `projection_rebuilt` event type | Not in `IntentEvent.@event_types`. Aspirational. |
| `INTENT-ENGINE-SPEC.md:303` | "Existing `intent_edges` remain readable" | Only `intent_nodes` migration exists. No `intent_edges` table was ever created. |
| `DATA_MODELS.md:590-593` | Documents `intent_edges` schema | This table does not exist in runtime. |

These docs are spec/design artifacts. They don't need fixing — they document design intent. The wiki pages (which agents actually consume) are correct.

## Fixes Applied

| File | Fix | Risk |
|------|-----|------|
| `daemon/lib/ema/cli/commands/intent.ex:195` | Default link role `"depends_on"` → `"related"` | Low — prevents silent validation failure |
| `daemon/lib/ema_cli/intent.ex:86` | Same fix for legacy CLI | Low |
| `daemon/lib/ema/mcp/tools.ex` (3 locations) | MCP response shape: extract `body["intents"]`, `body["tree"]`, `body["events"]` instead of falling back to wrapper maps | Medium — affects all MCP intent tool consumers |
| `daemon/lib/ema/mcp/tools.ex` (2 locations) | Level names in descriptions: mission→goal, objective→feature | Low — documentation accuracy |
| `daemon/lib/ema/mcp/tools.ex` (1 location) | Status enum in description: removed "draft", added full list | Low — documentation accuracy |

## Remaining Risks

### High Priority

1. **Dual intent-linking in Dispatcher + Populator**: Both `Dispatcher.maybe_link_intent_to_execution/1` and `Populator.find_or_attach_intent_for_execution/1` create execution→intent links. `on_conflict: :nothing` prevents duplicates, but the Populator additionally advances intent phase/status which the Dispatcher does not. If PubSub ordering varies, the Populator might miss an execution that the Dispatcher already linked but didn't update semantically.

2. **No `intent_edges` table**: The spec assumes edge-based relationships between intents. Currently, intent-to-intent links use `intent_links` with `linkable_type: "intent"`. This works but loses typed edge semantics (depends_on, blocks, supersedes). If edge types are needed, `intent_links.role` carries that meaning, but the contract should be explicit about this.

### Medium Priority

3. **Legacy CLI drift**: `EmaCli.Intent` lacks attachment commands (`attach-actor`, `attach-execution`, `attach-session`, `runtime`). Users on the legacy surface can't perform the full contract. The canonical CLI (`Ema.CLI`) has everything.

4. **Channel attachment visibility**: `IntentsChannel` doesn't broadcast attachment changes. Frontend won't see real-time actor/session/execution attachments.

5. **ContextInjector `:intents` key**: Documented as planned in wiki but not implemented. Agent context bundles don't yet include intent spine data via the ContextInjector path (ContextAssembler's hot tier does include open intents).

### Low Priority

6. **MCP `ema_get_intent_context` makes 2 HTTP calls**: Fetches `/intents/:id` (which already returns links + lineage via `get_intent_detail`) and then separately fetches `/intents/:id/lineage`. The second call is redundant. Not a correctness issue — just an extra round trip.

## Readiness Assessment

The Intent Engine contract is **convergent across all surfaces** after these fixes:
- CLI (canonical + legacy) ✓
- HTTP REST ✓
- MCP (stdio + HTTP bridge) ✓
- WebSocket channel (partial — missing attachment broadcasts)
- Context assembly (partial — ContextInjector extension pending)

**Safe for agent use.** An EMA-managed agent can now discover intents, create intents, attach actors/executions/sessions, and inspect runtime bundles through any surface without hitting silent contract violations.
