---
id: RES-langgraph
type: research
layer: research
category: agent-orchestration
title: "langchain-ai/langgraph — interrupt() primitive for human-in-the-loop pause-and-ask"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-d
source:
  url: https://github.com/langchain-ai/langgraph
  stars: 29043
  verified: 2026-04-12
  last_activity: 2026-04-12
  license: MIT
signal_tier: A
tags: [research, agent-orchestration, approval-ux, interrupt, langgraph]
connections:
  - { target: "[[research/agent-orchestration/_MOC]]", relation: references }
  - { target: "[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]", relation: references }
---

# langchain-ai/langgraph

> Graph-based agent framework whose `interrupt()` primitive is the de facto standard for pause-and-ask patterns. The `{message, options, context}` payload shape is what EMA should adopt for every approval gate.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/langchain-ai/langgraph> |
| Stars | 29,043 (verified 2026-04-12) |
| Last activity | 2026-04-12 |
| Signal tier | **A** |
| Language | Python (TypeScript SDK exists) |
| License | MIT |

## What it is

Graph-based agent framework where each node is a function and edges define the workflow. The `interrupt()` primitive lets a node pause execution and wait for human input. Checkpointer-backed state means the graph survives across the human decision and resumes via thread_id.

## What to steal for EMA

### 1. The `interrupt()` payload shape

```python
def review_node(state):
    decision = interrupt({
        "message": "Should I send this email?",
        "options": ["accept", "reject", "revise"],
        "context": state["draft_email"]
    })
    return {"decision": decision}
```

Three fields:
- `message` — human-readable prompt
- `options` — predefined buttons (optional; degrades to free-text)
- `context` — the structured data being approved

This is the canonical shape. EMA's Proposal table should embed `{message, options, context}` as the approval payload, not just a free-text description.

### 2. Checkpointer-backed resumability

The graph state persists across the human decision. Same machine, same process, different process — doesn't matter. The checkpoint thread_id pulls the state back. EMA needs the same: a paused proposal must survive daemon restart.

### 3. Interrupt as a graph node

The interrupt isn't a special hook attached to a node — it IS a node. This means the interrupt can fire from anywhere in the workflow, not just at "the end." EMA's proposal pipeline currently has approval at the end; this pattern would let the Generator pause for clarification mid-generation.

### 4. Options optional, free-text fallback

When `options` is None, the interrupt takes any string. The same primitive handles both binary approvals and open-ended revision requests. EMA should not require options upfront.

## What it changes about the blueprint

| Canon doc | What changes |
|---|---|
| `BLUEPRINT-PLANNER.md GAC` | Proposals should carry `options[]` not just a binary approve/reject |
| `vapps/CATALOG.md` Tasks | Tasks generated from proposals should embed the original `options` so approval-state is preserved for audit |
| `EMA-GENESIS-PROMPT.md §3 Approval Pattern` | Adopt the `{message, options, context}` payload shape as the canonical interrupt primitive |
| `AGENT-RUNTIME.md` | Agent runs can interrupt at any node, not just at the end |

## Gaps surfaced

- **EMA's proposal pipeline (Generator → Refiner → Debater → Tagger → queued) is linear.** LangGraph's pattern shows interrupts as first-class nodes in the graph. EMA's Tagger-to-queued handoff doesn't support interrupts — the human isn't a node.
- **No mid-pipeline pause.** Currently you can't ask "wait, before refining, should I refine differently?"

## Notes

- Python-first but the **TypeScript SDK is first-class**. EMA can use it directly for the interrupt primitive even before fully porting the proposal pipeline.
- MIT licensed.
- Not non-code per se, but the primitive is **domain-agnostic** — the same interrupt gates a "send this email" decision and an "approve this calendar slot" decision.
- Cousin to `[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]`'s PendingHumanReview — LangGraph's interrupt is the *primitive*; AutoGPT's table is the *persistence*.

## Connections

- `[[research/agent-orchestration/_MOC]]`
- `[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]` — persistence-side cousin
- `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]` — durable workflow cousin (interrupts at workflow level)
- `[[canon/specs/BLUEPRINT-PLANNER]]`
- `[[canon/specs/AGENT-RUNTIME]]`
- `[[DEC-003]]` — aspiration detection canon (uses interrupt primitive)

#research #agent-orchestration #signal-A #langgraph #interrupt #approval-ux
