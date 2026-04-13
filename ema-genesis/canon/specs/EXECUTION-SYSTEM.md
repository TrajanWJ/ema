---
id: SPEC-EXECUTION-SYSTEM
type: canon
subtype: spec
layer: canon
title: "Execution System — runtime linkage between brain dump, intent, proposal, session (15-field schema + Dispatcher + IntentFolder + Reflexion)"
status: preliminary
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "~/.local/share/ema/vault/wiki/Architecture/Execution-System.md"
recovered_at: 2026-04-12
connections:
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
  - { target: "[[canon/decisions/DEC-004-unified-intents-schema]]", relation: references }
  - { target: "[[intents/INT-FEEDBACK-LOOP-INTEGRATION]]", relation: references }
  - { target: "[[intents/INT-NERVOUS-SYSTEM-WIRING]]", relation: references }
tags: [canon, spec, executions, dispatcher, intent-folder, reflexion, recovered, preliminary]
---

# Execution System

> **Recovery status:** Preliminary. Core runtime. An Execution is the **operational-truth record** of work that actually happened or is happening — the Operational domain in [[canon/decisions/DEC-004-unified-intents-schema]]'s Three Truths model.

## What an Execution is

An Execution is the runtime linkage between four concepts:

1. **Brain dump** — the seed thought
2. **Intent** — the semantic goal it serves
3. **Proposal** — the specific approach chosen
4. **Session** — the actual work (Claude session, worktree, logs)

Executions close the loop: brain dump → (via proposal pipeline) → proposal → (via approval) → execution → (via session) → outcome → (via feedback) → next brain dump or better proposal.

## The schema (15 fields)

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Primary key, execution ID |
| `title` | string | Display title |
| `objective` | text | What the execution is trying to achieve |
| `mode` | enum | `research | outline | implement | review | harvest | refactor` |
| `status` | enum | `queued | running | complete | failed | partial | blocked | cancelled` |
| `requires_approval` | bool | Must the execution wait for human approval before running? |
| `intent_slug` | string | FK to the intent this serves (semantic domain) |
| `intent_path` | string | Filesystem path to the intent folder (`.superman/intents/<slug>/`) |
| `result_path` | string | Filesystem path where execution results land |
| `session_id` | string | FK to the Claude session that ran this |
| `git_diff` | text | Captured diff if the execution produced code changes |
| `space_id` | string | FK to the Space (scoping — per [[canon/decisions/DEC-004-unified-intents-schema]]) |
| `actor_id` | string | FK to the Actor (human or agent) responsible |
| `created_at` | timestamp | When the execution was created |
| `completed_at` | timestamp\|nil | When it finished (nil if still running) |

## The 6 modes

| Mode | What it does |
|---|---|
| `research` | Investigation, no code changes expected. Outputs notes/docs. |
| `outline` | Planning, produces a structured plan but doesn't execute it. |
| `implement` | Code changes. Worktree-isolated, diff captured. |
| `review` | Reviews existing work (code diff, plan, spec). Outputs findings. |
| `harvest` | Extracts knowledge from completed work into the vault. Runs the Archivist role. |
| `refactor` | Refactor-only implementation. Behavior preservation required. |

## Dispatcher

The Dispatcher is a GenServer (Elixir) subscribed to the PubSub topic `"executions:dispatch"`. When a new execution record is created with status `queued`, the Dispatcher:

1. Decides whether the execution needs approval (checks `requires_approval` flag)
2. If approval needed, routes to the approval queue and waits
3. If approved (or no approval needed), picks up the execution, sets status `running`
4. Creates an IntentFolder at `intent_path` if it doesn't exist
5. Injects Reflexion context (lessons from past executions)
6. Launches the session via the Claude Runner
7. Watches for session completion, updates status, captures diff/outputs
8. Emits completion event on `"executions:complete"` topic

In the TypeScript rebuild, the GenServer becomes a Node worker + event emitter. The pattern is otherwise identical.

## IntentFolder

A per-intent filesystem folder at `.superman/intents/<slug>/` containing (per the wiki):

| File | Purpose |
|---|---|
| `intent.md` | The intent text itself (short — usually 1-3 lines) |
| `status.json` | Runtime status — current phase, blockers, timestamps |
| `signals.md` | Early signals that informed the intent |
| `decisions.md` | Decisions made during execution |
| `research.md` | Research gathered |
| `outline.md` | Plan / outline |
| `plan.md` | The active plan |
| `execution-log.md` | Append-only log of execution events |

**The IntentFolder is the filesystem canonical layer** of the two-layer architecture from [[canon/decisions/DEC-004-unified-intents-schema]]. The DB index is derived; if the DB is wiped, the IntentFolder alone can rebuild it.

## Reflexion injector

Before launching an execution session, the Reflexion injector:

1. Queries Memory for lessons from past executions (same intent, similar objective, or similar mode)
2. Prepends them to the execution prompt as a "lessons learned" section
3. Launches with the augmented prompt

This is how the feedback loop closes — past outcomes literally inform new execution prompts. Per [[intents/INT-FEEDBACK-LOOP-INTEGRATION]], this is one of the "wires" that must be connected for the loop to function.

Currently (in the old build) the Reflexion injector exists but Memory isn't always populated. [[intents/INT-NERVOUS-SYSTEM-WIRING]] wire #1 fixes this — `Memory.store_entry` from Dispatcher outcomes.

## Router classification

The Dispatcher uses a heuristic router to classify incoming execution requests into the 6 modes. The heuristic is based on keywords in the objective, presence of file paths, etc. Old build treated this as lightweight. In TS this becomes a simple rules engine — not an LLM call.

## Why this is TIER PORT

Per [[_meta/SELF-POLLINATION-FINDINGS]] §A TIER PORT `Ema.Executions.Dispatcher`:
- Intent folder coupling (`intent_slug` decouples logical intent from filesystem location) is right
- Reflexion (lessons prepended to new prompts) is right
- Router classification heuristic is right
- Effort estimate: Medium

The pattern is EMA-native and well-tested. The TS port swaps GenServer→Node worker and PubSub→EventEmitter but keeps the shape identical.

## Gaps / open questions

- **Outcome schema.** Executions complete with a status, but the richer "outcome" concept (lessons, confidence, metadata) isn't a first-class field. [[intents/INT-FEEDBACK-LOOP-INTEGRATION]] surfaces this gap.
- **IntentFolder file conventions.** 8 files listed. Are all required or are some optional? What's the order of creation? Old build behavior unclear from prose.
- **Approval UI.** `requires_approval` flag exists but the approval UI is not specified. vApp #18 Blueprint Planner handles this in canon, but the actual interaction pattern (modal? inline? notification?) needs a frontend spec.
- **Session lifecycle.** What happens if a session crashes mid-execution? Resume? Restart? Mark failed? [[intents/INT-FEEDBACK-LOOP-INTEGRATION]] #3 (durable step persistence) is the fix.
- **Mode inference vs explicit.** The router heuristic can be wrong. Is there a user override? Probably yes via `ema execute --mode implement`, but needs confirmation.

## Related

- [[canon/specs/EMA-V1-SPEC]] — parent spec
- [[canon/decisions/DEC-004-unified-intents-schema]] — Three Truths Operational domain
- [[intents/INT-FEEDBACK-LOOP-INTEGRATION]] — the integration test covering this system
- [[intents/INT-NERVOUS-SYSTEM-WIRING]] — the 4 wires touching this system
- [[canon/specs/ACTOR-WORKSPACE-SYSTEM]] — `actor_id` FK
- [[_meta/SELF-POLLINATION-FINDINGS]] §A TIER PORT `Ema.Executions.Dispatcher`
- Original source: `~/.local/share/ema/vault/wiki/Architecture/Execution-System.md`

#canon #spec #executions #dispatcher #intent-folder #reflexion #recovered #preliminary
