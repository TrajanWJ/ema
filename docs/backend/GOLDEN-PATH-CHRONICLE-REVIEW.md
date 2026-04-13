# Golden Path — Chronicle Review Decisions

This is the active Chronicle -> Review -> Promotion Receipt flow on the current branch.

## Purpose

- Chronicle is the raw landing zone for imported session/history material.
- Review is the curation and decision layer over Chronicle sessions and entries.
- Promotion receipts are the durable bridge into real runtime objects or recorded downstream targets.

## Flow

1. Import raw material into Chronicle.
   - `POST /api/chronicle/import`
   - `POST /api/chronicle/import-file`
   - `ema chronicle import-bundle`
   - `ema chronicle import-file`
2. Chronicle persists raw payloads and stored artifacts under `~/.local/share/ema/chronicle/`.
3. Chronicle indexes session, entry, and artifact metadata in SQLite.
4. A Chronicle session or entry is selected for durable review.
   - `POST /api/review/items`
   - `ema review create --session-id <id> [--entry-id <id>]`
5. Review items become visible in the review queue.
   - `GET /api/review/items`
   - `ema review list`
6. Humans approve, reject, or defer review items.
   - `POST /api/review/items/:id/approve`
   - `POST /api/review/items/:id/reject`
   - `POST /api/review/items/:id/defer`
7. Approved items can record downstream promotion receipts.
   - `POST /api/review/items/:id/receipts`
   - `ema review receipt <id> --target-kind <target-kind>`
8. Promotion receipts write a durable provenance bridge and link the Chronicle source back to what it informed.

## Current Promotion Receipt Targets

- `intent`
- `proposal`
- `execution`
- `task`
- `canon`
- `note`
- `other`

These are receipt target categories, not automatic downstream creators in this pass.

## Provenance Rule

- Chronicle raw files remain the import landing zone.
- SQLite review tables must always retain:
  - `extraction_id`
  - `chronicle_session_id`
  - `chronicle_entry_id` where applicable
  - `chronicle_artifact_id` where applicable
  - human decision actor/timestamp fields on the review item
- Promotion receipts must always retain:
  - `review_item_id`
  - `extraction_id`
  - `chronicle_session_id`
  - `chronicle_entry_id` where applicable
  - `chronicle_artifact_id` where applicable
  - `target_kind`
  - `target_id`

## Current Scope

The current Review layer is intentionally thin:

- Chronicle remains the raw landing zone and browse surface.
- Chronicle extraction creates durable candidate rows before human review.
- Review creates one durable review item per extraction and preserves explicit human decision fields.
- Promotion receipts record downstream linkage without auto-creating intents, proposals, executions, or canon writes.
