# Intent Engine — Features Map

Generated: 2026-04-06

---

## 1. Built and Ready

### Schemas

| Component | File | Description |
|-----------|------|-------------|
| `Ema.Intents.Intent` | `daemon/lib/ema/intents/intent.ex` | Core schema. String PK (`int_<ts>_<rand>`), 6 levels (0=vision..5=execution), 9 kinds, 8 statuses, 8 source types. Has parent/children self-referential tree, belongs_to project, has_many links and events. JSON-encoded tags and metadata fields. Auto-generates slug from title. |
| `Ema.Intents.IntentLink` | `daemon/lib/ema/intents/intent_link.ex` | Polymorphic link table bridging intents to operational records. `linkable_type` supports: execution, proposal, task, goal, brain_dump, session, harvest, vault_note, doc. Roles: origin, evidence, derived, related, superseded, context. Provenance tracking: manual, approved, execution, harvest, cluster, import. Unique constraint on (intent_id, linkable_type, linkable_id). |
| `Ema.Intents.IntentEvent` | `daemon/lib/ema/intents/intent_event.ex` | Append-only lineage spine. 16 event types covering full lifecycle: created, status_changed, phase_advanced, linked, unlinked, reparented, merged, split, archived, execution_started, execution_completed, confirmed, promoted, demoted, crystallized, outcome_recorded, imported. JSON payload, actor field. |

### Context Module

| Feature | Location | Details |
|---------|----------|---------|
| CRUD | `daemon/lib/ema/intents/intents.ex` | `create_intent/1`, `update_intent/2`, `delete_intent/1`, `get_intent/1`, `get_intent!/1` |
| Filtered listing | same | `list_intents/1` with opts: `:project_id`, `:level`, `:status`, `:kind`, `:parent_id`, `:source_type`, `:limit` |
| Lookup by slug | same | `get_intent_by_slug/1` |
| Lookup by fingerprint | same | `get_intent_by_fingerprint/1` — dedup key for imports |
| Tree building | same | `tree/1` — recursive subtree assembly from roots (parent_id IS NULL), filterable by project |
| Detail view | same | `get_intent_detail/1` — intent + links + lineage events in one call |
| Status summary | same | `status_summary/1` — counts by status bucket (planned, active, blocked, complete, etc.) |
| Parent chain | same | `parent_chain/1` — walk up to root, returns list |
| Status propagation | same | `propagate_status/1` — on child status change, recomputes parent `completion_pct`; auto-completes parent when all children complete |
| Link management | same | `link_intent/4`, `unlink_intent/3`, `get_links/2` with type/role filtering |
| Lineage events | same | `emit_event/4`, `get_lineage/2` |
| Serialization | same | `serialize/1`, `serialize_tree/1`, `serialize_link/1`, `serialize_event/1` — all fields including decoded tags/metadata |
| Markdown export | same | `export_markdown/1` — renders tree as indented markdown with status icons (+, ~, !, o) |
| PubSub broadcast | same | Broadcasts `"intents:created"` and `"intents:status_changed"` on the `"intents"` topic |

### Populator (GenServer)

| Feature | File | Details |
|---------|------|---------|
| Brain dump auto-import | `daemon/lib/ema/intents/populator.ex` | Subscribes to `"brain_dump"` PubSub topic. On `:item_created`, creates level-4 task intent with `source_fingerprint: "brain_dump:<id>"`. Links back to brain_dump item with role "origin". Idempotent via fingerprint check. |
| Execution tracking | same | Subscribes to `"executions"` PubSub topic. On `"execution:completed"`, finds linked intent (via IntentLink or brain_dump anchor or intent_slug field), advances phase by 1, transitions status to "researched" on completion. |
| Supervised startup | `daemon/lib/ema/application.ex` | `Ema.Intents.Populator` is in the children list (line 48), starts unconditionally on boot. |

### REST API

| Feature | File | Details |
|---------|------|---------|
| Controller | `daemon/lib/ema_web/controllers/intents_controller.ex` | Full CRUD + tree + status + lineage endpoints. Uses `FallbackController` for error handling. |

### Migration

| File | Tables Created |
|------|---------------|
| `daemon/priv/repo/migrations/20260412000012_create_intents_engine.exs` | `intents` (12 indexes including unique on slug and source_fingerprint), `intent_links` (3 indexes including unique triple), `intent_events` (3 indexes). Foreign keys: parent_id self-ref with nilify_all, project_id to projects with nilify_all, intent_id on links/events with delete_all. |

### Import Script

| File | Details |
|------|---------|
| `daemon/priv/repo/seeds/import_intents.exs` | Three-phase idempotent import: (A) reads `intent_nodes` table if it exists, maps old statuses, links associated tasks; (B) scans `daemon/.superman/intents/` folders, parses `intent.md` and `status.json`, infers kind from slug prefix; (C) creates bootstrap intent tree ("Build EMA Intent Engine" at level 2 with 5 level-3 children). All phases use `source_fingerprint` for dedup and emit "imported" events. |

### Vault Structure

| Directory | Contents |
|-----------|----------|
| `~/.local/share/ema/vault/intents/` | Generated projection views: `by-project/`, `by-level/`, `by-status/`. Index file declares these as rebuildable projections from canonical `intents` table. |
| `~/.local/share/ema/vault/imports/` | Source-labeled mirrors: `host/`, `agent-vm/`. Provenance labels, provisional until promoted to wiki/. |
| `~/.local/share/ema/vault/archive/` | Append-only: `sessions/`, `retrospectives/`, `promoted/`. Immutable historical records. |

### Prior Migration (Harvested Intents)

| File | Details |
|------|---------|
| `daemon/priv/repo/migrations/20260405100001_create_harvested_sessions_and_intents.exs` | Pre-existing `harvested_intents` table (separate from the new canonical `intents` table). Contains raw harvested content, quality scores, loaded flag, and links to harvested_sessions. This is the *intake* layer; the new Intent Engine is the *canonical* layer. |

---

## 2. Wired but Untested

| Feature | Details |
|---------|---------|
| Migration against live DB | The `20260412000012_create_intents_engine.exs` migration has not been run against the production SQLite DB at `~/.local/share/ema/ema.db`. Schema and context module compile but table may not exist yet. |
| Import script end-to-end | `import_intents.exs` has not been run. Part A depends on `intent_nodes` table existing (may or may not). Part B depends on `.superman/intents/` folder contents. |
| Populator brain_dump flow | Populator subscribes and compiles, but the brain_dump PubSub message format (`{:brain_dump, :item_created, item}`) must match what `BrainDumpController` actually broadcasts. Not verified against live traffic. |
| Populator execution flow | Listens for `"execution:completed"` on `"executions"` topic. Depends on execution records having `brain_dump_item_id` or `intent_slug` fields for anchor resolution. Not verified against live data. |
| Status propagation cascades | `propagate_status/1` recomputes parent completion percentage. Recursive behavior (child complete -> parent recompute -> grandparent recompute) relies on `update_intent` triggering propagation again. Not tested with deep trees. |
| CLI link subcommand (daemon) | `handle([:link], ...)` in daemon CLI posts to `/intents/:id/links` but the router has no such route — only the resources routes exist. The link endpoint is not wired in the router. |
| CLI link subcommand (standalone) | `run("link", ...)` in standalone CLI posts to `/intents/:id/links` — same missing route issue. |
| MCP tool `ema_create_intent` | Posts to `/api/intents` with `%{intent: payload}` wrapper, but the controller's `create/2` reads params directly (e.g., `params["title"]`), not from a nested `"intent"` key. Likely mismatch. |

---

## 3. Spec'd but Not Built

| Feature | Status |
|---------|--------|
| Intent Projector GenServer | Vault `intents/_index.md` references a "Intent Projector" that generates `by-project/`, `by-level/`, `by-status/` markdown files from the DB. Directory structure exists but no GenServer or task writes these files. |
| Vault convergence | Bootstrap intent lists "Vault Convergence" as planned. No code merges VaultIndex/Notes/SecondBrain with Intents. |
| Frontend (Wikipedia-style UI) | Bootstrap intent lists "Wikipedia Frontend" as planned. No React components for intents exist in `app/src/`. |
| WebSocket channel for intents | PubSub broadcasts on `"intents"` topic exist, but no Phoenix Channel joins this topic. No `IntentChannel` module exists. |
| Intent merge/split operations | Event types `merged` and `split` are defined in IntentEvent but no context functions implement merging or splitting intents. |
| Intent reparent operation | Event type `reparented` is defined but no `reparent_intent/2` function exists. |
| Intent confirm/promote/demote | Event types `confirmed`, `promoted`, `demoted` are defined but no functions implement these lifecycle transitions. |
| Intent crystallize | Event type `crystallized` is defined but not implemented. |
| Outcome recording | Event type `outcome_recorded` is defined but not implemented. |
| Search endpoint | Standalone CLI `run("search", ...)` calls `/intents?search=<query>` but the controller's `index/2` does not implement a search parameter — it only does exact-match filtering. |
| `/intents/:id/links` route | Both CLI modules attempt to POST to this route for link creation, but it is not in the router. Only resources routes exist. |
| Goal creation auto-import | Populator moduledoc mentions subscribing to `goals:created` for level-1 goal intents, but no such subscription exists in `init/1` (only `brain_dump` and `executions` are subscribed). |
| Proposal auto-import | Proposals are a linkable_type but no Populator handler creates intents from approved proposals. |
| Session harvest auto-import | Sessions are a linkable_type but no Populator handler creates intents from harvested sessions. |

---

## 4. Adjacent Systems

| System | Connection |
|--------|------------|
| **Brain Dump** (`Ema.BrainDump`) | Populator subscribes to `brain_dump` PubSub. New items auto-create level-4 task intents with origin links. |
| **Executions** (`Ema.Executions`) | Populator subscribes to `executions` PubSub. Completed executions advance linked intent phase/status. Execution controller has `/intents/:project_slug/:intent_slug/status` route. |
| **Projects** (`Ema.Projects`) | Intents have `project_id` FK. Listing, tree, status all support project filtering. |
| **Tasks** (`Ema.Tasks`) | Linkable type "task" — import script links tasks to intents. No live sync yet. |
| **Proposals** (`Ema.Proposals`) | Linkable type "proposal" — structure exists but no auto-population. |
| **Goals** (`Ema.Goals`) | Linkable type "goal" — level 1 intents map conceptually to goals. No auto-population. |
| **SecondBrain / Vault** (`Ema.SecondBrain`) | Linkable type "vault_note". Vault projections at `~/.local/share/ema/vault/intents/`. No live integration. |
| **Superman** (`.superman/intents/`) | Import script reads Superman intent folders. One-time migration, not ongoing sync. |
| **IntentionFarmer** (`Ema.IntentionFarmer`) | Separate system that runs on startup via `StartupBootstrap.run_async()`. Related but distinct from Intent Engine. |
| **Harvested Intents** (`harvested_intents` table) | Pre-existing intake table. Import script does not read from it (reads `intent_nodes` instead). Potential future bridge. |

---

## 5. CLI Commands

### Daemon CLI (`Ema.CLI.Commands.Intent`)

Located at `daemon/lib/ema/cli/commands/intent.ex`. Supports both Direct (in-process) and HTTP transports.

| Command | Description |
|---------|-------------|
| `intent list [--project=X] [--level=N] [--status=S] [--kind=K] [--limit=N]` | List intents with filters. Renders as table with ID, Title, Level, Kind, Status, Project columns. |
| `intent show <id>` | Show full intent detail (intent + links + lineage). |
| `intent tree [--project=X]` | Display intent hierarchy as nested tree. |
| `intent export [--project=X]` | Export intent tree as markdown (direct transport uses `export_markdown/1`). |
| `intent create <title> [--level=N] [--kind=K] [--project=X] [--description=D]` | Create a new intent. |
| `intent status [--project=X]` | Show status summary (counts by status bucket). |
| `intent context <id>` | Show intent with links and lineage in a formatted view. |
| `intent link <id> --depends-on=<target_id> [--role=R]` | Link two intents (posts to unimplemented route via HTTP transport). |

### Standalone CLI (`EmaCli.Intent`)

Located at `daemon/lib/ema_cli/intent.ex`. HTTP-only (calls daemon API).

| Command | Description |
|---------|-------------|
| `ema intent search <query> [--project=X]` | Search intents (calls `/intents?search=<query>` — search param not implemented in controller). |
| `ema intent list [--project_id=X] [--level=N] [--status=S] [--kind=K] [--limit=N]` | List intents with filters. |
| `ema intent graph [--project=X]` | Display ASCII tree of intent hierarchy with status icons and level labels. |
| `ema intent trace <id>` | Fetch and display a single intent by ID. |
| `ema intent context <id>` | Show intent with formatted links and lineage sections. |
| `ema intent status [--project=X]` | Print status summary line (e.g., "15 intents: 3 active, 5 planned, 2 blocked"). |
| `ema intent link <id> --depends-on=<target_id> [--role=R]` | Create intent-to-intent link (posts to unimplemented route). |
| `ema intent create <title> [--project=X] [--level=N] [--kind=K] [--description=D] [--parent_id=X]` | Create a new intent via API. |

---

## 6. MCP Tools

Located in `daemon/lib/ema/mcp/tools.ex`.

| Tool Name | Parameters | Description |
|-----------|------------|-------------|
| `ema_get_intents` | `project_id?: string`, `level?: int (0-5)`, `status?: string`, `kind?: string`, `limit?: int (default 20)` | List intents with optional filters. Returns serialized intents array with count. |
| `ema_create_intent` | `title: string` (required), `description?: string`, `level?: int (default 4)`, `kind?: string (default "task")`, `project_id?: string`, `parent_id?: string` | Create a new intent. Note: sends payload nested under `intent` key but controller reads flat params — likely needs fix. |
| `ema_get_intent_tree` | `project_id?: string` | Get full intent hierarchy as nested tree. Optional project filter. |
| `ema_get_intent_context` | `intent_id: string` (required) | Get intent + links + lineage events. Makes two API calls (show + lineage). |

### MCP Resources

Located in `daemon/lib/ema/mcp/resources.ex`.

| URI | Description |
|-----|-------------|
| `ema://intents/active` | Active intents (calls `/api/intents?status=active&limit=20`) |
| `ema://intents/tree` | Full intent tree. Supports `?project_id=X` query parameter. |

---

## 7. API Endpoints

All under `/api` prefix. Defined in `daemon/lib/ema_web/router.ex`.

| Method | Path | Controller Action | Description |
|--------|------|-------------------|-------------|
| GET | `/api/intents` | `IntentsController.index` | List intents. Query params: `project_id`, `level`, `status`, `kind`, `limit`. |
| GET | `/api/intents/status` | `IntentsController.status` | Status summary counts. Query param: `project_id`. |
| GET | `/api/intents/tree` | `IntentsController.tree` | Full tree (all roots). Query param: `project_id`. |
| GET | `/api/intents/:id/tree` | `IntentsController.tree` | Tree rooted at a project (uses `id` as `project_id`). |
| GET | `/api/intents/:id/lineage` | `IntentsController.lineage` | Lineage events for an intent. |
| GET | `/api/intents/:id` | `IntentsController.show` | Intent detail (intent + links + lineage). |
| POST | `/api/intents` | `IntentsController.create` | Create intent. Body: `title`, `slug`, `description`, `level`, `kind`, `parent_id`, `project_id`, `source_type`, `status`, `priority`, `tags`, `metadata`. |
| PUT/PATCH | `/api/intents/:id` | `IntentsController.update` | Update intent fields. |
| DELETE | `/api/intents/:id` | `IntentsController.delete` | Delete intent. |

### Related Routes (Legacy Intent Map)

| Method | Path | Controller | Notes |
|--------|------|------------|-------|
| GET | `/api/intent/nodes` | `IntentController.index` | Legacy intent_nodes system (separate from Intent Engine) |
| GET | `/api/intent/tree/:project_id` | `IntentController.tree` | Legacy |
| GET | `/api/intent/export/:project_id` | `IntentController.export` | Legacy |
| POST/GET/PUT/DELETE | `/api/intent/nodes[/:id]` | `IntentController.*` | Legacy CRUD |

### Execution Intent Status Route

| Method | Path | Controller | Notes |
|--------|------|------------|-------|
| GET | `/api/intents/:project_slug/:intent_slug/status` | `ExecutionController.intent_status` | Execution-side intent status lookup |

---

## 8. Vault Structure

```
~/.local/share/ema/vault/
  intents/
    _index.md                  # "Intent Projections" — rebuildable views index
    by-project/                # Intents grouped by project (empty, awaiting projector)
    by-level/                  # Intents grouped by level (empty, awaiting projector)
    by-status/                 # Intents grouped by status (empty, awaiting projector)
  imports/
    _index.md                  # "Imports" — source-labeled external knowledge
    _provenance.md             # Import provenance log
    host/                      # Extracts from host machine
    agent-vm/                  # Extracts from agent VM
  archive/
    _index.md                  # "Archive" — immutable append-only records
    sessions/                  # Archived session summaries
    retrospectives/            # Completed intent retrospectives
    promoted/                  # Pre-edit snapshots of promoted content
```

---

## 9. Migration Checklist

Steps to go live on a running EMA instance:

### A. Run the migration

```bash
cd daemon
mix ecto.migrate
```

This creates the `intents`, `intent_links`, and `intent_events` tables. The migration (`20260412000012`) depends on the `projects` table existing (FK reference).

### B. Run the import script

```bash
cd daemon
mix run priv/repo/seeds/import_intents.exs
```

Three phases:
1. Reads `intent_nodes` table (if exists) and migrates rows
2. Reads `.superman/intents/` folders and imports intent.md + status.json
3. Creates bootstrap intent tree for the Intent Engine itself

### C. Verify

```bash
# Check intent count via CLI
ema intent list --limit=5

# Check status summary
ema intent status

# Check tree renders
ema intent graph
```

### D. Known issues to fix before production use

1. **MCP `ema_create_intent` payload mismatch** — Tool wraps params in `%{intent: payload}` but controller reads `params["title"]` directly. Either unwrap in the tool or add `Map.get(params, "intent", params)` to the controller.
2. **Missing `/intents/:id/links` route** — Both CLI modules try to POST to this for link creation. Add a route or rework CLIs to use the context module directly.
3. **Missing `search` query param** — Standalone CLI `search` subcommand passes `?search=<query>` but controller does not implement text search. Either add FTS or remove the CLI subcommand.
4. **Goals PubSub subscription** — Populator moduledoc claims it listens to `goals:created` but `init/1` only subscribes to `brain_dump` and `executions`.
5. **Intent Projector** — Vault directory structure exists but no code generates the projection files.
