---
id: DEC-007
type: canon
subtype: decision
layer: canon
title: "Unified Intents schema + Three Truths model (Semantic / Operational / Knowledge)"
status: active
upgraded_at: 2026-04-13
upgraded_from: preliminary
upgraded_reason: "Referenced as foundational by EMA-V1-SPEC, SELF-POLLINATION, EXECUTION-SYSTEM, and 3+ recovered intents without contradictions. Meets DOC-TRUST-HIERARCHY upgrade threshold (3+ canon-level references)."
created: 2026-04-12
updated: 2026-04-13
decided_at: 2026-04-06
author: recovery-agent
recovered_from: "~/.local/share/ema/vault/wiki/User/Stack-Decisions.md"
recovered_at: 2026-04-12
decided_by: human
renumbered_from: DEC-004
renumbered_at: 2026-04-12
renumbered_reason: "ID collision with DEC-004-gac-card-backend. This decision keeps its content verbatim; only the identifier moved."
supersedes:
  - "Fragmented IntentMap / IntentNode / HarvestedIntents surfaces (old build)"
connections:
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
  - { target: "[[canon/decisions/DEC-001-graph-engine]]", relation: references }
  - { target: "[[canon/decisions/DEC-004-gac-card-backend]]", relation: related }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
  - { target: "[[intents/INT-RECOVERY-WAVE-1]]", relation: references }
tags: [decision, canon, intents, schema, three-truths, recovered, preliminary]
---

# DEC-007 — Unified Intents Schema and Three Truths Model

> **Status:** Preliminary. Originally decided 2026-04-06 in a brainstorm session captured in the old EMA wiki at `User/Stack-Decisions.md`. Recovered into canon 2026-04-12 as DEC-004. **Renumbered to DEC-007 on 2026-04-12** to resolve a same-session ID collision with `DEC-004-gac-card-backend.md`. The two decisions are both real; only the numbering moved.

## The Decision

EMA's knowledge and work representation is **three orthogonal truth domains**, each with its own schema, connected by explicit bridges — not a single monolithic graph.

### The three truth domains

1. **Semantic truth** — *what the user cares about and how it's structured*
   - Schema: `intents` + `intent_links` + `intent_events`
   - Replaces: fragmented IntentMap / IntentNode / HarvestedIntents surfaces from the old build
   - Answers: "what are all intents for this project?" in a single query
   - Hierarchy: 6-level L0..L5 (project → goal → subgoal → task → step → action, approximately)

2. **Operational truth** — *what actually got done or is getting done*
   - Schemas: `executions`, `tasks`, `proposals`, `sessions`, `goals`
   - Already existed across multiple tables in the old build; this decision doesn't restructure those — it draws a clear boundary around them
   - Answers: "what's running right now? what finished? what's queued?"

3. **Knowledge truth** — *what the user and system know*
   - Schemas: wiki / vault / docs (plain markdown, FTS5-indexed)
   - Layer is append-only at the document level; revisions are a property of individual files
   - Answers: "what do I know about X?" via full-text and semantic search

### The three bridges

These are the explicit glue between the three truth domains. The decision includes what the bridges are — not just that bridges exist.

1. **Semantic → Operational:** `intent_links` table — maps semantic intent IDs to operational execution/task/proposal IDs. Bidirectional lookup supported. Many-to-many.
2. **Semantic → Knowledge:** context assembly — at query time, pull relevant knowledge docs for a given intent via embedding similarity and wikilinks, assemble into a context window. No persistent join table; the assembly is computed per query.
3. **Operational → Knowledge (as derivative):** *projections* — each operational record can optionally project into the knowledge layer as a markdown doc (e.g., a completed execution becomes a `wiki/executions/EXE-NNN.md` archive). Projections are write-through, not queried for truth.

## Why (the rationale from the original decision)

The old build had **IntentMap, IntentNode, and HarvestedIntents** — three different surfaces that all tried to represent "what the user intends." Each had its own schema. None of them could answer "what are all intents for this project?" without joining across three tables or walking code. The core pain: there was no single source of truth for semantic intent.

The unified `intents` table + `intent_links` + `intent_events` collapses the three into one. You query one table. Links are explicit. History is event-sourced.

The Three Truths framing was the decision's second act: *once you have unified intents, what are the other truth domains and how do they relate?* The answer was that operational state (executions, tasks, proposals, sessions, goals) is a fundamentally different kind of fact than semantic intent, and knowledge (vault, wiki, docs) is a third kind. Trying to unify them into one graph creates the same mess the IntentMap fragmentation did. So: keep them separate, draw explicit bridges, make the bridges first-class schema.

## Consequences

- **Intent Engine becomes a first-class subsystem.** Not just a database table — it owns the semantic truth domain and has its own module in the daemon (`Ema.Intents` in the old build). Captured in [[_meta/SELF-POLLINATION-FINDINGS]] TIER PORT priority #1.
- **The knowledge layer is primary, not secondary.** "Wiki as primary knowledge surface (plain markdown, always available, editable by humans and SystemBrain) over CodeGraphContext (FalkorDB requirement)" was the explicit sub-decision. Plain markdown beats a graph database for the knowledge layer. Complements [[canon/decisions/DEC-001-graph-engine]] (derived Object Index over markdown folder).
- **No "unified everything" surface.** There is no single vApp that shows semantic + operational + knowledge merged. The Blueprint vApp (catalog #18) is the closest — it assembles context across all three for the user's current planning session — but it is an assembly, not a table.
- **Projections are write-through, not authoritative.** If operational state and its knowledge projection disagree, operational wins. The projection is a derivative.

## Gaps / open questions

- **intent_events schema not fully specified in the recovered source.** The old build has the table; the exact event shape (what fields, what types) is in the Elixir migrations, not in the wiki prose. Should be extracted in a follow-up recovery pass.
- **6-level hierarchy L0..L5** — the levels are named but not rigorously defined. What makes something an L2 vs an L3? This is a followup intent.
- **Context assembly performance** — pulling "relevant knowledge docs" per intent query at scale is a real cost. Caching strategy, embedding store, latency budget all unspecified.
- **Projection conflict resolution** — if a projection lives in the knowledge layer and a human edits it, does operational truth win on next projection (overwrite) or does the projection branch? Needs a rule.
- **Relation to [[canon/decisions/DEC-001-graph-engine]]** — DEC-001 says the graph engine is a derived Object Index over markdown. DEC-007 says knowledge truth lives in markdown. These are consistent but the combined model needs one doc to reference rather than two.

## Related

- [[canon/specs/EMA-V1-SPEC]] — §3 storage boundary
- [[canon/decisions/DEC-001-graph-engine]] — graph engine = Object Index over markdown
- [[canon/decisions/DEC-004-gac-card-backend]] — the decision that kept the DEC-004 ID
- [[_meta/SELF-POLLINATION-FINDINGS]] — §A TIER PORT priority #1 (Ema.Intents)
- [[intents/INT-RECOVERY-WAVE-1]] — Recovery Wave 1 references this decision
- Original source: `~/.local/share/ema/vault/wiki/User/Stack-Decisions.md`

#decision #canon #intents #schema #three-truths #recovered #preliminary
