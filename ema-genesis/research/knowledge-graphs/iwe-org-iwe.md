---
id: RES-iwe
type: research
layer: research
category: knowledge-graphs
title: "iwe-org/iwe — Rust markdown graph with MCP server, LSP, and CLI for AI agents"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-1
revised_by: research-round-2-c-deep-read
source:
  url: https://github.com/iwe-org/iwe
  stars: 893
  verified: 2026-04-12
  last_activity: 2026-04-07
  license: Apache-2.0
signal_tier: S
tags: [research, knowledge-graphs, signal-S, iwe, mcp, lsp, agent-facing]
connections:
  - { target: "[[research/knowledge-graphs/_MOC]]", relation: references }
  - { target: "[[research/knowledge-graphs/silverbulletmd-silverbullet]]", relation: references }
  - { target: "[[DEC-001]]", relation: references }
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
---

# iwe-org/iwe

> Rust markdown knowledge graph with three binaries: `iwe` (CLI), `iwes` (LSP), `iwec` (MCP). The agent-facing API surface is the cleanest in the space. Round 2-C deep read confirmed the tool surface and inclusion link semantics.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/iwe-org/iwe> |
| Stars | 893 (verified 2026-04-12) |
| Last activity | 2026-04-07 |
| Signal tier | **S** |
| License | Apache-2.0 |
| Language | Rust |

## What it is (R2-C confirmed)

A markdown knowledge graph tool with three binaries that all share the `liwe` crate which parses markdown into an in-memory graph of typed nodes. **No embedded LLM, no database** — the graph is rebuilt from files on startup and kept hot via `notify`-based file watching.

## What to steal (with R2-C surgical detail)

### 1. The MCP server tool surface (`iwec`)

13 tools total, all prefixed `iwe_`:

| Category | Tools |
|---|---|
| **Reading** | `iwe_find`, `iwe_retrieve`, `iwe_tree`, `iwe_stats`, `iwe_squash` |
| **Writing** | `iwe_create`, `iwe_update`, `iwe_delete` |
| **Refactoring** | `iwe_rename`, `iwe_extract`, `iwe_inline`, `iwe_normalize`, `iwe_attach` |

All write tools accept a `dry_run` flag. Plus 3 MCP **prompts** (`explore`, `review`, `refactor`) and 4 MCP **resources** (`iwe://documents/{key}`, `iwe://tree`, `iwe://stats`, `iwe://config`).

EMA's MCP server should have the same shape — explicit prompts + resources, not just tools.

### 2. The retrieve flag set (port verbatim)

```bash
iwe retrieve --key <KEY> [--key <KEY>...]
             --depth <u8=1>          # how many levels of inclusion-link expansion
             --context <u8=1>        # how many parent levels to include
             --links                  # include inline-referenced docs (not just inclusion)
             --exclude <KEY>...       # skip specific keys
             --backlinks              # default TRUE — include incoming refs
             --format <markdown|keys|json=markdown>
             --dry-run
             --no-content
```

`collect_document_keys()` expansion is deterministic:
1. Start with the requested key.
2. If `depth > 0`: add descendants via inclusion-link traversal, limited to `depth`.
3. If `context > 0`: add parents up to `context` levels.
4. If `--links`: add inline-referenced keys at top level only.
5. Dedup + filter excludes.

EMA's `ema context get <slug> --depth 2 --context 1` should return the same shape.

### 3. Inclusion link semantics (the polyhierarchy primitive)

> "When a link appears on its own line, it defines structure."

```markdown
# Photography

[Composition](composition.md)

[Lighting](lighting.md)
```

**Detection is structural, not syntactic** — the markdown parser distinguishes nodes whose only content is a single link from nodes that contain a link inside prose. Parents can have multiple. Children can have multiple parents (polyhierarchy). No frontmatter, no special wikilink form.

EMA's wiki currently uses ad-hoc `[[wikilinks]]`. Adopting iwe's "standalone link = structural parent/child" convention would give polyhierarchy for free.

### 4. Context inheritance — what it actually means

Per R2-C source read: **textual concatenation of parent bodies + section paths**. NOT an LLM call, not a summary.

```typescript
DocumentOutput {
  key: string,
  title: string,
  content: string,
  parent_documents: ParentDocumentInfo[],   // {key, title, section_path}
  child_documents: ChildDocumentInfo[],     // {key, title}
  backlinks: BacklinkInfo[],                // {key, title, section_path}
}
```

The `section_path: string[]` shows which H2/H3 the child lived under in each parent. EMA agents get textual inherited context plus structural pointers.

### 5. LSP server features

`references_provider`, `definition_provider`, `hover_provider`, `completion_provider` (trigger char `"+"`), `workspace_symbol_provider`, `document_symbol_provider`, `formatting_provider`, `rename_provider` (with prepare), `code_action_provider`, `folding_range_provider`, `inlay_hint_provider`, `inline_value_provider`. `TextDocumentSyncKind::FULL` (whole doc on every keystroke; works because rebuild is fast).

EMA could expose its graph to Neovim/VS Code/Zed via the same LSP shape.

## Changes canon

| Doc | Change |
|---|---|
| `vapps/CATALOG.md` Agents | Shared agent context becomes `iwe`-style retrieval API: `retrieve(ref, depth=2, include_parents=true)` returning a squashed context |
| `EMA-GENESIS-PROMPT.md §5` | Typed-edge requirement gains a concrete primitive (inclusion links) |
| `[[DEC-001]]` graph engine | The retrieve API and inclusion link convention are EMA's adopted patterns |

## Gaps surfaced

- EMA's current agent context injection is a flat blob. iwe's `squash` operation proves "context = graph traversal result, not whole-vault dump" is the right abstraction.
- Canon has no concept of "context inheritance" (child inherits parent context).

## Risks (R2-C)

- **Whole-graph in-memory.** Scales to thousands of files; at 100k+ it hurts.
- **No persistence layer** — losing rebuilds after a crash during a large rename.
- Apache-2.0 attribution requirements.

## Open question: depend or port?

iwe is a Rust binary with an MCP server. EMA could either:
- **Depend on it** — bundle the binary, EMA daemon spawns iwec as a subprocess
- **Port it** — re-implement the API surface in TypeScript

The depend path ships faster. The port path keeps the stack TS-only. Decide before Phase 2 of `[[DEC-001]]`.

## Connections

- `[[research/knowledge-graphs/silverbulletmd-silverbullet]]` — alternative pattern
- `[[research/knowledge-graphs/SkepticMystic-breadcrumbs]]` — typed-edge cousin
- `[[research/context-memory/Paul-Kyle-palinode]]` — fact-level addressability cousin
- `[[DEC-001]]` — graph engine decision
- `[[canon/specs/AGENT-RUNTIME]]`

#research #knowledge-graphs #signal-S #iwe #mcp #lsp #agent-facing #round-2-deep-read
