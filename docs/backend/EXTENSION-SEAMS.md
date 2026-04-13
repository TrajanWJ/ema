# Backend Extension Seams

EMA is still being discovered. These seams are intentional.

## 1. Proposal System

Current seam:

- `services/core/proposal/*` owns the active durable proposal lifecycle.
- `services/core/proposals/*` can keep harvesting proposal seeds from vault, brain dump, and intent runtime bundles.

Future addition:

- Add supervised generation workers that turn harvested seeds into durable proposals through the active proposal service.

Do not do yet:

- Reintroduce a second live proposal runtime beside `services/core/proposal/*`.
- Treat harvested seeds as approved work objects.

## 2. Actor Runtime

Current seam:

- `services/core/actors/*` supports runtime transition ingest and classification only.

Future addition:

- Add a real actor service with storage and lifecycle once actor state becomes operationally necessary.

Do not do yet:

- Treat actors as a core CRUD entity in the backend spine.

## 3. Interface Growth

Current seam:

- The backend exposes `/api/backend/manifest` so interfaces can inspect the active contract.
- `/api/proposals` now serves the durable proposal lifecycle and is safe to target directly.

Future addition:

- Renderer, CLI, and future agents can converge on this contract without guessing active domains.

Do not do yet:

- Rewire the whole frontend to speculative routes/channels that the backend does not serve.

## 4. Knowledge / Memory

Current seam:

- Vault harvesting and cross-pollination exist as supporting layers.

Future addition:

- Graph/index upgrades can be added as derived read models over canon and runtime state.

Do not do yet:

- Make knowledge graph infrastructure a required write path for core work execution.

## 5. Storage Evolution

Current seam:

- Canonical semantic data lives in files.
- Runtime operational data lives in SQLite.
- Durable proposals currently live in the historical `loop_proposals` table.
- Generated artifacts live on disk.

Future addition:

- Migrations and richer derived read models can be layered in without changing those boundaries.

Do not do yet:

- Introduce a second primary runtime database or a second semantic source of truth.

## 6. Planning Automation

Current seam:

- `services/core/goals/*` and `services/core/calendar/*` provide the durable planning ledger.
- Agent phased buildouts are explicit rows in `calendar_entries`, not hidden worker state.

Future addition:

- A scheduler, strategist, or temporal recommender can layer on top of the same ledger and emit suggested blocks or revisions.

Do not do yet:

- Reintroduce the old calendar-driver, temporal heuristics, or meeting-only model as competing write paths.
