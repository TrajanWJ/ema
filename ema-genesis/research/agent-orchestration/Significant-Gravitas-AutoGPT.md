---
id: RES-AutoGPT
type: research
layer: research
category: agent-orchestration
title: "Significant-Gravitas/AutoGPT — PendingHumanReview schema for tap-to-accept agent suggestions"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-d
source:
  url: https://github.com/Significant-Gravitas/AutoGPT
  stars: 183342
  verified: 2026-04-12
  last_activity: 2026-04-12
  license: NOASSERTION (Polyform Shield for backend platform)
signal_tier: S
tags: [research, agent-orchestration, approval-ux, schema, autogpt]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[canon/specs/BLUEPRINT-PLANNER]]", relation: references }
  - { target: "[[canon/specs/EMA-GENESIS-PROMPT]]", relation: references }
  - { target: "[[DEC-003]]", relation: references }
---

# Significant-Gravitas/AutoGPT

> Closest prior art for EMA's "Agent auto-fills suggestion → human decides" pattern. The `PendingHumanReview` schema is the data model EMA should adopt.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/Significant-Gravitas/AutoGPT> |
| Stars | 183,342 (verified 2026-04-12) |
| Last activity | 2026-04-12 |
| Signal tier | **S** |
| License | NOASSERTION (Polyform Shield — verify before depending) |
| Key file | `autogpt_platform/backend/backend/data/human_review.py` |

## What it is

Agent-building platform with a real `PendingHumanReview` table backing block-level approval gates. Agents pause at configured nodes for human review, the platform persists pending state, the user accepts/rejects/edits in a web UI, and the agent resumes with the user's decision. Used in production for non-code workflows: email sending, content posting, purchases.

## What to steal for EMA

### 1. The PendingHumanReview schema (lift verbatim)

```python
PendingHumanReview {
  nodeExecId: string        # which step in the workflow paused
  userId: string            # who reviews
  graphExecId: string       # parent execution
  payload: SafeJsonData     # the proposed action (structured)
  instructions: string      # human-readable description
  editable: boolean         # can user revise, or just approve/reject
  reviewMessage: string     # optional rejection rationale
  wasEdited: boolean        # audit bit: did the user modify before approving
  reviewedAt: timestamp
  status: enum              # WAITING | APPROVED | REJECTED
  processed: boolean        # has the agent consumed the decision
}
```

EMA should adopt this five-field core (`payload`, `instructions`, `editable`, `status`, `wasEdited`) for the Proposal table augmentations. Three things EMA's current schema doesn't have:
- **`editable`** flag separate from status — revise vs approve are orthogonal
- **`wasEdited`** audit bit — downstream consumers need to know if a "yes" was actually a "yes-with-changes"
- **`instructions`** field separate from payload content — human prose explaining what the agent wants approved, vs the raw structured proposal

### 2. Auto-approve trust scopes

The pattern `auto_approve_{graph_exec_id}_{node_id}` lets users pre-approve a trusted node for the rest of a run. EMA's Aspirations Log and proposal pipeline could mirror this for trusted agents:
- Trust scope keyed by `(actor_id, action_type, context_hash)`
- "Allow always for this agent in this space" toggle
- Audit log of trust grants for revocation

### 3. Block-level pause semantics

AutoGPT's approval gates live at **specific nodes** in the agent graph, not at execution boundaries. Any node can request review. EMA's proposal pipeline (Generator → Refiner → Debater → Tagger) currently approves at the end; this pattern would let any stage request human input.

## What it changes about the blueprint

| Canon doc | What changes |
|---|---|
| `EMA-GENESIS-PROMPT.md §3 Approval Pattern` | Adopt the 5-field schema (`payload`, `instructions`, `editable`, `status`, `wasEdited`). Add trust-scope concept for "Allow Always for this agent in this space." |
| `BLUEPRINT-PLANNER.md GAC` | Add "trust scope" so humans can pre-approve by `(agent, action-type, context)`. |
| `vapps/CATALOG.md vApp 5` (Brain Dumps) | Add `reviewMessage` field for rejection rationale that can train the agent over time. |
| Proposal schema | Add `editable: boolean`, `wasEdited: boolean`, `instructions: string`, `review_message: string` fields. |
| `[[DEC-003]]` aspiration detection canon | The PendingHumanReview schema is the queue model for confirmed/dismissed aspirations. |

## Gaps surfaced

- EMA's current `Ema.Proposals` schema has approve/kill/redirect but **no explicit "edit-then-approve" path** — `wasEdited` is missing.
- **No trust-scope/auto-approve mechanism** — every proposal is full-friction approval.
- **No `instructions` field separate from payload content** — human prose explaining the proposal vs the structured proposal itself.

## Notes

- 183k stars, very mature, but the relevant code is in `autogpt_platform/` (the newer Block-based platform), not the original AutoGPT script.
- Polyform Shield license on the platform — verify EMA can copy schema concepts (almost certainly yes; concepts aren't copyrightable) before lifting code.
- The non-code framing is real — AutoGPT Platform workflows handle email sending, content posting, and purchases with this table gating them.

## Connections

- `[[research/agent-orchestration/_MOC]]`
- `[[research/agent-orchestration/langchain-ai-langgraph]]` — `interrupt()` primitive cousin
- `[[research/life-os-adhd/ErnieAtLYD-retrospect-ai]]` — confidence UX cousin
- `[[canon/specs/BLUEPRINT-PLANNER]]`
- `[[canon/specs/EMA-GENESIS-PROMPT]]`
- `[[DEC-003]]` — aspiration detection canon claim (uses this schema for the queue)

#research #agent-orchestration #signal-S #autogpt #approval-ux #pending-human-review
