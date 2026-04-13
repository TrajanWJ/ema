# EMA — Executive Management Assistant

> **Canon source of truth lives at `ema-genesis/`.** Read `ema-genesis/EMA-GENESIS-PROMPT.md` first, then `ema-genesis/SCHEMATIC-v0.md`, then `ema-genesis/_meta/CANON-STATUS.md` for the current ruling on doc precedence. Everything else flows from there.

## What EMA Is

A personal AI desktop app: an autonomous thinking companion + life OS. Open-source, self-hosted, P2P collaborative intelligence environment for humans and AI agents. The full description lives in `ema-genesis/EMA-GENESIS-PROMPT.md`.

## Current Stack

**TypeScript / Electron monorepo (in progress, bootstrap v0.1).** Workspaces:

- `apps/` — Electron desktop host + renderer
- `services/` — local HTTP + WebSocket compatibility backend
- `workers/` — background watchers and job runtime
- `cli/` — TypeScript CLI (`ema <noun> <verb>`)
- `shared/` — shared contracts, schemas, types
- `tools/` — contract extraction and parity tooling
- `hq-api/` and `hq-frontend/` — HQ subsystem (separate scope)
- `ema-genesis/` — **canon graph (Obsidian-style markdown wiki). Read first.**
- `IGNORE_OLD_TAURI_BUILD/` — archived Elixir + Tauri build, reference only

## Canon Layout

```
ema-genesis/                       ← Canon. Read this first.
├── EMA-GENESIS-PROMPT.md          Master spec / node zero
├── SCHEMATIC-v0.md                Architecture overview
├── CLAUDE.md                      Agent instructions for working in ema-genesis
├── _meta/
│   ├── CANON-STATUS.md            Ruling on doc precedence
│   ├── CANON-DIFFS.md             Proposed updates to canon docs
│   ├── SELF-POLLINATION-FINDINGS.md   Module-by-module port inventory from old build
│   └── CROSS-POLLINATION-REGISTRY.md  Flat ranked source list (also in vault)
├── canon/
│   ├── specs/                     Deep-dive specs (V1-SPEC, AGENT-RUNTIME, BLUEPRINT-PLANNER)
│   └── decisions/                 Locked architectural decisions (DEC-NNN)
├── intents/                       Open work items + GAC cards
├── proposals/                     Plans awaiting approval
├── executions/                    Completed work records
├── schemas/                       Entity schemas (YAML)
├── vapps/CATALOG.md               vApp catalog (35 apps)
└── research/                      Cross-pollination layer (Obsidian-style)
    ├── _moc/RESEARCH-MOC.md       Master index
    ├── agent-orchestration/
    ├── p2p-crdt/
    ├── knowledge-graphs/
    ├── cli-terminal/
    ├── vapp-plugin/
    ├── context-memory/
    ├── research-ingestion/
    ├── life-os-adhd/
    └── self-building/
```

## Old Build (Reference Only)

The previous Elixir/Phoenix daemon + Tauri 2 + React frontend has been archived under `IGNORE_OLD_TAURI_BUILD/` with its own README explaining what's there and how to mine it for reimplementation. **Do not run it.** Use it as a spec corpus for porting.

See `ema-genesis/_meta/SELF-POLLINATION-FINDINGS.md` for the concrete module-by-module survival list — what ports cleanly to TypeScript, what gets replaced by external repos surfaced in research, and what gets dropped entirely.

## Rules

- **Canon docs are authoritative.** If they conflict with the old code, canon wins.
- **Old code is reference.** Extract patterns, don't copy code. Port data models and architecture decisions to TypeScript.
- **Don't modify `ema-genesis/canon/specs/` or `ema-genesis/canon/decisions/`** without an approved GAC card + proposal in `ema-genesis/intents/`.
- **Research nodes** under `ema-genesis/research/` are append-only — new sources get new files; existing nodes get updated, not deleted.
- **Workspace state** lives outside the canon graph. Never put workspace UI state in `ema-genesis/`.
- **No Tauri references.** The stack is Electron + TypeScript end to end. Anything that says Tauri is either historical (archived) or wrong.

## Quick Start for Agents

1. Read `ema-genesis/EMA-GENESIS-PROMPT.md` (the master spec)
2. Read `ema-genesis/_meta/CANON-STATUS.md` (current ruling on Genesis vs V1-SPEC scope)
3. Read `ema-genesis/_meta/SELF-POLLINATION-FINDINGS.md` (porting inventory)
4. Read `ema-genesis/canon/decisions/` (locked architectural decisions)
5. Check `ema-genesis/intents/` for open work + GAC cards
6. Check `ema-genesis/proposals/` before duplicating
7. Use `ema-genesis/CLAUDE.md` for the in-canon agent instructions

## Git Conventions

Conventional commits: `feat|fix|refactor|docs|test|chore: description`

Branch names: `type/description`

## Build & Dev Commands

The verified commands are now:

- `pnpm install`
- `pnpm build`
- `pnpm test`
- `pnpm dev`

`ema-genesis/` remains the canon source of truth, but the Electron/TypeScript runtime is no longer purely aspirational.

## Verified Entry Points

When you need the current post-audit system reality, start here after reading the canon:

1. `docs/backend/README.md`
2. `docs/backend/SOURCE-OF-TRUTH.md`
3. `docs/backend/DEDUPLICATION-DECISIONS.md`
4. `docs/backend/ENTITY-CONTRACTS.md`
5. `services/core/backend/manifest.ts`
6. `services/core/intents/service.ts`
7. `services/core/executions/executions.service.ts`
