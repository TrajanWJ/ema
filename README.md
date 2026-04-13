# EMA

EMA is now a TypeScript-first Electron monorepo.

## Primary Workspace

- `apps/electron` — Electron desktop host
- `apps/renderer` — React renderer
- `services` — local HTTP + WebSocket compatibility backend
- `workers` — background watchers and job runtime
- `cli` — TypeScript CLI
- `shared` — shared contracts, schemas, and types
- `tools` — contract extraction and parity tooling

## Legacy Archive

The previous Tauri + Elixir build has been moved under:

- `IGNORE_OLD_TAURI_BUILD/app`
- `IGNORE_OLD_TAURI_BUILD/daemon`
- `IGNORE_OLD_TAURI_BUILD/src-tauri`
- `IGNORE_OLD_TAURI_BUILD/src`

The legacy tree is retained for contract extraction and parity work, not as the active build target.

## Development

```bash
pnpm install
pnpm dev
```

That starts:

- Vite renderer on `:1420`
- local services on `:4488`
- workers
- Electron desktop shell

## Build

```bash
pnpm build
pnpm package:desktop
```

## Contract Work

```bash
pnpm extract:contracts
pnpm parity
```

## Current Direction

The active architecture direction is documented in:

- `docs/planning/ELECTRON_FOUNDATION_2026-04-10.md`
