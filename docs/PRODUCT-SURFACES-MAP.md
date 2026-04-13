# EMA Product Surfaces Map

Date: 2026-04-13
Status: implementation mapping for the ideal product

## Mapping Rule

Design the merged product first, but map implementation in this order:

1. pluralized runtime domains
2. canon/file domains
3. loop/orchestration domains
4. future domains not yet first-class

The product should not expose the repo's split-brain directly, but implementers
need to know which seam they are standing on.

## Surface Mapping

| Product surface | First runtime mapping | Canon / file mapping | Loop / orchestration mapping | Future domain to add |
|---|---|---|---|---|
| `HQ` | `dashboard`, `spaces`, `executions`, `intents`, `user-state`, `ingestion` | selected canon summaries | proposal/execution status summaries | `hq` read model with unified workspace snapshot |
| `Launchpad` | `workspace`, `visibility`, `user-state` | none | none | shell registry / app capability model |
| `Spaces` | `spaces`, `user-state` | optional pinned canon/project docs | none | richer space-policy domain |
| `Projects` | `projects`, `tasks`, `executions`, `proposals`, `intents` | project-linked notes in `ema-genesis/` | proposal->execution lineage | first-class `project dossier` model |
| `Intents` | `intents` | `ema-genesis/intents/` | `intent` service for deeper lifecycle convergence | intent graph / lineage service |
| `Proposals` | existing `proposals` seed surfaces plus `proposal` approval service | proposal markdown only if added later | `proposal` service is the real approval seam | unified proposal domain replacing split seed vs durable states |
| `Executions` | `executions` | execution records in `ema-genesis/executions/` as writeback artifacts | `execution` service for proposal-gated starts and durable artifact semantics | dispatcher / agent-run domain |
| `Chronicle` | `ingestion` first | future `ema-genesis/chronicle/` manifests | later emits proposal/intention/execution candidates into loop | first-class `chronicle` domain |
| `Review` | no single owner today; start with `ingestion`, `proposals`, `blueprint`, `intents`, `executions` adapters | promotions into canon, intents, executions, research | proposal generation / execution promotion logic converge here | first-class `review` domain |
| `Canon` | no real HTTP surface yet | `ema-genesis/canon/` and related docs | proposal or review output may suggest canon changes | `canon` service |
| `Research / Feeds` | `feeds`, `memory`, `cross-pollination` | `ema-genesis/research/` | proposal seed generation later | richer research compilation service |
| `Agent Workspace` | `actors`, `executions`, `ingestion` | agent-related chronicle dossiers | `execution`, `loop`, future dispatcher | actor lifecycle / runtime service |
| `Human Workspace` | `brain-dump`, `dashboard`, `projects`, `user-state` | personal/project docs as attachments | can generate proposals or intents later | unified capture / notebook domain |
| `Timeline / Activity` | `executions`, `intents`, `ingestion`, `feeds`, `pipes`, `user-state` | receipts and canon change history | loop event stream | first-class event ledger / audit domain |
| `Memory / Context Graph` | `memory`, `cross-pollination` | canon/research links | loop events become additional edges | first-class graph service |
| `Search / Recall / Trace` | aggregation over `intents`, `executions`, `ingestion`, `feeds`, `memory` | canon + research index | loop lineage and chronicle provenance | unified search/index domain |
| `System / Connectors` | `ingestion`, `backend`, `actors`, `settings`, `workspace` | connector policies and chronicle manifests | later agent-dispatch controls | `connectors`, `vault`, `canon` services |

## Immediate Implications

### Chronicle

Chronicle does not map cleanly to one current domain because `ingestion` only
covers discovery, session parsing, and report generation today. For v1,
implementers should:

- use `services/core/ingestion/` as the entry point
- add durable Chronicle storage and index tables
- keep promotion out of canon until review semantics are explicit

### Review

Review is a missing first-class surface. The current repo has review-like logic
spread across:

- blueprint answers
- proposal approval
- intent indexing
- execution completion
- ingestion backfeed suggestions
- feeds promotion actions

That is enough to seed a real review domain, but not enough to pretend one
already exists.

### Proposal / execution convergence

The UI should present a single progression:

`intent -> proposal -> execution -> result`

Implementation is still split:

- `services/core/proposals/` contains seed generation and legacy queue logic
- `services/core/proposal/` contains the durable approval lifecycle
- `services/core/executions/` is the active runtime ledger
- `services/core/execution/` is the deeper proposal-gated execution core

Any UI built now must acknowledge that split and avoid inventing a third model.

## Shell-Level Elements That Are Not Domains

These are important product surfaces, but they should not each become new
backend domains:

- Launchpad
- Command Bar
- Inspector
- Review Tray
- Activity Drawer
- Omnibox search

They are shell constructs over existing domains.

## Surfaces That Should Be Treated As Derived

The current renderer includes many surface names that should not be treated as
top-level product authorities until they have domain ownership:

- `HQ` as just another tile
- `Voice` as a standalone product pillar
- `Campaigns`
- `Governance`
- `Babysitter`
- `Evolution`

These may remain useful views, but the product map should be anchored in Work,
Chronicle, Review, Knowledge, Trace, and System instead.
