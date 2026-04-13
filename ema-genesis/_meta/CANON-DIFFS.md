---
id: META-CANON-DIFFS
type: meta
layer: _meta
title: "Canon Diffs — proposed updates to existing canon docs from research"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1+2+3
connections:
  - { target: "[[_meta/CANON-STATUS]]", relation: references }
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: references }
  - { target: "[[intents/GAC-QUEUE-MOC]]", relation: references }
---

# Canon Diffs

> Proposed updates to the seven attached canon docs surfaced by Round 1+2+3 cross-pollination research and self-pollination scan. **Each diff requires human review before merging.** Some are locked decisions (`[[DEC-001]]` etc.); some are still GAC cards waiting for answers.

## Already Locked (resolved in canon/decisions/)

These diffs have already been written into canon as locked decisions:

| Diff | Source | Locked in |
|---|---|---|
| Genesis vs V1-SPEC scope | `[[_meta/CANON-STATUS]]` | Q1=B ruling, Genesis canon wins |
| Graph engine TBD → Object Index over markdown + DQL + typed edges | `[[DEC-001]]` | locked |
| CRDT-everywhere → Syncthing for vault + Loro for structured | `[[DEC-002]]` | locked |
| Aspiration detection → empty niche, EMA stakes claim | `[[DEC-003]]` | locked |

## Pending Diffs (require GAC card answers)

These are written below as proposed but need answers to GAC cards GAC-001 through GAC-010 before they can be applied to canon docs.

---

## Diff 1 — `EMA-GENESIS-PROMPT.md`

### §3 Approval Pattern (current)

> When agents want to modify human workspace state:
> ```
> Agent auto-fills suggestion ──▶ Appears in human's vApp ──▶ Human taps [Accept]
>                                                                or [Reject]
>                                                                or [Revise]
> ```

### §3 Approval Pattern (proposed)

Adopt the AutoGPT `PendingHumanReview` schema (5 fields) + Open WebUI's three-mode model:

```
Approval payload {
  payload: SafeJsonData       # the structured proposal
  instructions: string        # human-readable description
  options: ['accept', 'reject', 'revise']   # NOT just two
  editable: boolean           # can user revise inline
  status: 'pending' | 'approved' | 'rejected' | 'allow_always'
  wasEdited: boolean          # audit bit
}
```

Plus the three-mode UX: `[Allow Once] [Allow Always] [Decline]`. Pending state survives client disconnect.

**Sources**: `[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]`, `[[research/agent-orchestration/open-webui-open-webui]]`, `[[research/agent-orchestration/langchain-ai-langgraph]]`

### §5 Graph Wiki (current)

> "**Intentionally left vague.** The graph engine is a major architectural decision that should be made with full context from the Superman project and available open-source options."

### §5 Graph Wiki (proposed)

**Resolved.** See `[[DEC-001]]`. The graph engine is a derived Object Index over markdown using the SilverBullet pattern, with DQL-shape query language and Breadcrumbs-style typed edge declarations. Cozo replaced by TypeDB as the future-DB escape valve. Add §5.1 covering the 4-phase context assembly model from `[[research/context-memory/Paul-Kyle-palinode]]` (corrected to 2 phases per R2-C deep read: Core + Topic).

### §5 LLM-maintained graph (new)

Add a subsection documenting the proposes/executes safety pattern:

> The LLM proposes maintenance operations from a 6-verb DSL (`KEEP`, `UPDATE`, `MERGE`, `SUPERSEDE`, `ARCHIVE`, `RETRACT`). A deterministic executor validates and applies. Every consolidation is a git commit. The LLM never writes files directly.

**Sources**: `[[research/context-memory/Paul-Kyle-palinode]]`

### §9 P2P (current)

Currently treats CRDT as the universal sync mechanism. Says spaces nest as org > team > project with permission cascade.

### §9 P2P (proposed)

- Adopt `[[DEC-002]]` sync split: Syncthing for vault folders, Loro for structured data.
- Add HALO/ECHO/MESH layer split as future architecture target (`[[research/p2p-crdt/dxos-dxos]]`).
- Adopt the Jazz four-role model (Owner/Admin/Writer/Reader/WriteOnly) for membership. WriteOnly is the answer to "invisible peer."
- Soften nested-space claim per `[[intents/GAC-007/README\|GAC-007]]` — defer until real multi-user data justifies the complexity.

---

## Diff 2 — `SCHEMATIC-v0.md`

### Layer Stack (current)

Five layers: Wiki / Canon / Intents / Research / Context Graph Engine.

### Layer Stack (proposed)

Same five layers, but the "Context Graph Engine" gets renamed to "Object Index" per `[[DEC-001]]`. Add `[[DEC-001]]` and `[[DEC-002]]` as references.

### Entity Model (current)

Currently lists Space → Nodes, Space → Members, Space → org/team/project nesting.

### Entity Model (proposed)

- Soften the nesting claim per GAC-007.
- Add `Identity` as a separate entity (HALO model) per GAC-008.
- Add typed-edge grammar reference per GAC-005.

---

## Diff 3 — `canon/specs/EMA-V1-SPEC.md`

### Header (current)

> "Rewritten 2026-04-11. This document supersedes all prior extractions."

### Header (proposed) — softened

> "Rewritten 2026-04-11. This document defines the **Phase 1 contract** within the Genesis maximalist vision. Per `[[_meta/CANON-STATUS]]` ruling, the Genesis vision is canon; this V1-SPEC defines the minimum viable slice that ships first."

The "supersedes all prior extractions" claim is what triggered the user's Q1 question. Per Q1=B (Genesis wins), V1-SPEC becomes the Phase 1 contract, not a competing reduction.

### §9 Core Library API (current)

`assembleContext(intentId): ContextWindow` — single function, single context window.

### §9 Core Library API (proposed)

```typescript
assembleContext(intentId): {
  core: Memory[],       // always-pinned facts (~2k tokens per palinode)
  topic: Memory[],      // search results from current intent (~2k tokens)
  // total budget configurable, default 80k
}
```

Per `[[research/context-memory/Paul-Kyle-palinode]]` (corrected to 2-phase), `[[research/context-memory/letta-ai-letta]]` (3-tier alternative), `[[research/context-memory/BerriAI-litellm]]` (per-source budgets).

### §11 Open Questions

Several questions are now resolved:

| # | Question | Resolution |
|---|---|---|
| 4 | Frontmatter parser? | gray-matter (per `[[DEC-001]]`) |
| 5 | CLI framework? | oclif (per `[[research/cli-terminal/oclif-oclif]]`) |
| 6 | Context window budget? | 2-phase Core+Topic per `[[DEC-001]]` |

---

## Diff 4 — `canon/specs/AGENT-RUNTIME.md`

Major additions per Round 1+2 research:

### New sections

1. **Rendering Pipeline** (per `[[research/cli-terminal/Ark0N-Codeman]]`) — the 6-layer PTY → 16ms batch → SSE → xterm.js stack
2. **Session Recovery** (per Codeman) — ghost session discovery on daemon boot, environment-tagged sessions
3. **Agent State Machine** (per `[[research/agent-orchestration/Dicklesworthstone-claude_code_agent_farm]]`) — the 7-state model with heartbeat polling
4. **Concurrent Agent Coordination** (per agent_farm) — JSON file lock pattern for vault edits
5. **Workflow Resumability** (per `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]`) — step_checkpoints schema + 3-phase recovery protocol
6. **Session Ingest** (per `[[research/agent-orchestration/Dicklesworthstone-coding_agent_session_search]]`) — 11-provider discovery table

### Existing sections to update

- "Wrapping Specific Agents" — expand from 3 (Claude/Codex/Cursor) to 23 (per `[[research/agent-orchestration/generalaction-emdash]]`'s adapter list)
- "Cross-Machine Dispatch" — replace handwave with concrete protocol per GAC-001
- "Key Technologies" — add `node-pty`, `xterm.js`, `tmux`, `ssh2`, `bull-mq` (or `worker_threads`) as the named TypeScript stack

---

## Diff 5 — `canon/specs/BLUEPRINT-PLANNER.md`

### GAC Card schema (current)

Has `options[A][B][C][D] + 1/2 (defer/skip)`. Good.

### GAC Card schema (proposed)

Adopt AutoGPT's PendingHumanReview augmentation:
- Add `editable: boolean` field
- Add `instructions: string` field separate from question
- Add `wasEdited: boolean` audit bit on the answer

Per `[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]`.

### Aspirations Log (current)

Auto-detects from user text. Per-vApp source attribution. Confidence scores.

### Aspirations Log (proposed)

Adopt:
- GBNF grammar-constrained extraction per `[[research/life-os-adhd/vortext-esther]]`
- Confidence-threshold UX per `[[research/life-os-adhd/ErnieAtLYD-retrospect-ai]]`
- PendingHumanReview queue per `[[research/agent-orchestration/Significant-Gravitas-AutoGPT]]`
- Empty-niche claim per `[[DEC-003]]`

### New section: Decisions as Data

Per `[[research/self-building/loomio-loomio]]`. Killed proposals capture rationale + dissent_notes + reversal_conditions in a Decision schema. Add `Decision` as a 7th canonical entity type or a Canon doc subtype.

### New section: STATE.md per project

Per `[[research/self-building/gsd-build-get-shit-done]]`. Each project gets a STATE.md tracking decisions + blockers + progress. Mandatory.

### New section: Confidence Gate

Per `[[research/life-os-adhd/adrianwedd-ADHDo]]`. Proposals pause for user confirmation when LLM confidence is below threshold. Required before dispatch for `kind: implement` proposals.

---

## Diff 6 — `vapps/CATALOG.md`

### vApp 2 Tasks/To-Do

Add `started_at: timestamp?` field per `[[research/life-os-adhd/JackReis-neurodivergent-visual-org]]` (initiation celebration).
Add `guessed_by: actor_id?` per `[[research/agent-orchestration/sakowicz-actual-ai]]` (post-hoc audit).
Add `drift_score: number?` per `[[research/life-os-adhd/Kodaxadev-Task-Anchor-MCP]]`.

### vApp 5 Brain Dumps

Add `reviewMessage: string?` per AutoGPT pattern.
Split `description` (prose) + `payload` (structured) per `[[research/agent-orchestration/ai_automation_suggester]]`.

### vApp 12 Journal

Replace passive git-scrape with conversational elicitation per `[[research/life-os-adhd/ravila4-claude-adhd-skills]]`.
Add `extracted_aspirations: AspirationRef[]?` per `[[DEC-003]]`.

### vApp 14 Wiki Viewer

Reference Quartz (research layer) and MkDocs Material (canon layer) as the publish renderers.
Add DQL query bar per `[[research/knowledge-graphs/blacksmithgu-obsidian-dataview]]`.

### vApp 23 Agent Live View

Add the Codeman 6-layer streaming pipeline as the canonical rendering implementation.
Add ghost session discovery for daemon-restart recovery.
Embed `[[research/cli-terminal/asciinema-asciinema-player]]` for replay mode.

### Add `vapp.json` manifest schema

Per `[[research/vapp-plugin/siyuan-note-siyuan]]`. With `runtimes: ['electron-desktop', 'web', 'mobile']` for Launchpad filtering.

---

## Diff 7 — `CLAUDE.md` (already done)

Already replaced 2026-04-12 per Q5=A. Project CLAUDE.md now points at `ema-genesis/` as the sole canon source. Tauri references stripped.

---

## Application order

1. **Already-locked decisions** (`[[DEC-001]]`, `[[DEC-002]]`, `[[DEC-003]]`, `[[_meta/CANON-STATUS]]`) — no review needed, already canon
2. **GAC-resolved diffs** — apply only after the relevant GAC card is answered
3. **Surface-level updates** (vApp catalog field additions, schema augmentations) — apply after `[[_meta/SELF-POLLINATION-FINDINGS]]` is reviewed
4. **V1-SPEC header softening** — quick edit, low-risk
5. **AGENT-RUNTIME major additions** — biggest doc churn, do after most GACs are answered

## Connections

- `[[_meta/CANON-STATUS]]` — the Q1=B ruling that made these diffs valid
- `[[_meta/SELF-POLLINATION-FINDINGS]]` — the porting inventory
- `[[research/_moc/RESEARCH-MOC]]` — the source of all the patterns
- `[[intents/GAC-QUEUE-MOC]]` — the questions blocking some diffs

#meta #canon-diffs #review-required
