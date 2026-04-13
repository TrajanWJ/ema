# EMA Backfeed Landing Zone

Date: 2026-04-13
Status: design spec

## Decision

The designated EMA-owned landing zone for imported material is called
`Chronicle`.

## Why `Chronicle`

`Chronicle` is the right name because the landing zone must hold more than
sessions:

- imported conversations
- IDE logs
- shell history
- CLI traces
- browser captures
- filesystem notes
- tool outputs
- agent runtime traces
- artifacts and attachments

`Sessions` is too narrow.
`Inbox` implies short-lived triage only.
`Imports` describes the mechanism, not the product role.
`Raw Memory` is too vague.

`Chronicle` names the thing accurately: a durable, queryable record of human,
agent, and system activity before that material is promoted into stronger EMA
structures.

## Chronicle in the Product

Chronicle is:

- the first arrival zone for imported material
- the durable raw-history substrate for review
- a searchable provenance layer
- a source of candidate intents, proposals, decisions, and execution evidence

Chronicle is not:

- canon
- a dumping ground with no lifecycle
- a substitute for proposals or executions
- a silent auto-write path into durable truth

## Object Model

Chronicle needs a first-class object model. The minimum set is:

| Object | Purpose | Typical sources | Key fields |
|---|---|---|---|
| `source_account` | identity of an external/local source | ChatGPT account, Claude local history, Cursor workspace, shell user | source kind, account label, auth mode, machine id, trust/privacy flags |
| `source_bundle` | one imported package of raw material | one JSON export, one local session dir, one browser sync batch | source account, import time, source path/url, checksum, parser version |
| `chronicle_session` | grouped conversational or work session | Claude project session, ChatGPT conversation, Cursor session, terminal session | source bundle, started/ended, project hints, participants, summary, confidence |
| `chronicle_entry` | atomic item inside Chronicle | message, trace row, command, event, note, diff summary | parent session, timestamp, entry kind, content, metadata, privacy level |
| `chronicle_artifact` | attached file or output | screenshots, logs, transcripts, result files, patch files | file path, mime type, hash, source, related entries |
| `chronicle_trace` | structured operational trace | shell command, worker event, pipe event, file touch, service log | event type, actor, scope, timestamp, payload |
| `chronicle_link` | tentative or confirmed relationship | project linkage, intent linkage, duplicate relation | source object, target object, relation, confidence, reviewer |
| `chronicle_extraction` | derived candidate before human review | intent candidate, goal candidate, calendar candidate, execution evidence candidate | Chronicle lineage, candidate kind, payload, confidence, suggested target |
| `review_item` | queued unit for human review | one Chronicle extraction selected for structured decision | extraction id, status, suggested target, decision actor, decision note, decided_at |
| `promotion_receipt` | durable record of what was promoted or linked | linked proposal, created intent, recorded follow-on target | target kind, source evidence, approver decision, timestamp |

## Arrival Lifecycle

Every Chronicle object should move through an explicit lifecycle:

1. `discovered`
   - source exists and is known

2. `imported`
   - raw payload captured into EMA-owned storage

3. `normalized`
   - parsed into sessions, entries, artifacts, and traces

4. `grouped`
   - clustered into sessions, topics, source bundles, or project associations

5. `linked`
   - tentative relations to projects, intents, executions, spaces, or canon

6. `reviewed`
   - a human has accepted, rejected, merged, or deferred derived meaning

7. `promoted`
   - selected meaning becomes a structured EMA object

8. `archived`
   - raw material remains retained, but is no longer active in review queues

Raw data may stop at `normalized`, `grouped`, or `linked`. Promotion is not the
default. Review is the gate.

## What the UI Looks Like

Chronicle should have four views, all on the same domain:

### 1. Timeline view

Purpose:

- inspect all imported material over time
- answer "what happened when"

Features:

- time scrubber
- source filters
- project filters
- agent/human/system toggles
- session grouping
- artifact markers
- promotion markers

### 2. Session view

Purpose:

- inspect one imported conversation or work session as a coherent unit

Features:

- message/entry transcript
- file-touch list
- artifacts list
- project guesses
- extraction suggestions
- provenance card

### 3. Source view

Purpose:

- inspect one source account or connector

Features:

- account status
- import batches
- date ranges
- parser health
- privacy policy
- re-import controls

### 4. Project-linked view

Purpose:

- see Chronicle material already linked to one project, space, or intent

Features:

- linked sessions
- unreviewed items
- recent promotions
- duplicate clusters
- evidence bundles

## Review Actions from Chronicle

Chronicle should allow direct action without skipping review semantics:

- `extract intent`
- `draft proposal`
- `mark as execution evidence`
- `suggest canon decision`
- `attach to project`
- `send to research`
- `create memory link`
- `merge duplicate sessions`
- `split session cluster`
- `defer`
- `archive raw only`

These actions create `review_item`s unless the action is a purely local
organization step such as hide, group, or retag.

## Promotion Targets

Material promoted out of Chronicle can become:

- `intent`
  - when the source implies a stable work objective

- `proposal`
  - when the source already contains a candidate plan or execution method

- `execution evidence`
  - when the source documents real work performed, files changed, or outcomes

- `canon decision`
  - when the source records a durable architectural or operational choice

- `research node`
  - when the source is informative but not yet work-bound

- `memory/context link`
  - when the source strengthens relational recall without minting a new top
    level work object

- `project attachment`
  - when the source belongs to a project dossier without needing stronger
    semantic structure

## What Stays Raw

The following should remain in Chronicle unless explicitly promoted:

- full transcripts
- low-confidence summaries
- unresolved ambiguity
- noisy traces
- privacy-sensitive raw payloads
- repetitive machine output
- failed or partial extractions
- provisional project guesses

Canon should not be burdened with raw imports. Chronicle preserves them and
keeps them queryable.

## Storage Model

Chronicle is one product domain with three durable storage forms:

### 1. Raw Chronicle store

Location:

- `~/.local/share/ema/chronicle/`

Purpose:

- hold raw imported payloads, normalized JSON, and file attachments

Example structure:

- `bundles/{source_kind}/{bundle_id}/raw.*`
- `normalized/{session_id}.json`
- `artifacts/{artifact_id}`
- `receipts/{promotion_id}.json`

### 2. Indexed operational layer

Location:

- SQLite in `~/.local/share/ema/ema.db`

Purpose:

- power timeline queries, filters, joins, review queues, and search

Expected tables:

- `chronicle_sources`
- `chronicle_bundles`
- `chronicle_sessions`
- `chronicle_entries`
- `chronicle_artifacts`
- `chronicle_links`
- `chronicle_extractions`
- `review_items`
- `promotion_receipts`

### 3. Canon-adjacent manifests

Location:

- `ema-genesis/chronicle/`

Purpose:

- human-readable import manifests, policy docs, and curated promotion receipts
- not the home for large raw payloads

Expected content:

- source manifests
- import policy notes
- high-value reviewed chronicle dossiers
- durable narrative summaries for important batches

## Review Semantics

Chronicle does not promote anything directly into canon or execution. It
produces evidence and candidates. The review layer decides what becomes durable
structure.

Minimum semantics:

- `approve`
- `reject`
- `merge into existing`
- `defer`
- `archive raw only`

Every promotion should preserve:

- source bundle id
- source account
- exact supporting entries
- generated inference text
- approver
- promotion timestamp

## Phase 1 Recommendation

The first implementation phase should make Chronicle real before making it
clever:

1. collect and store imported material
2. normalize enough structure to browse it
3. expose timeline and session views
4. add review items with explicit promotion receipts

Extraction quality can improve later. Landing-zone integrity is the real first
milestone.
