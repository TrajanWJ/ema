---
id: RES-litellm
type: research
layer: research
category: context-memory
title: "BerriAI/litellm — unified LLM gateway with explicit token budgeting per source"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-f
source:
  url: https://github.com/BerriAI/litellm
  stars: 43034
  verified: 2026-04-12
  last_activity: 2026-04-12
  license: MIT
signal_tier: S
tags: [research, context-memory, llm-gateway, budget, litellm]
connections:
  - { target: "[[research/context-memory/_MOC]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
---

# BerriAI/litellm

> Unified gateway proxy for 100+ LLM APIs with **explicit token budgeting per source**. Concrete answer to "how do you manage 80k tokens across competing context sources" that Round 1 couldn't find.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/BerriAI/litellm> |
| Stars | 43,034 (verified 2026-04-12) |
| Last activity | 2026-04-12 (v1.83.7 released today) |
| Signal tier | **S** |
| License | MIT |
| Language | Python (importable as a library, not just a proxy) |

## What it is

Unified gateway for 100+ LLM APIs (Anthropic, OpenAI, Azure, Bedrock, Ollama, etc.) with normalized request/response shapes, automatic retry, fallback chains, cost tracking, and **per-virtual-key budget enforcement**. Used as a proxy in production but the Python module is importable as a library.

## What to steal for EMA

### 1. Token-budget-per-source allocation

EMA's `assembleContext` currently has no budget awareness. If the intent tree grows to 50 nodes + wiki context + recent proposals + project notes, you'll blow past 128k silently. LiteLLM's pattern:

```python
context_budget = {
  "system_prompt":    4096,
  "core_memory":      8192,    # always-pinned facts
  "topic_memory":    20480,    # vector-search results
  "recent_messages":  8192,    # conversation history
  "intent_tree":     16384,    # structured graph data
  "code_files":      32768,    # file content for coding tasks
  "response":         8192,    # reserved for model output
}
# total: ~98k, leave headroom under 128k
```

Each source has a hard budget. Overflow rules per source. Total enforced before the API call.

EMA's `Ema.Bridge.SmartRouter` already does multi-account routing; adding a `ContextBudget` middleware is the missing piece.

### 2. Budget exceeded → fail fast (429-style)

LiteLLM's Router supports `budget_duration` (daily/monthly) and `max_budget` per virtual key, with automatic rejection when exceeded. EMA should:
- Reject the request with a clear error code when budget is exceeded
- Log the rejection
- Surface in the UI

**Don't silently truncate.** Silent truncation hides the problem until the user wonders why the agent forgot something.

### 3. Multi-provider fallback chains

```python
fallbacks = [
  {"model": "claude-sonnet-4-6", "api_key_name": "anthropic-prod"},
  {"model": "claude-sonnet-4-6", "api_key_name": "anthropic-backup"},
  {"model": "gpt-4-turbo", "api_key_name": "openai-fallback"},
  {"model": "ollama/llama3.2:latest"},  # local final fallback
]
```

EMA's Bridge has SmartRouter with 6 routing strategies. The fallback-chain shape is more useful than strategy-based routing for "the primary failed, what next?"

### 4. Per-request token allocation API

```python
litellm.completion(
  model="claude-sonnet-4-6",
  messages=...,
  modify_params={
    "max_input_tokens": 96000,
    "max_output_tokens": 8192,
  },
)
```

EMA agents can declare their budget at call time. The router enforces it.

## What it changes about the blueprint

| Canon doc | What changes |
|---|---|
| `EMA-V1-SPEC.md §9 assembleContext` | Add explicit per-source budgets and overflow rules. Fail fast on exceed, don't silently truncate. |
| `[[_meta/SELF-POLLINATION-FINDINGS]]` | The `Ema.Bridge` SmartRouter survives porting; add a ContextBudget middleware following LiteLLM's pattern |
| `[[canon/specs/AGENT-RUNTIME]]` | Agent tool calls declare budgets at invocation; runtime enforces |

## Gaps surfaced

- **EMA's `ContextManager.build_prompt/1` has no budget awareness.** The prompt grows until something explodes.
- **No fail-fast on overflow.** Silent truncation is the current implicit behavior.
- **No per-source budget allocation** — context is one big pool.

## Notes

- LiteLLM is primarily a proxy but the Python router module is importable as a library.
- The budget enforcement logic is small (~500 LOC). Easy to port to TypeScript.
- 43k stars, MIT licensed, very active. Battle-tested in production.
- EMA already has multi-account routing (`SmartRouter`); add the ContextBudget layer rather than replacing.

## Connections

- `[[research/context-memory/_MOC]]`
- `[[research/context-memory/Paul-Kyle-palinode]]` — 2-phase context assembly cousin (Core + Topic budgets)
- `[[research/context-memory/letta-ai-letta]]` — OS-memory-hierarchy with explicit core/recall/archival budgets
- `[[canon/specs/EMA-V1-SPEC]]` §9 assembleContext
- `[[canon/specs/AGENT-RUNTIME]]`
- `[[_meta/SELF-POLLINATION-FINDINGS]]`

#research #context-memory #signal-S #litellm #budget #llm-gateway
