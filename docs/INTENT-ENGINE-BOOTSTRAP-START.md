# Intent Engine Bootstrap Start

## Purpose

Start the bootstrapped Intent Engine from EMA's actual current state, using the original documentation as guidance but not as unquestioned truth.

This document is the operator and agent handoff for the first live EMA-managed execution after bootstrap.

## Canonical Sources To Trust First

Use these in precedence order:

1. Runtime code in `daemon/lib/`
2. Current bootstrap docs in `docs/`
3. Updated EMA wiki pages under `~/.local/share/ema/vault/wiki/`
4. Older system audits and broad context docs only as historical background

## What The Original Documentation Still Gets Right

- EMA is a three-surface system: semantic truth, operational truth, and knowledge truth.
- Context must be assembled, not dumped.
- The vault/wiki layer matters, but it is not the same thing as the execution system.
- Sessions, executions, and agent surfaces are the real starting point for autonomous work.
- Bootstrap should consolidate existing EMA pieces rather than invent a clean-room replacement.

## What Must Be Treated As Stale Unless Verified

- Old level hierarchies like `mission -> goal -> objective -> step`
- Old MCP counts, old route counts, and old channel counts
- Claims that intent graph population is broader than `brain_dump + execution` wiring
- Claims that the MCP server is Node-only or that the CLI is still the old Python surface
- Claims that the agent-vm EMA vault is already the primary curated wiki store

## Bootstrapped Reality On 2026-04-06

- Canonical semantic store exists in `intents`, `intent_links`, and `intent_events`
- Intent bootstrap import has already populated the graph
- Attachment verbs exist across CLI, HTTP, and MCP
- Runtime auto-linking exists, but needs more audit and backfill
- The original docs overstate breadth and consistency across adjacent subsystems
- The next valuable work is convergence: make EMA's agents, sessions, executions, MCP, CLI, and docs speak one contract

## First Agent Mission

Use EMA itself to start one bounded readiness/convergence pass, not a broad autonomous spree.

Mission:

1. Verify the canonical intent/actor/session/execution contract across code paths
2. Repair the highest-risk mismatches that can silently corrupt runtime truth
3. Update exposed documentation where it would mislead future agents
4. Leave behind a short machine-usable readiness summary

## First Agent Task Definition

Title:

`Intent Engine convergence start`

Scope:

- inspect intent/session/execution auto-linking
- inspect MCP intent tool response shapes
- inspect CLI intent link semantics
- inspect any stale wiki claims that would mislead an EMA-managed agent

Explicit non-goals:

- no broad frontend work
- no TUI work
- no speculative graph expansion
- no cross-machine sync automation

## Required Guardrails

- Do not treat projections as canonical
- Do not reopen completed design questions unless code proves the design invalid
- Prefer fixing contract mismatches over adding new features
- Prefer bounded, verified patches over broad speculative cleanup
- Record contradictions with exact file references

## Suggested Inputs For The First EMA Session

- `docs/INTENT-ENGINE-SPEC.md`
- `docs/INTENT-ACTOR-SESSION-CONTRACT.md`
- `docs/INTENT-ATTACHMENT-IMPLEMENTATION-SPEC.md`
- `docs/INTENT-ENGINE-READINESS-AUDIT.md`
- `docs/INTENT-ENGINE-BOOTSTRAP-START.md`
- `~/.local/share/ema/vault/wiki/Architecture/Intent-System.md`
- `~/.local/share/ema/vault/wiki/Architecture/Context-Assembly.md`
- `~/.local/share/ema/vault/wiki/Architecture/Knowledge-Topology.md`

## Expected Outputs

- one readiness note or report
- small validated code fixes if warranted
- an updated statement of what remains unsafe or incomplete

## Success Condition

EMA can launch and manage the next agent run with a grounded brief, accurate context, and explicit guardrails, without leaning on stale architecture claims.
