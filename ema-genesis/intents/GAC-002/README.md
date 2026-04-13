---
id: GAC-002
type: gac_card
layer: intents
title: "Concurrent agent coordination — how do parallel agents not stomp each other?"
status: answered
created: 2026-04-12
updated: 2026-04-12
answered_at: 2026-04-12
answered_by: human
resolution: deferred-to-v2-with-tier-split
author: research-round-1
category: gap
priority: critical
connections:
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
  - { target: "[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]", relation: derived_from }
  - { target: "[[research/agent-orchestration/jayminwest-overstory]]", relation: derived_from }
  - { target: "[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]", relation: derived_from }
  - { target: "[[research/agent-orchestration/dagger-container-use]]", relation: derived_from }
---

# GAC-002 — Concurrent agent coordination

## Question

When EMA runs N agents simultaneously on the same project, how do they not edit the same files at the same time? Canon implies `actor_id` provides isolation — that's false for shared filesystems.

## Context

Round 1 surfaced four distinct coordination models, each with different tradeoffs:

| Model | Source | Isolation level |
|---|---|---|
| **JSON file locks** | `[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]` | Soft, prompt-enforced |
| **SQLite typed mailbox** | `[[research/agent-orchestration/jayminwest-overstory]]` | State-based with WAL |
| **Worktree per agent** | `[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]` | Hard, git-enforced |
| **Container per agent** | `[[research/agent-orchestration/dagger-container-use]]` | Strongest, full FS isolation |

These compose. Most production setups use 2 of the 4. EMA canon currently has zero.

## Options

- **[A] JSON file blackboard only**: Adopt agent_farm's `/coordination/` directory pattern. Cheap, vault-native, prompt-enforced. Good for low-stakes parallel work.
  - **Implications:** Zero infrastructure. Works today. LLM enforces the contract — failure mode is "agent ignores the lock and edits anyway." Acceptable for a personal app.
- **[B] Worktree per agent (Composio model)**: Each agent gets its own git worktree. Hard isolation. Merge happens at workflow completion.
  - **Implications:** No two agents can ever conflict at the file level. Adds git worktree overhead per agent (~MB of disk per instance). Standard pattern in the parallel-coding-agent space.
- **[C] Container per agent (container-use)**: Strongest isolation. Each agent has its own filesystem AND its own dependencies. "agent A needs Node 18, agent B needs Node 22" works.
  - **Implications:** Adds Dagger as a dependency. Container start latency. Strongest correctness guarantees. Overkill for most cases.
- **[D] Three-tier composition**: Filesystem locks for vault edits, SQLite mailbox for structured state coordination, worktree for code edits. Pick the tier per concern.
  - **Implications:** Most correct. Most code. Three primitives to maintain. **Recommended for EMA's heterogeneous workload (vault + structured data + code).**
- **[1] Defer**: Single-agent v1, multi-agent in v2.
- **[2] Skip**: V1-SPEC §7 already says "v1 has one agent." Wait until multi-agent is real.

## Recommendation

**[D] Three-tier composition** as the long-term target, but **[1] defer** for v1 since canon explicitly says single-agent. Document the tier-per-concern split in `AGENT-RUNTIME.md` so the future implementation isn't surprising.

## What this changes

If [D]: AGENT-RUNTIME gains a "Coordination Tiers" section with three patterns explicitly named.
If [1]: BLOCK-002 created — multi-agent coordination deferred.

## Connections

- `[[canon/specs/AGENT-RUNTIME]]`
- `[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]` — JSON locks
- `[[research/agent-orchestration/jayminwest-overstory]]` — SQLite mail
- `[[research/agent-orchestration/ComposioHQ-agent-orchestrator]]` — worktrees
- `[[research/agent-orchestration/dagger-container-use]]` — containers

## Resolution (2026-04-12)

**Answer: [1] Defer for v1** with **[D] three-tier composition** as the locked v2 target.

v1 is single-agent per `EMA-V1-SPEC.md` §7. When multi-agent ships in v2, the three coordination tiers are:

1. **Vault edits → filesystem blackboard** (`.superman/coordination/` JSON locks from `agent_farm`).
2. **Structured state → SQLite mailbox** (`overstory` typed mail with WAL).
3. **Code edits → worktree per agent** (`ComposioHQ agent-orchestrator` model).

Container isolation (`dagger/container-use`) is available but not default — reserved for agents with heterogeneous runtime dependencies.

**Bridge to the recovery wave:** the old Elixir `Ema.Actors.PhaseTransition` (append-only log) and `Ema.Pipes` EventBus become the *intra-tier* coordination signals once multi-agent lands. They are not the coordination *primitive* — they are the observability of it. This is now called out in `[[canon/decisions/DEC-005-actor-phases]]`.

#gac #gap #priority-critical #concurrent-agents #coordination #answered
