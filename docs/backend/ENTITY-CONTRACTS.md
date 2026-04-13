# Active Backend Entity Contracts

This is the current entity contract for the active backend spine.

## Intent

- Purpose
  - Canonical work unit mirrored from filesystem into runtime state.
- Source of truth
  - Filesystem intent sources under `ema-genesis/intents/` and `.superman/intents/`.
- Runtime storage
  - `intents`
  - `intent_phase_transitions`
  - `intent_links`
  - `intent_events`
- Service owner
  - `services/core/intents`
- Lifecycle
  - authored on disk
  - indexed
  - phase/status updated
  - linked to proposals, executions, and other runtime objects
- Extension notes
  - Extend through `intent_links` and `intent_events` before inventing a new work-object layer.

## GAC Card

- Purpose
  - Canonical unresolved architecture/governance item.
- Source of truth
  - Filesystem GAC markdown in `ema-genesis/intents/GAC-*`.
- Runtime storage
  - `gac_cards`
  - `gac_transitions`
- Service owner
  - `services/core/blueprint`
- Lifecycle
  - authored on disk
  - indexed
  - answered / deferred / promoted

## Proposal

- Purpose
  - Durable review and approval object between a runtime intent and an execution.
- Source of truth
  - SQLite
- Runtime storage
  - `loop_proposals`
  - `loop_events`
- Service owner
  - `services/core/proposal`
- Lifecycle
  - generated
  - pending approval
  - approved / rejected
  - revised / superseded
  - execution started
- Extension notes
  - `services/core/proposals/*` remains a seed-harvesting layer only.
  - Harvested seeds should flow into durable proposals instead of becoming a second live proposal model.

## Space

- Purpose
  - Minimal runtime context boundary.
- Source of truth
  - SQLite
- Runtime storage
  - `spaces`
  - `space_members`
  - `space_transitions`
- Service owner
  - `services/core/spaces`
- Lifecycle
  - created
  - active
  - archived

## Execution

- Purpose
  - Operational run ledger linked to an intent and, when present, an approved proposal.
- Source of truth
  - SQLite
- Runtime storage
  - `executions`
  - `execution_phase_transitions`
- Service owner
  - `services/core/executions`
- Lifecycle
  - created
  - awaiting approval / approved
  - running
  - result recorded
  - completed / failed / cancelled
- Extension notes
  - `result_path` and `result_summary` are first-class outputs.
  - `proposal_id` is the preferred handoff from proposals.
  - Direct intent -> execution creation remains a compatibility shortcut while interfaces converge.

## Chronicle Session

- Purpose
  - Durable imported-session and raw-history record that preserves provenance before later review and promotion.
- Source of truth
  - Raw Chronicle files under `~/.local/share/ema/chronicle/` plus SQLite query metadata.
- Runtime storage
  - `chronicle_sources`
  - `chronicle_sessions`
  - `chronicle_entries`
  - `chronicle_artifacts`
- Service owner
  - `services/core/chronicle`
- Lifecycle
  - imported
  - normalized
  - browsed
  - linked and promoted through Review
- Extension notes
  - Chronicle is the raw landing zone. Do not flatten imported session history directly into canon or runtime work objects.

## Review Item

- Purpose
  - Human-reviewable decision unit over one Chronicle session or Chronicle entry.
- Source of truth
  - SQLite
- Runtime storage
  - `review_items`
- Service owner
  - `services/core/review`
- Lifecycle
  - created
  - pending
  - approved / rejected / deferred
- Extension notes
  - Review is the decision boundary above Chronicle.
  - It should preserve lineage back to Chronicle rather than replacing Chronicle storage.

## Review Decision

- Purpose
  - Append-only approve, reject, or defer record tied to one review item.
- Source of truth
  - SQLite
- Runtime storage
  - `review_decisions`
- Service owner
  - `services/core/review`
- Lifecycle
  - recorded
  - listed in review item detail
  - used as provenance for promotion receipts
- Extension notes
  - Review item status is a projection over the latest decision, not a replacement for decision history.

## Promotion Receipt

- Purpose
  - Durable proof that an approved review item was promoted into or linked to a real runtime object.
- Source of truth
  - SQLite
- Runtime storage
  - `promotion_receipts`
- Service owner
  - `services/core/review`
- Lifecycle
  - recorded
  - queried and linked back to Chronicle
- Extension notes
  - Use receipts to preserve provenance even when the downstream target type has limited native metadata fields.

## Goal

- Purpose
  - Operational owned objective for a human or an agent.
- Source of truth
  - SQLite
- Runtime storage
  - `goals`
- Service owner
  - `services/core/goals`
- Lifecycle
  - created
  - active
  - completed / archived
- Extension notes
  - Goals are operational planning state.
  - Link a goal to `intent_slug` when it operationalizes a canon-backed intent.

## Calendar Entry

- Purpose
  - Operational schedule ledger for human commitments and agent virtual planning blocks.
- Source of truth
  - SQLite
- Runtime storage
  - `calendar_entries`
- Service owner
  - `services/core/calendar`
- Lifecycle
  - scheduled
  - in_progress
  - completed / cancelled
  - optionally grouped into phased buildouts
- Extension notes
  - Human schedule and agent virtual calendar share one ledger.
  - `phase` is optional and only meaningful for phased agent blocks.

## Result Artifact

- Purpose
  - Durable output file produced by an execution.
- Source of truth
  - Filesystem file plus the execution row pointer.
- Runtime storage
  - execution row `result_path`
  - filesystem under `~/.local/share/ema/results/`
- Service owner
  - `services/core/executions` and `services/core/composer`
- Lifecycle
  - written
  - attached to execution
  - consumed by UI/CLI/agents

## User State

- Purpose
  - Persisted runtime user mode and signals.
- Source of truth
  - SQLite
- Runtime storage
  - `user_state_current`
  - `user_state_snapshots`
- Service owner
  - `services/core/user-state`

## Supporting Entities

- `project`
  - Operational grouping and reporting only.
- `task`
  - Operational work item only.
- `brain_dump`
  - Capture surface only.
- `proposal_seed`
  - Read-only harvested input only.
- `cross_pollination`
  - Supporting append-only memory only.
