---
id: RES-palinode
type: research
layer: research
category: context-memory
title: "Paul-Kyle/palinode — KEEP/UPDATE/MERGE/SUPERSEDE/ARCHIVE/RETRACT DSL for LLM-maintained markdown memory"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
revised_by: research-round-2-c-deep-read
source:
  url: https://github.com/Paul-Kyle/palinode
  stars: 18
  verified: 2026-04-12
  last_activity: 2026-04-12
  license: NONE_FOUND
signal_tier: S
tags: [research, context-memory, llm-maintained, dsl, sleeper-hit, palinode, no-license]
connections:
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: references }
  - { target: "[[research/context-memory/_MOC]]", relation: references }
  - { target: "[[canon/specs/EMA-GENESIS-PROMPT]]", relation: references }
  - { target: "[[canon/specs/EMA-V1-SPEC]]", relation: references }
  - { target: "[[research/context-memory/thedotmack-claude-mem]]", relation: references }
  - { target: "[[research/context-memory/aiming-lab-SimpleMem]]", relation: references }
  - { target: "[[DEC-001]]", relation: references }
---

# Paul-Kyle/palinode

> **Sleeper hit** corrected after Round 2-C deep read of source code. 18 stars. Conceptually the highest-value find in Round 1 cross-pollination, with several README claims that don't match the actual implementation.

## ⚠️ Source-vs-marketing corrections

The README's framing is partly aspirational. Round 2-C deep read of the source corrected three claims:

| Claim | Reality |
|---|---|
| ~~"5 operations: KEEP/UPDATE/MERGE/SUPERSEDE/ARCHIVE"~~ | **6 operations** — adds `RETRACT` (tombstone with reason, visible in file) |
| ~~"4-phase context injection (Core/Topic/Associative/Triggered)"~~ | **2-phase** in `specs/prompts/context-assembly.md` — Core + Topic only. Each ~2048 tokens. No "Associative" or "Triggered" exists in source. |
| (implicit MIT license) | **NO LICENSE FILE.** Cannot port code verbatim. Patterns OK, code copy NOT OK. |

The `triggers` table exists in the SQLite schema but is **dead code** — never wired into the consolidation runner. Skip it when porting.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/Paul-Kyle/palinode> |
| Stars | 18 (verified 2026-04-12) |
| Last activity | 2026-04-12 (active daily) |
| Verified | 2026-04-12 |
| Signal tier | **S** |
| Category | LLM-maintained markdown memory |
| License | **NONE FOUND** — cannot copy code without explicit permission |
| Language | Python |
| Storage | SQLite + sqlite-vec + FTS5 |

## What it is

Markdown-native agent memory system. Files on disk are source of truth. A SQLite-vec + FTS5 index is derived from them. A weekly (plus write-time, per ADR-004) LLM-driven consolidator proposes structured ops — **KEEP / UPDATE / MERGE / SUPERSEDE / ARCHIVE / RETRACT** — that a deterministic executor applies. MCP / REST / CLI / plugin are all frontends to the same REST API. Every consolidation pass commits to git.

The system is small (~few thousand LOC of Python) and the maintainer is active. Most of EMA's "live LLM maintains the graph" canon claims have working implementations here, just not always the ones the README markets.

## What to steal for EMA

### 1. The 6-verb DSL — operational vocabulary

| Verb | Shape (JSON) | Meaning |
|---|---|---|
| `KEEP` | `{"op": "KEEP", "id": "fact_id"}` | Default. Most facts in a healthy vault are KEEP. |
| `UPDATE` | `{"op": "UPDATE", "id": "fact_id", "new_text": "...", "rationale": "..."}` | Replace fact body in place; preserve slug. |
| `MERGE` | `{"op": "MERGE", "ids": [...], "new_text": "...", "rationale": "..."}` | Combine N facts into one; first ID becomes the merged ID, others deleted. |
| `SUPERSEDE` | `{"op": "SUPERSEDE", "id": "old_id", "new_text": "...", "reason": "..."}` | Mark old fact deprecated; create new one; link via `superseded_by`. |
| `ARCHIVE` | `{"op": "ARCHIVE", "id": "fact_id", "rationale": "..."}` | Move out of active layer; keep in archive folder. |
| `RETRACT` | `{"op": "RETRACT", "id": "fact_id", "reason": "..."}` | Tombstone visible in file with the reason. |

EMA should adopt this 6-verb vocabulary as the **`ema graph maintenance`** command surface. Both human-invoked and LLM-invoked operations use the same DSL.

### 2. Proposes/executes split — the safety boundary

Critical insight: **the LLM proposes, a deterministic executor applies**. The LLM never writes files directly. Pattern:

```
1. EMA bundles current state of N facts into a "consolidation prompt"
2. LLM returns a JSON list of operations
3. Deterministic executor validates each op against the schema
4. Executor applies validated ops
5. If any op fails validation, the entire pass aborts atomically
6. Commit message captures the LLM's reasoning + the op list
```

Validator catches LLM hallucinations (SUPERSEDE for non-existent fact, MERGE losing information). Without this, agent edits become impossible to audit or revert.

**Caveat from source:** Palinode itself does NOT enforce concurrency — `apply_operations()` reads/mutates/writes a file with no lock. Two concurrent calls = lost update. EMA's port must add a file lock or Ecto-style optimistic concurrency check.

### 3. Inline fact anchors — addressability without a DB row

Palinode marks facts with HTML comment markers in markdown:

```markdown
- A fact about Loro CRDTs <!-- fact:arch-notes-a3f2b1 -->
- Another fact about Syncthing <!-- fact:arch-notes-7c8e2d -->
```

The comment is invisible at render time. Slug = `{file_slug}-{md5(line_text)[:6]}` — deterministic. Same text in same file gets same ID.

**Constraints from source:**
- Detection is **line-level regex on raw file content**, NOT a markdown AST walk
- Only single-line list items (`-` or `*` bullets) get tagged
- A fact CANNOT span multiple paragraphs — one fact = one list item
- Bootstrap only scans `people`, `projects`, `decisions`, `insights` folders; daily notes are excluded

EMA can either copy the constraint (line-level facts only) or extend it (AST-walk facts of any block type). The line-level approach is simpler and handles 90% of cases.

### 4. Two-phase context assembly — actual budgets

Per `specs/prompts/context-assembly.md`:

| Phase | Trigger | Budget | Selection |
|---|---|---|---|
| **Core** | Always (loaded before first user message) | `coreMemoryBudget` default **2048 tokens** | All files with `core: true` in frontmatter. Fixed load order: user profile → active projects → standing decisions → key people. |
| **Topic** | After first user message | `topicMemoryBudget` default **2048 tokens** | Hybrid score: `vector_similarity × 0.5 + recency × 0.3 + importance × 0.2`. Filters exclude `archived`/`superseded`. |

**Cold start:** inject Phase 1 only + one-liner "No topic context loaded yet."

**Overflow rules:**
- Core: cut oldest non-decision first; never cut user profile; never cut active project status
- Topic: keep highest-scored per group; min 1 per group if matched; truncate long items to first 200 tokens with `[...see full file]` pointer

**The README's "4 phases" claim is not in source.** EMA's `assembleContext` design should follow the actual 2-phase model with explicit overflow rules, not the marketing claim.

### 5. Git as audit trail — single trunk

```python
subprocess.run(["git","add","*.md","**/*.md"], cwd=memory_dir)
subprocess.run(["git","commit","-m",message], cwd=memory_dir)
```

- Single trunk commits, no branches per pass
- Commit message: `"palinode: compaction {YYYY-MM-DD} — ..."` or `"palinode: nightly {YYYY-MM-DD} — ..."`
- Concurrent commits: git rejects; Python doesn't catch — ports MUST add a lock
- Gated on `config.git.auto_commit`

EMA should commit `ema-genesis/` and the eventual vault the same way: every maintenance pass is a commit, every manual edit is a commit.

### 6. `json_repair` fallback

LLM output parsing is deliberately permissive: regex `\[[\s\S]*\]` grabs the first JSON array, falls back to `json_repair.repair_json()` on malformed output, filters to entries that are dicts containing `"op"`. Save this pattern — every LLM-driven structured-output system needs it.

## What it changes about the blueprint

| Canon doc | What changes |
|---|---|
| `EMA-GENESIS-PROMPT.md §5 Graph Wiki` | "LLM-maintained for health and compaction" gets the 6-verb vocabulary + proposes/executes safety pattern |
| `EMA-V1-SPEC.md §9 assembleContext` | Single-function flat retrieval becomes **two-phase concurrent injection** (Core + Topic), each with explicit budgets and overflow rules |
| `[[canon/specs/BLUEPRINT-PLANNER]]` | The Blueprint vApp gains a "consolidation pass" view — see queued maintenance ops, approve/edit before commit |
| `[[DEC-001]]` (graph engine) | The Object Index gains fact-level addressability via inline `<!-- fact:slug -->` anchors as a primitive |
| New decision needed: `DEC-XXX-graph-maintenance-loop` | The 6-verb DSL + executor pattern + 2-phase context assembly become a locked decision |

## Gaps it surfaces

1. **EMA canon has no "fact" primitive.** Genesis treats wiki pages as the unit of knowledge. Palinode proves the unit should be smaller — facts within pages.
2. **EMA's `assembleContext` budgets nothing.** V1-SPEC says "include intent + direct connections + 1-hop canon nodes, truncate to 80k." That's a single pool with one truncation rule. Palinode shows it should be Core + Topic with explicit overflow rules.
3. **EMA has no "consolidation prompt" template.** The LLM is supposed to maintain the graph but there's no canonical prompt. Palinode's prompt template (in `specs/prompts/compaction.md`) is the first reference.
4. **EMA has no executor / validator layer.** Currently agent edits go through tools that write files directly. Palinode's safety model says the LLM should propose ops and a validator should apply them.
5. **Concurrency not solved.** Palinode itself doesn't enforce locks. EMA's port MUST add file locks or optimistic concurrency.

## Notes & risks

- **NO LICENSE FILE.** 18 stars, Python, solo project. Marketing materials say "MIT" in places but the repo has none. **Copy the ideas, write them fresh in TypeScript. Do not port code verbatim without asking the author.**
- **The `triggers` table exists but is dead code.** Schema includes a `triggers` virtual table with `triggers_vec`, but no consolidation runner code wires it. Skip it.
- **Regex-based fact parsing is fragile.** A list item containing `<!-- fact:` inside a code span would break. Cannot handle multi-line facts at all.
- **No concurrency protection in apply_operations.** EMA's port must add a file lock or Ecto optimistic version. This is the biggest porting risk.
- **BGE-M3 (1024-dim) + sqlite-vec dependency.** Python ecosystem. EMA is moving to TypeScript; this is an extra service or a re-implementation.
- **4-tier ADR architecture is mostly aspirational.** ADRs 005/006/007/008 describe a ladder of consolidation tiers; only ADR-004 (write-time contradiction check) is partially wired. Don't build EMA on features that don't yet exist in palinode source.

## Round 2-C deep read corrections (what changed in this node since Round 1)

| What changed | From | To |
|---|---|---|
| Op count | 5 verbs | **6 verbs** (added RETRACT) |
| Context phases | 4 (Core/Topic/Associative/Triggered) | **2 (Core + Topic only)** |
| Phase budgets | ~10k/30k/20k/10k | **~2048 each** |
| License | (assumed permissive) | **NONE FOUND — flag it** |
| Triggers table | "trigger logic" mentioned | **Dead code; skip** |
| Fact parsing | "AST walk or regex" | **Line-level regex only; single-line list items only** |
| Concurrency | (not mentioned) | **No locking; port must add it** |

## Connections

- `[[research/_moc/RESEARCH-MOC]]` — research layer index
- `[[research/context-memory/_MOC]]` — context memory category index
- `[[research/context-memory/thedotmack-claude-mem]]` — staged retrieval cousin (48k stars, more mature, less elegant)
- `[[research/context-memory/aiming-lab-SimpleMem]]` — decay/merge/prune vocabulary cousin
- `[[research/context-memory/getzep-graphiti]]` — temporal validity cousin
- `[[research/context-memory/letta-ai-letta]]` — OS-memory-hierarchy cousin (Core/Recall/Archival ≈ Palinode's Core + Topic + Archive)
- `[[research/knowledge-graphs/silverbulletmd-silverbullet]]` — Object Index cousin (different layer of the same problem)
- `[[canon/specs/EMA-GENESIS-PROMPT]]` §5 graph wiki
- `[[canon/specs/EMA-V1-SPEC]]` §9 assembleContext
- `[[canon/specs/BLUEPRINT-PLANNER]]` — Blueprint vApp consolidation pass UI
- `[[DEC-001]]` — graph engine decision

#research #context-memory #signal-S #palinode #llm-maintained #dsl #sleeper-hit #no-license #round-2-corrected
