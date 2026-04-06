# Session Onboarding, Self-Bootstrap Engine & Data Import

**Date:** 2026-04-05
**Status:** Draft
**Scope:** Three interconnected systems that make EMA self-aware of its own development history, feed that knowledge back into its engine, and eventually ingest external life data.

---

## Problem

EMA has 3,145 CLI session files (2,982 Claude, 163 Codex) totalling 1.25GB of development history sitting on disk. The IntentionFarmer can harvest and classify them. The SecondBrain can store wiki notes. The Pipes engine can automate event flows. The Intelligence.Router can classify and route. But nothing ties these together into a coherent boot-time pipeline that:

1. Loads all session history into EMA's knowledge graph on startup
2. Extracts decisions, learnings, and patterns into wiki notes with wikilinks
3. Creates a self-reinforcing loop where working on EMA improves EMA's own context
4. Provides a framework for importing external data (Google Takeout, etc.) through the same pipeline

## Existing Infrastructure (What We Build On)

| System | Status | What It Does |
|--------|--------|-------------|
| `IntentionFarmer` | 95% working | Parses Claude + Codex sessions, classifies intents (fix/task/question/exploration/goal), dedup via fingerprint, bulk loads to DB |
| `Harvesters` (4 of 5) | Working | Git, Session, Vault, BrainDump harvesters create proposal seeds on tick intervals |
| `Intelligence.Router` | Working | Event classification, context injection via ContextInjector, routes to agents |
| `Superman.KnowledgeGraph` | Working | ETS-backed project intelligence graph with ranked node retrieval |
| `Pipes` | Working | 22 triggers, 15 actions, full executor with transforms. Has `claude:run`, `vault:create_note`, `vault:search` |
| `SecondBrain` | Working | VaultWatcher, GraphBuilder (wikilink parsing), FTS Indexer |
| `CliManager.Scanner` | Working | Discovers 9 CLI tools on PATH, stores binary_path + version |
| `Ingestor` | 40% stub | Job lifecycle works, extraction logic stubbed |
| `SessionParser` | Working | Parses Claude JSONL: session_id, tool_calls, files_touched, tokens, timestamps |

## Architecture

```
BOOT SEQUENCE
─────────────
Application.start
  └─ (post-boot Task, 4s delay)
     └─ Onboarding.Orchestrator.run()
        ├─ 1. Scanner.scan()                    ← refresh CLI tool inventory
        ├─ 2. IntentionFarmer.BacklogFarmer     ← harvest all session files
        │     ├─ SourceRegistry.refresh()       ← discover ~/.claude, ~/.codex paths
        │     ├─ Parser.parse_all()             ← Claude JSONL + Codex JSONL
        │     ├─ Cleaner.clean()                ← dedup, quality score
        │     └─ Loader.load()                  ← bulk insert to DB
        ├─ 3. Harvesters (immediate run)        ← git/session/vault/braindump
        ├─ 4. WikiWriter.process_batch()        ← create vault notes from intents
        │     ├─ Group intents by project
        │     ├─ AI summarize (haiku, batched)
        │     ├─ Generate markdown with [[wikilinks]]
        │     ├─ SecondBrain.create_note()
        │     └─ Mark sessions onboarded_at
        ├─ 5. Superman.KnowledgeGraph.ingest()  ← feed extracted nodes
        └─ 6. EventBus.broadcast("system:boot_onboard_complete", stats)


RUNTIME SELF-BOOTSTRAP LOOP
────────────────────────────
New CLI session detected (SessionWatcher / IntentionFarmer.Watcher)
  └─ IntentionFarmer parses + classifies
     ├─ Path A: SessionHarvester creates proposal seeds     [EXISTING]
     ├─ Path B: Pipe "intent:loaded → tasks:create"         [NEW PIPE]
     ├─ Path C: WikiWriter creates vault note                [NEW]
     └─ Path D: KnowledgeGraph.ingest() updates context     [NEW]
        └─ Next agent session gets enriched context
           └─ Produces better output
              └─ Session gets harvested → loop


DATA IMPORT PIPELINE
────────────────────
User drops export to ~/.local/share/ema/imports/ (or via UI)
  └─ DataImport.Detector scans for known formats
     └─ Creates IngestJob per source
        └─ Ingestor.Processor dispatches to parser
           └─ Parser emits %ParsedDocument{} structs
              └─ Same pipeline: classify → wiki write → index
```

---

## System 1: Boot Orchestrator

### Module: `Ema.Onboarding.Orchestrator`

GenServer started post-boot via `Task.start/1` in `application.ex` (4s delay, same pattern as OpenClaw sync and FTS reindex).

```elixir
# Pseudocode — init flow
def run do
  last = Settings.get("onboarding.last_full_run")
  mode = if stale?(last, 24 * 3600), do: :full, else: :incremental

  # Phase 1: Discovery
  tools = Scanner.scan()
  sources = IntentionFarmer.SourceRegistry.refresh()

  # Phase 2: Harvest (already idempotent via fingerprints)
  {:ok, harvest_stats} = IntentionFarmer.BacklogFarmer.run_now()
  {:ok, harvester_stats} = Harvesters.run_all_now()

  # Phase 3: Wiki extraction (new sessions only)
  unprocessed = IntentionFarmer.list_unprocessed_sessions()
  wiki_stats = WikiWriter.process_batch(unprocessed, concurrency: 3)

  # Phase 4: Knowledge graph refresh
  kg_stats = refresh_knowledge_graph(wiki_stats.notes_created)

  # Phase 5: Broadcast completion
  stats = %{mode: mode, tools: length(tools), sessions_harvested: harvest_stats.total,
            intents_loaded: harvest_stats.intents, wiki_notes: wiki_stats.count,
            kg_nodes: kg_stats.nodes_ingested}
  EventBus.broadcast_event("system:boot_onboard_complete", stats)
  Settings.set("onboarding.last_full_run", DateTime.utc_now())

  Logger.info("[Orchestrator] Boot onboarding complete: #{inspect(stats)}")
end
```

**Concurrency control:** WikiWriter uses `Task.Supervisor` with `max_concurrency: 3` via `Task.async_stream/3`. AI classification calls are the bottleneck — batches 5 sessions per Claude haiku call.

**Incremental mode:** Only processes sessions where `onboarded_at IS NULL`. Full mode re-scans source directories and re-runs fingerprint dedup.

**Failure handling:** Each phase is independent. If WikiWriter fails on session N, it logs the error, marks that session as `onboard_failed`, and continues. Orchestrator always completes.

---

## System 2: Wiki Writer

### Module: `Ema.Onboarding.WikiWriter`

Takes `HarvestedSession` records with their `HarvestedIntent` children and produces SecondBrain vault notes.

### Processing Flow

```
For each unprocessed session:
  1. Load session + intents from DB
  2. Group by project (via session.project_id or path matching)
  3. For significant sessions (token_count > 500 OR intents > 1):
     a. Build AI prompt with session metadata + intent summaries
     b. Call Bridge.run() with haiku model — extract:
        - 2-3 sentence summary
        - Key decisions made (if any)
        - Learnings/gotchas (if any)
        - Technologies/patterns used
     c. Generate markdown with [[wikilinks]]
     d. Write to vault via SecondBrain.create_note()
     e. Mark session.onboarded_at = now
  4. For minor sessions (token_count <= 500, single intent):
     a. Skip AI call — generate simple note from metadata
     b. Or skip entirely if trivial (< 200 tokens, no tool calls)
```

### Vault Structure

```
vault/
├── sessions/                           ← session notes live here
│   ├── <project-slug>/
│   │   ├── YYYY-MM-DD-<summary>.md    ← per-session notes
│   │   └── _index.md                  ← auto-generated project session index
│   └── unlinked/                      ← sessions not matched to a project
│       └── YYYY-MM-DD-<summary>.md
├── decisions/                          ← extracted architecture decisions
│   └── YYYY-MM-DD-<decision>.md
├── learnings/                          ← extracted gotchas and fixes
│   └── YYYY-MM-DD-<learning>.md
└── imports/                            ← data import notes (System 4)
```

### Note Template

```markdown
---
source_type: {{source_type}}
session_id: {{session_id}}
date: {{date}}
project: {{project_slug}}
intent_types: {{intent_types}}
tokens: {{token_count}}
files_touched: {{files_count}}
onboarded_by: ema_wiki_writer
---

# {{summary_title}}

{{ai_summary}}

## Intents

{{#each intents}}
- **{{intent_type}}**: {{content}}
{{/each}}

{{#if decisions}}
## Decisions

{{#each decisions}}
- {{description}} — see [[decisions/{{slug}}]]
{{/each}}
{{/if}}

{{#if learnings}}
## Learnings

{{#each learnings}}
- {{description}} — see [[learnings/{{slug}}]]
{{/each}}
{{/if}}

## Files Touched

{{#each files}}
- `{{path}}`
{{/each}}

---
Tags: #session #{{source_type}} #{{project_slug}} {{#each intent_types}}#{{this}} {{/each}}
```

### Wikilink Generation Rules

The WikiWriter auto-generates `[[wikilinks]]` for:

1. **Project names** — `[[project-slug]]` links to project index note
2. **Technology terms** — detected via keyword list (elixir, phoenix, react, sqlite, etc.) → `[[elixir]]`, `[[phoenix]]`
3. **File paths** — significant files (schemas, contexts, controllers) get `[[module-name]]` links
4. **Cross-references** — decisions reference the session that produced them, learnings reference the error context
5. **People** — if a collaborator name appears (from git blame or session metadata), link to `[[contacts/name]]`

GraphBuilder picks up all wikilinks automatically on vault scan and builds the link graph.

### Batched AI Classification

To keep costs down, sessions are batched for AI calls:

```
Prompt template (haiku):
"Analyze these {{count}} coding sessions and for each return JSON:
{sessions: [{session_id, summary, decisions: [], learnings: [], technologies: []}]}

Session 1: [{{source_type}}] {{date}} — {{token_count}} tokens, {{tool_calls}} tool calls
Intents: {{intents_summary}}
Files: {{files_touched}}

Session 2: ..."
```

Batch size: 5 sessions per call. Cost estimate for 3,145 sessions: ~630 haiku calls = ~$0.15-0.30 total.

---

## System 3: Self-Bootstrap Loop

### How EMA Develops Itself

The self-bootstrap loop has four feedback paths, three of which are new pipes wired into the existing Pipes system.

### Path A: Session → Proposals (EXISTING)

Already works. `SessionHarvester` runs every 4h, finds sessions with:
- Error patterns (repeated failures, long debugging)
- TODO/FIXME/HACK comments in touched files
- Unusually long sessions (>30min of active work)

Creates proposal seeds that flow through the Generator → Refiner → Debater → Tagger pipeline.

No changes needed. Just ensure Orchestrator triggers it on boot.

### Path B: Session → Tasks (NEW PIPE)

**Stock pipe: "Session Intent → Task"**

```elixir
%Pipe{
  name: "Session Intent to Task",
  trigger_pattern: "onboarding:intent_loaded",
  system_pipe: true,
  active: true,
  transforms: [
    %PipeTransform{type: "filter", config: %{
      "field" => "intent_type",
      "operator" => "in",
      "value" => ["task", "fix"]
    }}
  ],
  actions: [
    %PipeAction{action_id: "claude:run", config: %{
      "prompt_template" => "Extract a single actionable task from this intent. Return JSON: {title, description, priority (1-5), project_slug}.\n\nIntent: {{content}}\nProject: {{project_slug}}\nSource: {{source_type}} session from {{date}}",
      "model" => "haiku"
    }},
    %PipeAction{action_id: "tasks:create", config: %{
      "source_type" => "session_intent"
    }}
  ]
}
```

### Path C: Session → Wiki Notes (NEW — WikiWriter integration)

**Stock pipe: "Session Harvested → Wiki"**

```elixir
%Pipe{
  name: "Session to Wiki Note",
  trigger_pattern: "onboarding:session_harvested",
  system_pipe: true,
  active: true,
  transforms: [
    %PipeTransform{type: "filter", config: %{
      "field" => "token_count",
      "operator" => "gte",
      "value" => 500
    }}
  ],
  actions: [
    %PipeAction{action_id: "onboarding:write_wiki", config: %{}}
  ]
}
```

### Path D: Session → Knowledge Graph (NEW)

**Stock pipe: "Wiki Note → Superman KG"**

```elixir
%Pipe{
  name: "Wiki Note to Knowledge Graph",
  trigger_pattern: "onboarding:wiki_note_created",
  system_pipe: true,
  active: true,
  actions: [
    %PipeAction{action_id: "superman:ingest", config: %{
      "node_types" => ["decision", "learning", "pattern"],
      "score_boost" => 1
    }}
  ]
}
```

### The Complete Loop

```
Developer works on EMA (Claude Code / Codex session)
  │
  ▼
SessionWatcher detects new .jsonl file
  │
  ▼
IntentionFarmer.Watcher parses + classifies intents
  │
  ├──▶ Path A: SessionHarvester → proposal seeds → ProposalEngine pipeline
  │        └─▶ Proposals appear in queue for user review
  │
  ├──▶ Path B: Pipe fires "onboarding:intent_loaded"
  │        └─▶ filter(task|fix) → claude:run(extract task) → tasks:create
  │            └─▶ Task appears in EMA task list
  │
  ├──▶ Path C: Pipe fires "onboarding:session_harvested"
  │        └─▶ filter(tokens >= 500) → WikiWriter → SecondBrain note
  │            └─▶ GraphBuilder adds [[wikilinks]] to graph
  │
  └──▶ Path D: Pipe fires "onboarding:wiki_note_created"
           └─▶ superman:ingest → KnowledgeGraph ETS
               └─▶ ContextInjector pulls from KG next time
                   └─▶ Next agent session has richer context
                       └─▶ Loop repeats
```

### Self-Bootstrap Metrics

The Orchestrator tracks effectiveness over time:

- **Context coverage:** % of projects with >5 KG nodes (target: 100%)
- **Intent capture rate:** intents loaded / sessions detected (target: >80%)
- **Wiki coverage:** sessions with wiki notes / total sessions (target: >60% for significant sessions)
- **Feedback latency:** time from session end to wiki note creation (target: <10min for active sessions, <24h for backlog)

Metrics stored in Settings as JSON, queryable via REST API, displayable on dashboard.

---

## System 4: Data Import Pipeline

### Module: `Ema.DataImport`

Extends the existing `Ingestor` with real parser implementations. Users drop export archives into `~/.local/share/ema/imports/` or trigger import via UI/API.

### Parser Behaviour

```elixir
defmodule Ema.DataImport.Parser do
  @callback source_type() :: String.t()
  @callback detect(path :: String.t()) :: {:ok, metadata :: map()} | :skip
  @callback parse(path :: String.t(), opts :: keyword()) :: {:ok, [ParsedDocument.t()]} | {:error, term()}
end
```

### ParsedDocument Schema

```elixir
defmodule Ema.DataImport.ParsedDocument do
  defstruct [
    :source_type,      # "google_takeout", "facebook", "twitter", etc.
    :content_type,     # "email", "message", "post", "event", "search", "document"
    :title,            # extracted or generated title
    :content,          # main text content
    :date,             # original creation/send date
    :metadata,         # source-specific metadata (sender, thread_id, etc.)
    :tags,             # auto-extracted tags
    :people,           # mentioned people [{name, role}]
    :links,            # URLs found in content
    :attachments       # [{filename, mime_type, path}]
  ]
end
```

### Phase 1 Parsers

#### Google Takeout (`Ema.DataImport.Parsers.GoogleTakeout`)

**Detection:** Looks for `Takeout/` directory structure with known subdirs (`Mail/`, `My Activity/`, `Google Photos/`, `YouTube and YouTube Music/`).

**Sub-parsers:**

| Data Type | Source Path | Extraction |
|-----------|-----------|------------|
| Emails | `Takeout/Mail/*.mbox` | Parse mbox format: subject, from, to, date, body (text/plain preferred). Skip marketing (unsubscribe header). Group by thread. |
| Search History | `Takeout/My Activity/Search/MyActivity.json` | Array of `{title, time, products}`. Monthly summaries of search themes. |
| YouTube | `Takeout/YouTube and YouTube Music/history/watch-history.json` | Array of `{title, titleUrl, time}`. Monthly viewing summaries. |
| Calendar | `Takeout/Calendar/*.ics` | Parse ICS: events with attendees, locations, descriptions. |
| Docs | `Takeout/Drive/*.{json,html}` | Title + content extraction from HTML exports. |
| Location | `Takeout/Location History/Records.json` | Significant places (visited >3 times). Monthly movement summaries. |

**Volume handling:** Google Takeout can be huge (50GB+). Parser streams files, never loads full archive into memory. Processes in chunks of 100 documents, writes to vault incrementally.

#### Facebook/Meta (`Ema.DataImport.Parsers.Facebook`)

**Detection:** Looks for `your_facebook_data/` or `facebook-<username>/` with `messages/`, `posts/`, `profile_information/` subdirs.

| Data Type | Source Path | Extraction |
|-----------|-----------|------------|
| Messages | `messages/inbox/<thread>/message_1.json` | Participants, timestamps, content. Group by conversation. |
| Posts | `posts/your_posts_1.json` | Post text, timestamps, media references. |
| Events | `events/your_events.json` | Event names, dates, descriptions. |
| Friends | `friends/friends.json` | Name + add date → contacts. |
| Ad Interests | `other_activity/ads_information/advertisers_you've_interacted_with.json` | Interest categories (useful for self-knowledge). |

#### Twitter/X (`Ema.DataImport.Parsers.Twitter`)

**Detection:** `data/` directory with `tweets.js`, `direct-messages.js`, `like.js`.

| Data Type | Source File | Extraction |
|-----------|-----------|------------|
| Tweets | `data/tweets.js` | Full text, timestamps, engagement. Thread reconstruction. |
| DMs | `data/direct-messages.js` | Conversations with participants. |
| Bookmarks | `data/bookmarks.js` | Saved tweets (high-signal content). |
| Likes | `data/like.js` | Liked content (interest mapping). |
| Following | `data/following.js` | Who you follow → contacts/interests. |

#### GitHub (`Ema.DataImport.Parsers.GitHub`)

**Detection:** Via API (not file-based). User provides GitHub token in Settings.

| Data Type | API Endpoint | Extraction |
|-----------|-------------|------------|
| Repos | `GET /user/repos` | Name, description, language, stars, activity. |
| Issues | `GET /repos/:owner/:repo/issues` | Title, body, labels, state. |
| PRs | `GET /repos/:owner/:repo/pulls` | Title, body, diff stats, review comments. |
| Gists | `GET /users/:user/gists` | Description, files, content. |
| Stars | `GET /user/starred` | Starred repos (interest mapping). |
| Contributions | GraphQL contributions API | Activity heatmap, commit frequency. |

#### Slack (`Ema.DataImport.Parsers.Slack`)

**Detection:** Directory with `channels/`, `users.json`, `channels.json`.

| Data Type | Source Path | Extraction |
|-----------|-----------|------------|
| Messages | `channels/<name>/*.json` | Full message history per channel. Thread grouping. |
| Users | `users.json` | Name, display name, email → contacts. |
| Files | `files/` | Shared file metadata (not content unless text). |

#### Browser History (`Ema.DataImport.Parsers.BrowserHistory`)

**Detection:** Checks `~/.config/google-chrome/Default/History` (Chrome) and `~/.mozilla/firefox/*/places.sqlite` (Firefox).

| Browser | DB Path | Extraction |
|---------|---------|------------|
| Chrome | `~/.config/google-chrome/Default/History` | SQLite `urls` table: url, title, visit_count, last_visit_time. |
| Firefox | `~/.mozilla/firefox/*/places.sqlite` | SQLite `moz_places` + `moz_historyvisits`. |

**Processing:** Copy DB to temp (avoid locking), query last N days, extract top domains and significant pages. Generate monthly browsing summaries. Skip trivial visits (< 3 seconds, known tracking domains).

### Import Flow

```
1. Detector.scan(imports_dir)
   └─ For each item in dir: try each parser's detect/1
      └─ Returns [{parser_module, path, metadata}]

2. For each detected source:
   └─ Ingestor.create_job(%{
        source_type: parser.source_type(),
        source_uri: path,
        parser_module: parser_module,
        status: "pending"
      })

3. Ingestor.Processor picks up pending jobs:
   └─ parser.parse(path, opts)
      └─ Returns stream of %ParsedDocument{}

4. For each document:
   a. Classify via IntentionFarmer-style rules OR haiku batch
   b. Generate vault note with [[wikilinks]]
   c. SecondBrain.create_note(note_attrs)
   d. Update IngestJob.items_imported counter

5. On job completion:
   └─ EventBus.broadcast("onboarding:import_completed", stats)
   └─ Update IngestJob status to "done"
```

### Vault Organization for Imports

```
vault/imports/
├── google/
│   ├── emails/
│   │   └── YYYY-MM-<thread-subject>.md
│   ├── docs/
│   │   └── <doc-title>.md
│   ├── calendar/
│   │   └── YYYY-MM-events.md          ← monthly event summaries
│   └── activity/
│       └── YYYY-MM-search-summary.md  ← monthly search/watch themes
├── facebook/
│   ├── conversations/
│   │   └── <participant-names>.md     ← conversation summaries
│   └── posts/
│       └── YYYY-MM-posts.md          ← monthly post summaries
├── twitter/
│   ├── threads/
│   │   └── YYYY-MM-DD-<topic>.md     ← reconstructed threads
│   └── bookmarks/
│       └── <bookmark-topic>.md
├── github/
│   ├── repos/
│   │   └── <repo-name>.md            ← per-repo summary
│   └── activity/
│       └── YYYY-MM-contributions.md
├── slack/
│   └── <workspace>/
│       └── <channel-name>.md          ← channel summaries
└── browser/
    └── YYYY-MM-browsing.md            ← monthly browsing themes
```

### Privacy & Safety

- All data stays local (SQLite + vault files on disk)
- AI classification calls send summaries only, not raw content (emails, DMs never sent to API)
- User can exclude data types via `Settings.set("import.excluded_types", ["emails", "dms"])`
- Import directory is not synced externally — lives under `~/.local/share/ema/`
- Browser history parser copies DB to temp before reading (no lock conflicts)
- Imported notes tagged with `#imported #<source>` for easy filtering/deletion

---

## System 5: New Pipes Infrastructure

### New Triggers (added to `Pipes.Registry.stock_triggers/0`)

```elixir
%Trigger{id: "onboarding:session_harvested", context: "onboarding", event_type: "session_harvested",
         label: "Session Harvested", description: "CLI session parsed and stored by IntentionFarmer"},
%Trigger{id: "onboarding:intent_loaded", context: "onboarding", event_type: "intent_loaded",
         label: "Intent Loaded", description: "Intent extracted and loaded to DB"},
%Trigger{id: "onboarding:wiki_note_created", context: "onboarding", event_type: "wiki_note_created",
         label: "Wiki Note Created", description: "WikiWriter produced a vault note from session data"},
%Trigger{id: "onboarding:import_completed", context: "onboarding", event_type: "import_completed",
         label: "Import Completed", description: "External data import job finished"},
%Trigger{id: "onboarding:boot_complete", context: "onboarding", event_type: "boot_complete",
         label: "Boot Onboarding Complete", description: "Full boot-time onboarding pipeline finished"}
```

### New Actions (added to `Pipes.Registry.stock_actions/0`)

```elixir
%Action{id: "superman:ingest", context: "superman", action_id: "superman:ingest",
        label: "Ingest to Knowledge Graph", description: "Feed nodes into Superman KG",
        schema: %{nodes: {:array, :map}, project_id: :string},
        execute: fn payload ->
          nodes = payload["nodes"] || []
          project_id = payload["project_id"]
          Ema.Superman.KnowledgeGraph.ingest(nodes, project_id)
        end},

%Action{id: "onboarding:write_wiki", context: "onboarding", action_id: "onboarding:write_wiki",
        label: "Write Session Wiki Note", description: "Create vault note from harvested session",
        schema: %{session_id: :string},
        execute: fn payload ->
          session_id = payload["session_id"] || payload[:session_id]
          Ema.Onboarding.WikiWriter.process_session(session_id)
        end},

%Action{id: "import:detect", context: "import", action_id: "import:detect",
        label: "Detect Import Sources", description: "Scan imports directory for new data",
        schema: %{},
        execute: fn _payload ->
          Ema.DataImport.Detector.scan()
        end}
```

### New Stock Pipes (added to `Pipes.Loader`)

Three new system pipes loaded on first boot:

1. **"Session Intent → Task"** — `onboarding:intent_loaded` → filter(task|fix) → `claude:run` → `tasks:create`
2. **"Session → Wiki Note"** — `onboarding:session_harvested` → filter(tokens >= 500) → `onboarding:write_wiki`
3. **"Wiki Note → Knowledge Graph"** — `onboarding:wiki_note_created` → `superman:ingest`

---

## Database Changes

### Migration: Add Onboarding Fields

```elixir
# On harvested_sessions
alter table(:harvested_sessions) do
  add :onboarded_at, :utc_datetime
  add :wiki_note_id, references(:second_brain_notes, type: :binary_id)
  add :onboard_status, :string, default: "pending"  # pending | processing | done | failed | skipped
end

# On harvested_intents
alter table(:harvested_intents) do
  add :wiki_note_id, references(:second_brain_notes, type: :binary_id)
end

# On ingest_jobs (extend existing stub)
alter table(:ingest_jobs) do
  add :parser_module, :string
  add :items_imported, :integer, default: 0
  add :vault_space, :string
end
```

### New Table: `data_imports`

```elixir
create table(:data_imports, primary_key: false) do
  add :id, :binary_id, primary_key: true
  add :source_type, :string, null: false    # google_takeout | facebook | twitter | github | slack | browser
  add :source_path, :string, null: false
  add :status, :string, default: "pending"  # pending | scanning | importing | done | failed
  add :items_found, :integer, default: 0
  add :items_imported, :integer, default: 0
  add :started_at, :utc_datetime
  add :completed_at, :utc_datetime
  add :settings, :map, default: %{}         # excluded_types, date_ranges, etc.
  add :error_log, :text                     # last error if failed
  timestamps(type: :utc_datetime)
end
```

---

## Module Map (New Files)

```
daemon/lib/ema/
├── onboarding/
│   ├── orchestrator.ex          ← Boot-time pipeline coordinator
│   ├── wiki_writer.ex           ← Session → vault note converter
│   └── metrics.ex               ← Self-bootstrap effectiveness tracking
├── data_import/
│   ├── data_import.ex           ← Context module (CRUD for data_imports)
│   ├── detector.ex              ← Scan imports dir, match to parsers
│   ├── parsed_document.ex       ← Shared struct for all parsers
│   └── parsers/
│       ├── parser.ex            ← Behaviour definition
│       ├── google_takeout.ex    ← Google Takeout ZIP/dir parser
│       ├── facebook.ex          ← Facebook export parser
│       ├── twitter.ex           ← Twitter/X archive parser
│       ├── github.ex            ← GitHub API importer
│       ├── slack.ex             ← Slack export parser
│       └── browser_history.ex   ← Chrome/Firefox SQLite parser
```

### Changes to Existing Files

| File | Change |
|------|--------|
| `application.ex` | Add `Onboarding.Orchestrator` to post-boot Task sequence |
| `pipes/registry.ex` | Add 5 triggers + 3 actions |
| `pipes/loader.ex` | Add 3 stock pipes |
| `intention_farmer/backlog_farmer.ex` | Add `run_now/0` for synchronous on-demand harvest |
| `intention_farmer/loader.ex` | Broadcast `onboarding:intent_loaded` events via EventBus |
| `intention_farmer/watcher.ex` | Broadcast `onboarding:session_harvested` events via EventBus |
| `harvesters/harvesters.ex` | Add `run_all_now/0` to trigger all harvesters immediately |
| `ingestor/processor.ex` | Replace stub extraction with parser dispatch |
| `cli_manager/scanner.ex` | Add `session_dir` paths for codex, aider, gemini |

---

## Implementation Order

### Phase 1: Wire the Loop (days 1-2)
1. Add `onboarded_at` and `onboard_status` fields to harvested_sessions (migration)
2. Build `Onboarding.WikiWriter` — the core missing piece
3. Add EventBus broadcasts to IntentionFarmer (Loader + Watcher)
4. Register new triggers/actions in Pipes.Registry
5. Add 3 stock pipes to Pipes.Loader
6. Build `Onboarding.Orchestrator` boot-time coordinator
7. Wire into `application.ex`

### Phase 2: Self-Bootstrap Validation (day 3)
8. Run Orchestrator against existing 3,145 sessions
9. Verify wiki notes created with proper [[wikilinks]]
10. Verify GraphBuilder picks up wikilinks
11. Verify KnowledgeGraph populated
12. Verify new session detection → full loop executes
13. Add metrics tracking

### Phase 3: Data Import Framework (days 4-5)
14. Build `DataImport` context + `data_imports` migration
15. Build `ParsedDocument` struct + `Parser` behaviour
16. Build `Detector` (scan imports dir)
17. Wire `Ingestor.Processor` to dispatch to parsers
18. Build Google Takeout parser (highest value, most users have this)
19. Build Browser History parser (easiest, local SQLite)

### Phase 4: Remaining Parsers (days 6-8)
20. Facebook parser
21. Twitter parser
22. GitHub parser (API-based)
23. Slack parser
24. REST API endpoints for import management
25. Frontend UI for import status + configuration

---

## Intent Capture Detail

### How Intents Flow Through the System

The IntentionFarmer already classifies intents into 5 types. This design extends the classification and ensures every intent is captured, stored, and actionable.

### Intent Types (Extended)

| Type | Pattern Match | Action |
|------|--------------|--------|
| `fix` | fix, bug, error, broken, crash, fail, issue, wrong, debug | → Task (priority 2) + Learning note |
| `task` | add, create, build, implement, write, make, setup, configure, wire | → Task (priority 3) |
| `refactor` | refactor, clean, reorganize, simplify, extract, move, rename, split | → Task (priority 4) + Decision note |
| `question` | why, how, what, where, explain, understand, confused, unclear | → Brain dump item for triage |
| `exploration` | explore, look, check, investigate, find, search, trace, inspect | → Wiki note (research) |
| `goal` | want, need, should, plan, goal, vision, roadmap, milestone | → Goal tracking + Proposal seed |
| `decision` | decided, chose, picked, went with, because, trade-off, instead of | → Decision note in vault |
| `learning` | learned, realized, gotcha, turns out, didn't know, TIL, surprise | → Learning note in vault |

### Intent Extraction Pipeline

```
Raw session JSONL
  │
  ▼
IntentionFarmer.Parser
  ├─ Extract human messages (user turns only)
  ├─ Extract tool_use patterns (what tools were called, on what files)
  ├─ Extract error messages (from tool results with non-zero exit codes)
  └─ Extract timestamps + duration
  │
  ▼
IntentionFarmer.Cleaner
  ├─ Dedup by fingerprint (content hash)
  ├─ Quality score: length * intent_confidence * (1 + tool_calls * 0.1)
  └─ Filter: drop quality_score < 0.3
  │
  ▼
IntentionFarmer.Loader
  ├─ Bulk insert HarvestedSession + HarvestedIntent rows
  ├─ Link to projects via path matching
  ├─ Broadcast "onboarding:session_harvested" per session
  └─ Broadcast "onboarding:intent_loaded" per intent
  │
  ▼
Pipes.Executor (event-driven, async)
  ├─ "Session Intent → Task" pipe
  │   └─ filter(task|fix) → claude:run(extract task) → tasks:create
  ├─ "Session → Wiki Note" pipe
  │   └─ filter(tokens >= 500) → WikiWriter.process_session
  └─ "Wiki Note → Knowledge Graph" pipe
      └─ superman:ingest(decisions, learnings, patterns)
```

### Intent-to-Wiki Mapping

| Intent Type | Vault Location | Note Type |
|-------------|---------------|-----------|
| `fix` | `vault/learnings/YYYY-MM-DD-<slug>.md` | Learning with error context, root cause, fix |
| `task` | (creates Task, not wiki note) | — |
| `refactor` | `vault/decisions/YYYY-MM-DD-<slug>.md` | Decision with before/after, rationale |
| `question` | `vault/sessions/<project>/...` | Included in session summary note |
| `exploration` | `vault/sessions/<project>/...` | Research note with findings |
| `goal` | `vault/sessions/<project>/...` | Included in session summary + proposal seed |
| `decision` | `vault/decisions/YYYY-MM-DD-<slug>.md` | Standalone decision record |
| `learning` | `vault/learnings/YYYY-MM-DD-<slug>.md` | Standalone learning record |

### Cross-Source Intent Merging

When the same intent appears across multiple sessions (common for multi-session features):

1. Fingerprint detects near-duplicates (Jaccard similarity on content tokens > 0.7)
2. Cleaner merges into single intent with `sources: [session_id_1, session_id_2, ...]`
3. Wiki note links to all source sessions
4. Task dedup: if a task already exists with matching title (fuzzy match), add comment instead of creating duplicate

### Intent Capture from Data Imports

External data flows through the same classification:

| Source | Intent Mapping |
|--------|---------------|
| Emails with action items | → `task` intents |
| Calendar events | → `goal` intents (recurring = responsibility) |
| GitHub issues assigned to user | → `task` intents |
| Bookmarked tweets/posts | → `exploration` intents |
| Search history clusters | → `question` or `exploration` intents |
| Slack threads with decisions | → `decision` intents |
| Browser history (docs/tutorials) | → `learning` intents |

---

## REST API Endpoints

### Onboarding

```
GET  /api/onboarding/status          ← current onboarding state + metrics
POST /api/onboarding/run             ← trigger manual onboarding run
GET  /api/onboarding/sessions        ← list harvested sessions with onboard_status
GET  /api/onboarding/sessions/:id    ← session detail with intents + wiki note
```

### Data Import

```
GET  /api/imports                     ← list all import jobs
POST /api/imports/detect              ← scan imports dir for new sources
POST /api/imports                     ← create import job manually
GET  /api/imports/:id                 ← import job detail with progress
POST /api/imports/:id/start           ← begin processing
POST /api/imports/:id/cancel          ← cancel in-progress import
DELETE /api/imports/:id               ← remove import record
GET  /api/imports/parsers             ← list available parsers
```

### Intent Explorer

```
GET  /api/intents                     ← list harvested intents (filterable by type, project, date)
GET  /api/intents/:id                 ← intent detail with source session + wiki note
GET  /api/intents/stats               ← intent type distribution, capture rate, coverage
POST /api/intents/:id/promote         ← manually promote intent to task/proposal/note
```
