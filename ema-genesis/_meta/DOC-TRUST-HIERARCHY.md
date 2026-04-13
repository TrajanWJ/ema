---
id: META-DOC-TRUST-HIERARCHY
type: meta
layer: _meta
title: "Documentation Trust Hierarchy — what to believe when sources disagree"
status: preliminary
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/.superman/intents/bootstrapped-system-start-original-docs-are-directionally-u/"
recovered_at: 2026-04-12
original_author: human
connections:
  - { target: "[[_meta/CANON-STATUS]]", relation: references }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
tags: [meta, governance, trust, provenance, recovered, preliminary]
---

# Documentation Trust Hierarchy

> **Recovery status:** Preliminary. Governance rule from the old build, generalized for the rebuild. Answers: "when the sources disagree about what EMA is, which source wins?"

## Original statement (verbatim)

> Bootstrapped system start: original docs are directionally useful but operationally stale in several seams. Canonical startup should trust daemon/lib runtime code first, then current docs and updated wiki. First EMA-managed agent mission: bounded convergence pass across intent/session/execution contract, MCP response shapes, CLI semantics, and stale wiki claims.

## The trust ranking (adapted for the rebuild)

When sources disagree, trust in this order. Higher wins.

| Rank | Source | Trust level | Why |
|---|---|---|---|
| 1 | `ema-genesis/canon/decisions/` (locked DEC cards) | Highest | Ratified architectural decisions with explicit supersedes chains |
| 2 | `ema-genesis/canon/specs/` (active canon specs) | High | Canonical specs, locked via intent+proposal |
| 3 | `ema-genesis/_meta/CANON-STATUS.md` | High | Ruling doc on doc precedence |
| 4 | `ema-genesis/_meta/SELF-POLLINATION-FINDINGS.md` | Medium-high | Ground-truth inventory of what exists |
| 5 | New-build runtime code under `apps/`, `services/`, `workers/`, etc. | Medium-high | What actually runs in the new build |
| 6 | `ema-genesis/intents/` (active intents and GAC cards) | Medium | Open questions and queued work — aspirational |
| 7 | `ema-genesis/research/` (research nodes) | Medium | External patterns and ideas, not authoritative |
| 8 | EMA wiki at `~/.local/share/ema/vault/wiki/` | Low-medium | Old build era; may be operationally stale |
| 9 | `IGNORE_OLD_TAURI_BUILD/` code | Low | Reference material only, not canonical |
| 10 | `IGNORE_OLD_TAURI_BUILD/` docs (READMEs, inline comments) | Low | Historical, may contradict current canon |
| 11 | Legacy Obsidian vault at `~/Documents/obsidian_first_stuff/twj1/` | Lowest | Pre-canon thinking, mostly non-EMA anyway |

## Provenance rule

**Every recovered artifact in genesis must carry `recovered_from`, `recovered_at`, and `status` frontmatter fields.** Status must be one of `preliminary`, `reviewed`, `active`, or `locked`. A reader should always be able to tell which trust tier a recovered doc came from and what state it's currently in.

## When to upgrade a preliminary doc

A `status: preliminary` doc in canon can be upgraded to `active` when:

1. An intent + proposal explicitly ratifies it, OR
2. It has been referenced by at least 3 other canon nodes without contradictions being raised, OR
3. The human explicitly marks it ratified in a commit

## When to downgrade an active doc

An `active` canon doc gets downgraded to `preliminary` or removed when:

1. A new DEC card explicitly supersedes it, OR
2. Runtime code has diverged from it in a way that the code is intentional and correct
3. An agent-driven review finds factual errors (requires human approval to execute the downgrade)

## Stale wiki claims

The original intent called out specific categories of stale wiki claims to watch for:
- Intent/session/execution contract shapes
- MCP response formats
- CLI command semantics
- General "what the system does" claims

Any of these that still linger in recovered wiki docs should be flagged, not silently trusted.

## Who owns convergence

The "first EMA-managed agent mission" in the original was a **bounded convergence pass** — an agent walks the doc graph, finds contradictions, and either reconciles them in place or files them as intents. That mission doesn't exist yet. When it does, this trust hierarchy is its rulebook.

## Related

- [[_meta/CANON-STATUS]] — ruling doc on doc precedence
- [[_meta/SELF-POLLINATION-FINDINGS]] — the largest recovery artifact, serves as the trust baseline for porting decisions
- Original source: `IGNORE_OLD_TAURI_BUILD/daemon/.superman/intents/bootstrapped-system-start-original-docs-are-directionally-u/`

#meta #governance #trust #provenance #recovered #preliminary
