---
id: SPEC-PIPES-SYSTEM
type: canon
subtype: spec
layer: canon
title: "Pipes & Routines — trigger/transform/action automation (22 triggers + 15 actions + 5 transforms + 7 stock pipes)"
status: preliminary
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "~/.local/share/ema/vault/wiki/Apps/Pipes-Routines.md"
recovered_at: 2026-04-12
connections:
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
tags: [canon, spec, pipes, automation, triggers, actions, transforms, recovered, preliminary]
---

# Pipes & Routines System

> **Recovery status:** Preliminary. High-confidence spec — the old build's Pipes registry is one of the crispest pieces of the system. Already marked TIER PORT in [[_meta/SELF-POLLINATION-FINDINGS]] §A.3 ("Ema.Pipes — exact 22/15/5 registry to replicate verbatim").

## What it is

Pipes are **event-driven automation chains**: Trigger → Transform → Action. When a trigger fires, any matching pipes run their transforms against the event data and then execute their actions.

Conceptually it's a domain-specific IFTTT: "when a proposal is approved, create a task from it" or "when the brain dump inbox exceeds 10 items, notify the desktop."

## The registry (exact counts from the old build)

- **22 triggers** — event sources that can kick off a pipe
- **15 actions** — operations a pipe can perform
- **5 transforms** — operations on the event data between trigger and action
- **7 stock pipes** — preconfigured pipe definitions that ship with the system

## The 22 triggers (inferred category list)

The exact 22 are not fully enumerated in the prose recovery — follow-up extraction from `lib/ema/pipes/triggers.ex` needed. Categories include:

- **Brain Dump:** `brain_dump:item_created`, `brain_dump:cluster_ready`, `brain_dump:processed`
- **Tasks:** `tasks:created`, `tasks:completed`, `tasks:blocked`
- **Proposals:** `proposals:queued`, `proposals:approved`, `proposals:rejected`
- **Habits:** `habits:completed`, `habits:missed`, `habits:streak_broken`
- **System:** `system:daily`, `system:weekly`, `system:startup`, `system:shutdown`
- **Executions:** `executions:started`, `executions:completed`, `executions:failed`
- **Vault:** `vault:note_created`, `vault:note_updated`
- **Custom:** user-definable triggers from vApps

(The list sums to roughly 22 if you count typical domain coverage — exact names pending follow-up.)

## The 15 actions

Action categories (exact list also pending follow-up):

- **Brain Dump:** `brain_dump:create_item`
- **Tasks:** `tasks:create`, `tasks:update_status`
- **Proposals:** `proposals:approve`, `proposals:reject`, `proposals:create`
- **Vault:** `vault:create_note`, `vault:append_to_note`
- **Notify:** `notify:desktop`, `notify:discord`, `notify:digest`
- **Claude:** `claude:dispatch`, `claude:prompt`
- **System:** `system:log`, `system:emit_event`

## The 5 transforms

Transforms operate on the event payload between trigger and action:

| Transform | What it does |
|---|---|
| `filter` | Drops the event if a condition isn't met (no action runs) |
| `map` | Reshapes the event payload (field renames, type coercion, computed fields) |
| `delay` | Defers action execution by a duration |
| `conditional` | Branches based on event content — different actions for different branches |
| `claude-stub` | Passes the event through an LLM call for semantic transformation (summarization, classification, extraction) |

The `claude-stub` transform is the escape hatch for anything the other four can't do.

## The 7 stock pipes

Preconfigured pipes shipped with the system. Example: "Approved Proposal → Task" — trigger on `proposals:approved`, no transform, action `tasks:create`. User can disable or fork them.

Exact stock pipe definitions not fully recovered — follow-up to extract from `lib/ema/pipes/stock_pipes.ex`.

## Event bus mechanics

- **Topic:** all pipe events flow through a single PubSub topic `"pipes:events"` in the old Elixir build; in TS this becomes an EventEmitter (Node) or similar.
- **Fan-out:** when a trigger fires, the event is published to the topic, and every subscribed pipe gets a chance to match.
- **Ordering:** pipes execute in priority order (priority is a pipe-level field).
- **Error handling:** a failing pipe doesn't block other pipes from running on the same event. Failures are logged to the pipe history.

## CLI surface

The old build had full CLI coverage: `ema pipe list`, `ema pipe show <id>`, `ema pipe create`, `ema pipe toggle <id>`, `ema pipe fork <id>`, `ema pipe catalog`, `ema pipe history <id>`. Catalog shows available triggers/actions/transforms. History shows the pipe's past runs.

## REST + WS surface

- REST: CRUD on pipes, list/show catalog, query history
- WebSocket: live event stream on `pipes:events` topic for real-time UI updates

## Why this is TIER PORT

The trigger/action registry is **domain-agnostic and clean**. It has no Elixir-specific idioms baked in — the pattern (registry + bus + pipe executor) ports to TypeScript with minimal change. The transforms are pure logic. The stock pipes are data, not code. Per [[_meta/SELF-POLLINATION-FINDINGS]] §A, effort estimate is Low–Medium.

## Gaps / open questions

- **Exact 22/15/5 registry contents.** Follow-up extraction from old Elixir source required.
- **Stock pipe definitions.** Same.
- **Per-space pipe scoping.** Should pipes be space-scoped, global, or configurable per pipe? Old build was global; canon Three Truths model ([[canon/decisions/DEC-004-unified-intents-schema]]) implies space-scoping should be an option.
- **Pipe priority default.** Old build had priorities but the default value isn't in the prose.
- **Recursion guard.** If pipe A's action fires a trigger that pipe A subscribes to, you get infinite recursion. Old build had a guard — needs explicit documentation.

## Related

- [[canon/specs/EMA-V1-SPEC]] — parent spec
- [[_meta/SELF-POLLINATION-FINDINGS]] §A.3 TIER PORT entry
- [[vapps/CATALOG]] — Pipes likely becomes a vApp surface in the reconciled catalog
- Original source: `~/.local/share/ema/vault/wiki/Apps/Pipes-Routines.md` + `IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/pipes/`

#canon #spec #pipes #automation #triggers #actions #recovered #preliminary
