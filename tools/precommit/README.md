# tools/precommit

Stub placeholder for the EMA precommit hook system. Activated once Husky + lint-staged are wired at the monorepo root.

## Scope (planned)

Port of the old Elixir `Ema.Standards.HooksInstaller` (see `ema-genesis/_meta/SELF-POLLINATION-FINDINGS.md` Appendix A.12). When activated, this hook enforces:

1. **No hardcoded API keys** — grep for `sk-`, `xoxp-`, `ghp_`, and any `*_TOKEN=` / `*_SECRET=` patterns in staged files.
2. **Issue references on TODOs and FIXMEs** — every `TODO(...)` / `FIXME(...)` must cite an issue or canon node, e.g. `TODO(#123):` / `FIXME(GAC-007):` / `TODO(INT-RECOVERY-WAVE-1):`.
3. **No modifications to `ema-genesis/canon/decisions/`** without an accompanying proposal in `ema-genesis/proposals/`.
4. **No modifications to `ema-genesis/canon/specs/`** without an approved GAC card resolution.

## Activation checklist

- [ ] Add `husky` + `lint-staged` to root `devDependencies`
- [ ] `pnpm exec husky init`
- [ ] Add `.husky/pre-commit` calling `tools/precommit/run.ts`
- [ ] Port the 4 checks above into `tools/precommit/run.ts` as Node scripts
- [ ] Add tests under `tools/precommit/*.test.ts`

## References

- `IGNORE_OLD_TAURI_BUILD/daemon/lib/ema/standards/hooks_installer.ex` — source pattern
- `ema-genesis/canon/decisions/DEC-006-deferred-cli-features.md` — deferral rationale
- `ema-genesis/intents/INT-RECOVERY-WAVE-1/README.md` Stream 5 — tracking

Nothing to run yet. This directory exists to mark the slot.
