# IGNORE_OLD_TAURI_BUILD

**Status:** Archived 2026-04-12. Do not modify. Reference only.

This folder contains the previous EMA build: an **Elixir/Phoenix daemon + Tauri 2 + React** desktop app. EMA is being rebuilt as a **TypeScript / Electron monorepo** in the parent directory (`apps/`, `services/`, `workers/`, `cli/`, `shared/`, `hq-api/`, `hq-frontend/`).

## What's inside

| Path | What it was | Reimplementation value |
|------|-------------|------------------------|
| `daemon/` | Elixir/Phoenix 1.8 daemon. OTP supervision trees, REST API, Phoenix Channels, Ecto/SQLite, ~50 contexts (BrainDump, Tasks, Projects, Proposals, Habits, Journal, Agents, Pipes, SecondBrain, Responsibilities, Canvas, ClaudeSessions, Actors, Intents, etc.) | **High.** Schema design, business logic boundaries, supervision tree shape, proposal pipeline (Generator → Refiner → Debater → Tagger), pipes system (22 triggers + 15 actions), actor/agent bridge model. Port these one context at a time into the TS services layer. |
| `app/` | Tauri 2 + React 19 + Zustand frontend. 52+ vApps, 67+ stores, glass-morphism CSS design system, per-app windows, Launchpad, Dock, AmbientStrip. | **Medium.** UX patterns, app inventory, store organization, CSS tokens. The component code itself is Tauri-coupled and won't port directly to Electron without rework. |
| `src-tauri/` | Rust shell: window management, tray icon, capabilities, icons. | **Low.** Replaced wholesale by Electron's main process. Keep for icon assets and capability/permission inventory. |
| `src/` | Frontend source mirror (subset). | Reference only. |
| `docs/` | Old planning docs, specs, plans, superpowers artifacts. | **Medium.** Architecture decisions, spec history, design rationale. |

## Why it was archived

The Elixir+Tauri+Rust stack was producing more maintenance friction than throughput for a single-developer project:

- Three languages (Elixir, Rust, TS) → triple the toolchain and triple the context-switch tax
- Tauri's Linux story (autostart, IPC, window chrome) burned more time than it saved
- Phoenix Channels + REST + Zustand bridges duplicated the same data three times
- Hard to leverage the wider Node/TS AI tooling ecosystem (MCP servers, agent SDKs, sync libs)

The pivot to **Electron + TypeScript end-to-end** is a deliberate consolidation: one language, one runtime, one IPC pattern, one ecosystem. The archive exists so that the *ideas* (schemas, business logic, supervision patterns, proposal pipeline) can be ported without re-deriving them.

## How to use this archive

1. **Don't run it.** Dependencies are stale. The `_build/`, `deps/`, `node_modules/`, `dist/` directories are kept for grep, not execution.
2. **Treat it as a spec corpus.** When implementing a feature in the new stack, search this folder first for the prior implementation, the schema, and the test cases.
3. **Port one context at a time.** The Elixir contexts in `daemon/lib/ema/` are the cleanest reference. Each is roughly: schema + context module + controller + channel. Map them to: `shared/schemas/` + `services/<context>/` + `apps/electron` IPC handlers.
4. **Don't promote the glass-morphism CSS as-is.** It's a design language tied to Tauri's frameless window model. Re-derive it for Electron with current best-practice CSS.
5. **Mine the proposal pipeline.** The Generator → Refiner → Debater → Tagger PubSub flow is the most novel piece in the archive. Keep its shape; rewrite its substrate.

## What also lives here

- `erl_crash.dump` — Elixir VM crash artifact. Kept as historical evidence; safe to delete.
- `ema-daemon.env` — daemon environment file (no secrets — verify before deleting).
- `TAURI-AUTO-START-FIX.md` — investigation notes on Tauri autostart on Linux. Reference for "things that were painful in the old stack."

## Related parent-repo files that still describe the old stack

- `/CLAUDE.md` — has a deprecation banner; full architecture description is for the **archived** stack, not the current Electron build. Rewrite when the new stack stabilizes.
- `~/.local/share/ema/vault/wiki/Architecture/*.md` — many wiki pages still describe Elixir contexts and Tauri windows. Update incrementally as features are reimplemented.
