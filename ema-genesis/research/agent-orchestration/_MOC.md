---
id: MOC-agent-orchestration
type: moc
layer: research
title: "Agent Orchestration — Map of Content"
status: active
created: 2026-04-12
updated: 2026-04-12
author: system
tags: [moc, research, agent-orchestration]
connections:
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: references }
---

# Agent Orchestration — Map of Content

> Repos covering parallel coding agents, multi-agent coordination, terminal-puppeteer wrappers, cross-machine dispatch, session indexing, durable workflow engines, and approval UX patterns.

## Tier S (direct steal / port)

| Repo | Pattern |
|---|---|
| [[research/agent-orchestration/generalaction-emdash\|emdash]] | 23-provider catalog + SSH remote |
| [[research/agent-orchestration/ComposioHQ-agent-orchestrator\|agent-orchestrator]] | 7-slot plugin architecture |
| [[research/agent-orchestration/jayminwest-overstory\|overstory]] | Hierarchical actors + SQLite mail + tiered watchdog |
| [[research/agent-orchestration/Dicklesworthstone-coding_agent_session_search\|CASS]] | 11-provider session indexer |
| [[research/agent-orchestration/dbos-inc-dbos-transact-ts\|dbos-transact-ts]] | Postgres/SQLite checkpoint protocol — recommended port target |
| [[research/agent-orchestration/temporalio-temporal\|temporal]] | Event-history replay, sticky queues |
| [[research/agent-orchestration/restatedev-restate\|restate]] | Journal-per-invocation, exactly-once |
| [[research/agent-orchestration/inngest-inngest\|inngest]] | step.run memoization, single-binary self-host |
| [[research/agent-orchestration/Significant-Gravitas-AutoGPT\|AutoGPT]] | PendingHumanReview schema |
| [[research/agent-orchestration/open-webui-open-webui\|open-webui]] | Three-mode approval UX |
| [[research/agent-orchestration/danielmiessler-Personal_AI_Infrastructure\|PAI]] | Closest sibling — positioning anchor |
| [[research/cli-terminal/Ark0N-Codeman\|Codeman]] (cross-listed) | EMA's exact stack in miniature |

## Tier A (strong pattern source)

| Repo | Pattern |
|---|---|
| [[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm\|claude_code_agent_farm]] | JSON file-lock coordination + LLM-enforced contract |
| [[research/agent-orchestration/Dicklesworthstone-ntm\|ntm]] | Mixed-provider swarms + Agent Mail |
| [[research/agent-orchestration/dagger-container-use\|container-use]] | Per-agent Dagger containers |
| [[research/agent-orchestration/windmill-labs-windmill\|windmill]] | Tag-based worker routing |
| [[research/agent-orchestration/langchain-ai-langgraph\|langgraph]] | interrupt() primitive |
| [[research/agent-orchestration/gotohuman-mcp-server\|gotohuman]] | Field-level approval |
| [[research/agent-orchestration/roboticforce-sugar\|sugar]] | Issue→fix→verify→PR pipeline |

## Tier B (niche / cautionary / negative)

| Repo | Pattern |
|---|---|
| [[research/agent-orchestration/triggerdotdev-trigger-dev\|trigger.dev]] | CRIU snapshot — investigated, NOT adopted |
| [[research/agent-orchestration/n8n-io-n8n\|n8n]] | Cautionary tale — naive node-checkpointing |
| [[research/agent-orchestration/cadence-workflow-cadence\|cadence]] | Temporal's predecessor — historical |
| [[research/agent-orchestration/shep-ai-shep\|shep]] | Readable seed reference |
| [[research/agent-orchestration/maybe-finance-maybe\|maybe-finance]] | Negative prior art for approval UX |
| [[research/agent-orchestration/ai_automation_suggester\|ai_automation_suggester]] | Anti-pattern — notification without queue |
| [[research/agent-orchestration/sakowicz-actual-ai\|actual-ai]] | Dry-run mode for high-volume |

## Cross-cutting takeaways

1. **The 7-slot plugin architecture (Composio) is converging as the standard.** emdash, Overstory, and Composio all ended up with Runtime/Agent/Workspace/Tracker/SCM/Notifier/Terminal as separable.
2. **Three coordination models exist and compose**: JSON file locks (vault-side), SQLite mail (dispatcher-side), in-process EventBus (UI-side). EMA needs all three for different concerns.
3. **Session indexing is a separate problem from orchestration.** CASS proves the ingest layer should be cross-provider from day one.
4. **Resume protocol consensus**: durable log of steps + stateless workers + heartbeat + deterministic replay + sticky optimization. DBOS-transact-ts is the closest port target.
5. **Approval UX consensus**: AutoGPT's PendingHumanReview schema + LangGraph's interrupt() primitive + Open WebUI's three-mode are the building blocks. EMA can claim novelty in *applying them to non-code domains*.

## Connections

- [[research/_moc/RESEARCH-MOC]] — master index
- [[canon/specs/AGENT-RUNTIME]] — primary canon target
- [[canon/specs/BLUEPRINT-PLANNER]] — execution lifecycle
- [[DEC-003]] — aspiration detection canon claim

#moc #research #agent-orchestration
