---
id: META-CLI-PARITY-GAP-2026-04-12
type: meta
layer: _meta
title: "CLI Parity Gap — 14 old Elixir noun groups vs current TS CLI (1 topic) and the port plan"
status: active
created: 2026-04-12
updated: 2026-04-12
author: cli-parity-pass
connections:
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
  - { target: "[[canon/decisions/DEC-008-daily-validation-ritual]]", relation: gates }
  - { target: "[[intents/INT-RECOVERY-WAVE-1]]", relation: references }
tags: [meta, cli, parity, gap-analysis, port-plan, wave-1]
---

# CLI Parity Gap — 2026-04-12

> **Why this doc exists:** the CLI is the primary agent access surface per `EMA-V1-SPEC`. The old Elixir build shipped a 14-noun-group CLI (55+ commands). The current TypeScript CLI ships 1 topic (`research`) with 4 subcommands. That's a ~95% parity gap. Closing it is a prerequisite for `DEC-008` (30-day validation ritual) because the ritual uses CLI commands the TS build doesn't have yet.

## Current state — TS CLI (`cli/` package)

- **Framework:** oclif v4 (canon spec §11 Q5 recommended Commander.js; implementation chose oclif. Oclif stays — it's already wired and has better multi-command DX.)
- **Package:** `@ema/cli` v0.2.0 — "bootstrap v0.2, research-layer query surface"
- **Topics:** 1 (`research`)
- **Commands:** 4 (`research list`, `research get`, `research search`, `research node`)
- **Library infrastructure (good — reusable):**
  - `lib/genesis-root.ts` — resolves ema-genesis/ root
  - `lib/frontmatter.ts` — YAML frontmatter parser + typed getters
  - `lib/node-loader.ts` — walks research/ tree, parses markdown, builds typed nodes, in-process cache
  - `lib/clones-scanner.ts`, `lib/extractions-scanner.ts` — research-specific scanners
  - `lib/rg-wrapper.ts` — ripgrep wrapper
  - `lib/table-printer.ts` — human-readable table output
- **Code quality:** solid. The node-loader pattern is the template for every future noun loader.

## Target state — old Elixir CLI (14 noun groups, 55+ commands)

Recovered verbatim from `_meta/SELF-POLLINATION-FINDINGS.md` Appendix A.1:

| Noun | Verbs | Notable flags |
|---|---|---|
| `vault` | tree, imports, stale, search | `--format`, `--limit` |
| `intent` | search, graph, list, trace, create, context, status, link | `--project`, `--days` |
| `proposal` | list, show, validate, approve, reject, generate, genealogy | `--seed`, `--status`, `--measure-latency` |
| `session` | state, list, crystallize, export | `--project`, `--limit` |
| `quality` | report, friction, gradient, budget, threats, improve | `--days=7` |
| `routing` | status, fitness, dispatch | `--project` |
| `health` | dashboard, check | — |
| `test` | run | `--suite=unit/integration/ai/stress/all` |
| `pipe` | list, show, create, toggle, catalog, history | `--trigger=manual:trigger` |
| `campaign` | list, show, create, run, advance, runs | — |
| `channel` | list, health, inbox, send, messages | `--message` |
| `ai-session` | list, show, create, resume, fork | `--project` |
| `evolution` | rules, signals, stats, scan, propose, activate, rollback | `--force` |
| `superman` | ask, context, health, index, gaps, flows | `--project`, `--force` |

**Global flags:** `--format=table|json|csv`, `--limit=N`, `--project=<id>`, `--days=N`

**Plus top-level verbs** mentioned in canon (V1-SPEC + DEC-008) but not in the 14 groups:
- `ema dump "<text>"` — brain dump capture (short alias)
- `ema briefing` — morning briefing view
- `ema now` — top-priority item right now
- `ema status` — overall system health (probably aliased to `health check`)

## The parity gap

- **Missing noun groups:** 14 (100% of the old CLI API)
- **Missing top-level verbs:** 4 (dump, briefing, now, status)
- **Current extras vs old:** 1 (`research` topic — genesis-specific, no old equivalent)

## Port order — prioritized by the daily ritual and the feedback loop

The daily ritual in `DEC-008` is the v1 acceptance criterion. The CLI needs at least these commands working for the ritual to make sense:

### Tier 1 — Blocking the daily ritual (ship this first)

1. **`ema intent list`** — show current intents (morning briefing input)
2. **`ema intent show <slug>`** — drill into a specific intent
3. **`ema health check`** — smoke test that the CLI can reach the genesis root and daemon (if any)
4. **`ema briefing`** — the morning briefing view (aggregate of intents + proposals + execution status)
5. **`ema now`** — top-priority item right now (similar to One Thing card)
6. **`ema dump "<text>"`** — brain dump capture (writes a new brain-dump file)
7. **`ema proposal list`** — show queued proposals (evening triage input)
8. **`ema proposal show <id>`** — drill into a proposal
9. **`ema proposal approve <id>` / `reject <id>`** — the triage verbs

### Tier 2 — Feedback loop completion

10. **`ema intent create`** — write a new intent from CLI
11. **`ema execution list`** — show running/completed executions
12. **`ema execution show <id>`** — details
13. **`ema vault search <query>`** — query the vault / wiki
14. **`ema vault stale`** — list nodes with stale freshness per `_meta/QUALITY-METRICS-SCHEMA`

### Tier 3 — Old CLI parity for observability and automation

15. **`ema pipe list` / `show` / `catalog`** — automation inspection
16. **`ema session list` / `show`** — agent session tracking
17. **`ema quality report`** — quality audit summary
18. **`ema evolution scan` / `propose`** — autonomous reasoning pass

### Tier 4 — Everything else, deferred until Wave 2+

19. Routing, channel, campaign, test, superman, ai-session — all port when their downstream services land.

## Framework commitment

**Stay with oclif.** Canon V1-SPEC §11 Q5 recommended Commander.js but did not mandate it. Oclif's multi-command + topic structure is a better fit for a `<noun> <verb>` CLI surface. The implementation already wires oclif v4 and ships working commands. Switching now is pure churn with no user-visible benefit.

## What the TS CLI needs that the old build's CLI didn't

- **Genesis-node awareness.** The old Elixir CLI talked to the Phoenix daemon. The new TS CLI needs to talk to both: the daemon (when it exists) and the `ema-genesis/` markdown graph directly. For v1 where the daemon is still bootstrapping, read-only commands (`list`, `show`, `search`) should work **against the genesis filesystem directly** without needing the daemon.
- **Three Truths awareness.** Per `DEC-007`, data lives in three domains. Every query needs to know which domain it's hitting. A simple `ema intent list` queries the Semantic domain; `ema proposal list` queries Operational; `ema vault search` queries Knowledge.
- **Quality metrics awareness.** Per `_meta/QUALITY-METRICS-SCHEMA`, CLI commands that display nodes should show their freshness and confidence (when present). Unmarked fields render as `—`, not errors.

## Port strategy — mirror the node-loader pattern

Every noun gets its own loader module under `cli/src/lib/`:
- `intent-loader.ts` — walks `ema-genesis/intents/`, parses frontmatter, returns typed intent records
- `proposal-loader.ts` — walks proposals, same pattern
- `canon-loader.ts` — walks `canon/specs/` and `canon/decisions/`

Each loader follows the existing `node-loader.ts` template:
1. Read a configured directory tree
2. Skip underscore-prefixed dirs (MOCs, etc.)
3. Parse frontmatter + body
4. Return typed records
5. Cache per CLI invocation

Commands under `cli/src/commands/<noun>/<verb>.ts` consume loaders and render output via `table-printer.ts`.

## Open questions

- **Daemon-or-filesystem mode detection.** When the daemon is running, should commands prefer it for fresh data? Or always read genesis directly? Probably: daemon-first if available, filesystem fallback.
- **`ema now` algorithm.** What's the ranking function? Same as the One Thing card (per `research/frontend-patterns/launchpad-one-thing-card`)? Needs a spec or a canonical algorithm doc.
- **`ema dump` destination.** Writes where? `.superman/brain-dumps/<date>.md`? `ema-genesis/intents/brain-dumps/`? Outside the canon graph somewhere?
- **Proposal approval wire.** `ema proposal approve` needs to write somewhere that a downstream worker picks up. In v1 with no daemon, does it just update frontmatter and leave the execution for the next daemon run? Needs a design.
- **Global flags plumbing.** Oclif supports global flags at the root level — need to wire `--format`, `--limit`, `--project`, `--days` uniformly.

## First batch (this pass)

Three commands + one library to prove the pattern works end-to-end:

1. `cli/src/lib/intent-loader.ts` — new loader for intents
2. `cli/src/commands/intent/list.ts` — list all intents with kind, status, priority, title
3. `cli/src/commands/intent/show.ts` — show a specific intent by slug
4. `cli/src/commands/health/check.ts` — smoke test: finds genesis root, counts canon / intents / executions / research nodes, reports OK

After this batch, `ema intent list`, `ema intent show <slug>`, and `ema health check` all work against the live genesis graph. That's the minimum proof that "the CLI reflects live canon and is an agent's access into the system."

## Related

- [[_meta/SELF-POLLINATION-FINDINGS]] §A.1 — source of the 14-group inventory
- [[canon/specs/EMA-V1-SPEC]] — CLI spec
- [[canon/decisions/DEC-008-daily-validation-ritual]] — gates CLI on daily ritual
- [[intents/INT-RECOVERY-WAVE-1]] — master recovery intent
- [[_meta/QUALITY-METRICS-SCHEMA]] — CLI should surface quality fields when present

#meta #cli #parity #gap-analysis #port-plan #wave-1
