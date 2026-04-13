# Golden Path: Intent -> Proposal -> Execution -> Result -> Intent

This is the current active EMA backend loop.

Use this path when you want one real, working vertical slice over the normalized backend spine.

## Preconditions

- EMA services are running on `http://localhost:4488`
- intents are indexed from filesystem into SQLite

If needed:

```bash
pnpm dev
```

## Authoritative Runtime Flow

1. List runtime intents from the active backend:

```bash
ema backend flow intents
```

2. Inspect one intent bundle:

```bash
ema backend flow intent int-recovery-wave-1
```

3. Create a durable proposal for that intent:

```bash
curl -sS -X POST http://localhost:4488/api/proposals \
  -H 'content-type: application/json' \
  -d '{"intent_id":"int-recovery-wave-1"}'
```

Expected result:

- one new row in `loop_proposals`
- proposal status `pending_approval`

4. Approve the proposal:

```bash
curl -sS -X POST http://localhost:4488/api/proposals/<proposal-id>/approve \
  -H 'content-type: application/json' \
  -d '{"actor_id":"actor_human_owner"}'
```

Expected result:

- proposal status `approved`
- `approved_by_actor_id` populated

5. Start an execution from the approved proposal:

```bash
curl -sS -X POST http://localhost:4488/api/proposals/<proposal-id>/executions \
  -H 'content-type: application/json' \
  -d '{"mode":"implement","title":"demo: vertical slice"}'
```

Expected result:

- one new row in `executions`
- `executions.proposal_id` populated
- one `intent_links` row linking the execution back to the intent

Compatibility note:

- `ema backend flow start <intent-slug>` still creates executions directly from intents.
- Treat that path as a compatibility shortcut while interfaces converge.
- The authoritative loop is now proposal-first.

6. Record progress:

```bash
ema backend flow phase <execution-id> --to idle --reason "boot"
ema backend flow phase <execution-id> --to plan --reason "scoped the work"
ema backend flow phase <execution-id> --to execute --reason "doing the work"
ema backend flow step <execution-id> --label "implemented slice" --note "result evidence path added"
```

Expected result:

- append-only rows in `execution_phase_transitions`
- updated `step_journal` JSON on the execution row

7. Create a result artifact file and attach it:

```bash
mkdir -p ~/.local/share/ema/results/demo-vertical-slice
printf '# Result\n\nVertical slice complete.\n' > ~/.local/share/ema/results/demo-vertical-slice/result.md
ema backend flow result <execution-id> \
  --path ~/.local/share/ema/results/demo-vertical-slice/result.md \
  --summary "Result evidence attached."
```

Expected result:

- `executions.result_path` populated
- `executions.result_summary` populated
- linked intent receives an `execution_result_recorded` event

8. Complete the execution and optionally sync the linked intent:

```bash
ema backend flow complete <execution-id> \
  --summary "Vertical slice complete." \
  --path ~/.local/share/ema/results/demo-vertical-slice/result.md \
  --intent-status completed \
  --intent-event "vertical slice complete"
```

Expected result:

- `executions.status = completed`
- `executions.completed_at` populated
- `executions.result_path` and `executions.result_summary` preserved
- linked intent status updated if `--intent-status` was supplied
- linked intent receives an `execution_completed` event

9. Verify final state:

```bash
curl -sS http://localhost:4488/api/proposals/<proposal-id>
ema backend flow execution <execution-id>
ema backend flow intent int-recovery-wave-1
```

## Backend Endpoints Used

- `GET /api/intents`
- `GET /api/intents/:slug/runtime`
- `POST /api/proposals`
- `POST /api/proposals/:id/approve`
- `POST /api/proposals/:id/executions`
- `GET /api/executions/:id`
- `POST /api/executions/:id/phase`
- `POST /api/executions/:id/steps`
- `POST /api/executions/:id/result`
- `POST /api/executions/:id/complete`

## Storage Writes

- Filesystem semantic source
  - no change unless you edit the original intent markdown
- SQLite operational state
  - `loop_proposals`
  - `loop_events`
  - `executions`
  - `execution_phase_transitions`
  - `intent_links`
  - `intent_events`
  - optionally `intents.status` and `intents.phase`
- Filesystem artifact state
  - result file at the `result_path` you supply

## Scope Boundaries

- This is the current active backend loop.
- It requires proposals.
- It does not require actors.
- It does not require `loop_intents` or `loop_executions` to be active runtime ledgers.
