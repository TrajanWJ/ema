# Intention Backlog Farmer — Design Spec

**Date:** 2026-04-05
**Status:** Approved
**Scope:** New harvester subsystem for EMA daemon

## Problem

EMA's intelligence layer has a cold-start problem. The system has no historical context about what the user has been working on across Claude Code and Codex CLI terminals. Without this data, Reflexion Injection has nothing to inject, Scope Advisor has no timeout patterns to warn about, and the proposal engine generates seeds in a vacuum.

## Solution

A new `Ema.IntentionFarmer` subsystem that discovers, parses, deduplicates, and loads all AI terminal session data into EMA. Runs both as a batch bootstrapper and as an incremental watcher.

## Data Sources

| Source | Path | Format |
|--------|------|--------|
| Claude Code sessions | `~/.claude/projects/**/*.jsonl` | JSONL (sessionId, type, content, usage, timestamp) |
| Codex CLI sessions | `~/.codex/sessions/**/*.jsonl` | JSONL (session_meta, event_msg, response_item, turn_context) |
| Codex CLI history | `~/.codex/history.jsonl` | JSONL (session_id, ts, text) — raw user intents |
| CLAUDE.md files | Discovered from project linked_paths and session cwd fields | Markdown |
| .claude/ configs | Per-project `.claude/` directories | Mixed |

## Module Structure

```
Ema.IntentionFarmer.Supervisor (one_for_one)
├── Task.Supervisor (Ema.IntentionFarmer.TaskSupervisor)
├── SourceRegistry (GenServer — discovers source paths, 5min refresh)
├── Watcher (GenServer — incremental file watcher, 30s poll)
└── BacklogFarmer (Harvesters.Base — periodic full harvest, 2h interval)
```

Pure-function modules (no GenServer):
- `Parser` — delegates Claude to existing SessionParser, adds Codex format + history.jsonl + CLAUDE.md
- `Cleaner` — dedup by source_fingerprint (SHA256), remove empties, merge split sessions, quality scoring
- `Loader` — upserts to claude_sessions, creates brain_dump items (quiet), SecondBrain notes, proposal seeds

Context module:
- `IntentionFarmer` — CRUD for harvested_sessions and harvested_intents, query helpers

## Schemas

### harvested_sessions

| Field | Type | Purpose |
|-------|------|---------|
| id | string (PK) | UUID |
| session_id | string | Original session UUID from source |
| source_type | string | "claude_code" or "codex_cli" |
| raw_path | string | Absolute file path to source |
| project_path | string | cwd / project directory |
| model | string | Model used |
| model_provider | string | "anthropic" or "openai" |
| started_at | utc_datetime | Session start |
| ended_at | utc_datetime | Session end |
| status | string | "processed", "empty", "duplicate", "merged" |
| quality_score | float | 0.0-1.0 |
| message_count | integer | Total messages |
| tool_call_count | integer | Tool uses |
| token_count | integer | Total tokens |
| files_touched | array of strings | File paths from tool calls |
| source_fingerprint | string | SHA256(source_type, session_id, raw_path) |
| metadata | map | Provider-specific extras |
| claude_session_id | string (FK) | Links to claude_sessions when loaded |
| project_id | string (FK) | Links to projects |

### harvested_intents

| Field | Type | Purpose |
|-------|------|---------|
| id | string (PK) | UUID |
| content | string | Extracted intent text |
| intent_type | string | "goal", "question", "task", "exploration", "fix" |
| source_type | string | "claude_code", "codex_cli", "codex_history" |
| source_fingerprint | string | SHA256 for dedup |
| quality_score | float | 0.0-1.0 |
| loaded | boolean | True once loaded into brain_dump |
| brain_dump_item_id | string (FK) | Links to brain_dump item when loaded |
| harvested_session_id | string (FK) | Parent session |
| project_id | string (FK) | Links to projects |

## Data Flow

```
Sources → SourceRegistry → Watcher (incremental, 30s)
                         → BacklogFarmer (batch, 2h)
                                ↓
                          Parser (pure)
                                ↓
                          Cleaner (pure)
                                ↓
                          Loader
                       ├→ ClaudeSessions (upsert)
                       ├→ BrainDump (quiet create — no execution spawn)
                       ├→ SecondBrain (vault notes for CLAUDE.md)
                       └→ Proposals (pattern seeds)
                                ↓
                          PubSub "intention_farmer:events"
                          Pipes EventBus triggers
```

## Critical Design Decisions

1. **Separate tracking table**: harvested_sessions exists alongside claude_sessions because Codex has different metadata. Loader upserts into claude_sessions for Claude format, maintains its own for provenance.

2. **create_item_quiet/1**: New BrainDump function that inserts without triggering execution auto-creation. Without this, harvesting 200 intents spawns 200 agent executions.

3. **Streaming parser**: File.stream!/1 for large JSONL files, not File.read!/1.

4. **Idempotent loading**: Every load operation uses source_fingerprint. Re-running the farmer on the same data is a no-op.

5. **PubSub events**: All on "intention_farmer:events" topic + Pipes EventBus triggers for downstream automation.

## Build Phases

### Phase 1: Schemas + Parser
- harvested_session.ex, harvested_intent.ex (Ecto schemas)
- intention_farmer.ex (context module with CRUD)
- parser.ex (Claude delegation + Codex parsing + history + CLAUDE.md)
- Migration for both tables

### Phase 2: Cleaner + Loader
- cleaner.ex (dedup, empty removal, split merge, quality scoring)
- loader.ex (integration with ClaudeSessions, BrainDump, SecondBrain, Proposals)
- brain_dump.ex modification (add create_item_quiet/1)

### Phase 3: Source Discovery + Watcher
- source_registry.ex (GenServer, discovers all paths, 5min refresh)
- watcher.ex (GenServer, incremental processing, 30s poll)

### Phase 4: Batch Harvester + Supervisor
- backlog_farmer.ex (Harvesters.Base, full sweep, 2h interval)
- supervisor.ex (one_for_one, starts all children)
- application.ex modification (add maybe_start_intention_farmer/0)

### Phase 5: Integration
- Pipes EventBus triggers
- Avoid double-work with existing SessionWatcher
- Add "harvested" to valid sources/types in BrainDump.Item, SecondBrain.Note, Harvesters.Run

## Files

### New (10 source + 1 migration)
1. `daemon/lib/ema/intention_farmer/harvested_session.ex`
2. `daemon/lib/ema/intention_farmer/harvested_intent.ex`
3. `daemon/lib/ema/intention_farmer/intention_farmer.ex`
4. `daemon/lib/ema/intention_farmer/parser.ex`
5. `daemon/lib/ema/intention_farmer/cleaner.ex`
6. `daemon/lib/ema/intention_farmer/loader.ex`
7. `daemon/lib/ema/intention_farmer/source_registry.ex`
8. `daemon/lib/ema/intention_farmer/watcher.ex`
9. `daemon/lib/ema/intention_farmer/backlog_farmer.ex`
10. `daemon/lib/ema/intention_farmer/supervisor.ex`
11. `daemon/priv/repo/migrations/20260405100001_create_harvested_sessions_and_intents.exs`

### Modified (4)
1. `daemon/lib/ema/application.ex` — add maybe_start_intention_farmer/0
2. `daemon/lib/ema/brain_dump/brain_dump.ex` — add create_item_quiet/1
3. `daemon/lib/ema/brain_dump/item.ex` — add "harvested" to @valid_sources (if constrained)
4. `daemon/lib/ema/second_brain/note.ex` — add "harvested" to @valid_source_types (if constrained)

## Integration Points

| System | How | Direction |
|--------|-----|-----------|
| ClaudeSessions | Loader upserts via create_session/1 | Farmer → CS |
| SessionParser | Parser delegates Claude format parsing | Farmer reuses |
| SessionLinker | Loader calls link/1 for project matching | Farmer → SL |
| BrainDump | Loader creates items (quiet, source: harvested) | Farmer → BD |
| SecondBrain | Loader creates vault notes for CLAUDE.md | Farmer → SB |
| Proposals | BacklogFarmer creates pattern seeds | Farmer → Props |
| Harvesters | BacklogFarmer uses Base behaviour | Extends |
| Pipes EventBus | Loader broadcasts for downstream triggers | Farmer → Pipes |
| Projects | SourceRegistry queries for linked_paths | Reads |
