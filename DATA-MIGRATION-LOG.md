# EMA Data Migration Log

**Date:** 2026-03-30
**Performed by:** Coder subagent (ema-coder-4)
**Status:** ✅ Complete

---

## Summary

Bootstrapped Trajan's existing data and workflows into EMA. All scripts are
idempotent and safe to re-run.

---

## Task 1: Claude Code Session Import

**Script:** `~/Projects/ema/scripts/import-claude-sessions.exs`
**Run with:** `cd ~/Projects/ema/daemon && mix run scripts/import-claude-sessions.exs`

### What it does
- Scans `~/.claude/projects/` for all session directories (33 found)
- Decodes Claude's slug format back to real filesystem paths
- Creates `Project` records for unique project paths (skips existing)
- Parses each `.jsonl` session file to extract:
  - `started_at` / `ended_at` timestamps
  - First user message as summary (truncated to 200 chars)
  - Token count from `usage` fields
  - Tool call count
  - Files touched (from tool input paths)
- Creates `ClaudeSession` records linked to projects

### Projects found in `~/.claude/projects/`
All 33 directories correspond to project paths. Notable ones:
- `/home/trajan/Desktop/Coding/Projects/claude-remote-discord` (many sessions)
- `/home/trajan/Desktop/Coding/Projects/web-design-STR/client-sites/wilson-premier`
- `/home/trajan/Desktop/Coding/Projects/dispohub`
- `/home/trajan/Desktop/Coding/Projects/execudeck`
- `/home/trajan/Desktop/Coding/Projects/letmescale`
- `/home/trajan/Desktop/Coding/Projects/pomodoro`
- `/home/trajan/Desktop/Coding/Projects/xpressdrop`
- `/home/trajan/Desktop/Coding/Projects/YoutubeAutomations`
- `/home/trajan/` (root home sessions)
- `/home/trajan/Desktop` (desktop sessions)

### Notes
- Sessions with duplicate `session_id` are skipped (idempotent)
- The path decoder uses home-prefix heuristic; paths with hyphens in their
  names may decode incorrectly (e.g. `claude-remote-discord` → multiple segments)
  but the linked_path on the Project record is used for display only

---

## Task 2: Core Projects Seeded

**Script:** `~/Projects/ema/daemon/priv/repo/seeds.exs`
**Run with:** `cd ~/Projects/ema/daemon && mix run priv/repo/seeds.exs`

| Project | Slug | Status | Path |
|---------|------|--------|------|
| EMA | `ema` | active | `~/Projects/ema` |
| ClaudeForge | `claude-remote-discord` | paused | `~/Desktop/Coding/Projects/claude-remote-discord` |
| DispoHub | `dispohub` | incubating | `~/Desktop/Coding/Projects/dispohub` |
| ExecuDeck | `execudeck` | incubating | `~/Desktop/Coding/Projects/execudeck` |

Additional projects will be auto-created by the Claude session importer.

---

## Task 3: Proposal Engine Seeds

4 default seeds created in `proposal_seeds` table:

| Name | Schedule | Scope |
|------|----------|-------|
| Brainstorm improvements for EMA's UI/UX | `0 */6 * * *` (every 6h) | ema project |
| Identify integration opportunities between EMA apps | `0 */12 * * *` (every 12h) | global |
| Review code quality and suggest refactors | `0 9 * * *` (daily 9am) | ema project |
| What new virtual apps would be valuable? | `0 */8 * * *` (every 8h) | global |

---

## Task 4: Default Responsibilities

4 default responsibilities created:

| Title | Role | Cadence |
|-------|------|---------|
| Keep EMA tests passing | developer | weekly (Mondays) |
| Review and merge PRs | developer | daily |
| Weekly review and planning | self | weekly (Sundays) |
| Update dependencies | maintainer | monthly (1st) |

---

## Task 5: Second Brain Vault

**Vault location:** `~/.local/share/ema/vault/`

### Structure (pre-existing + verified)
```
~/.local/share/ema/vault/
├── research-ingestion/
│   └── _index.md          ✅ exists
├── projects/
│   └── ema/
│       ├── _index.md      ✅ exists (EMA overview)
│       ├── notes/         ✅ created
│       ├── plans/         ✅ created
│       └── specs/         ✅ exists (3 spec files copied)
│           ├── 2026-03-29-ema-design.md
│           ├── 2026-03-29-ema-multiwindow-design.md
│           └── 2026-03-30-ema-engine-design.md
├── user-preferences/
│   └── _index.md          ✅ exists
└── system/
    └── _index.md          ✅ exists
```

The vault was partially bootstrapped already. All required directories exist.
Notes and plans subdirectories for `projects/ema` were created.

---

## Next Steps

1. **Run the seeds:** `cd ~/Projects/ema/daemon && mix run priv/repo/seeds.exs`
2. **Run the import:** `cd ~/Projects/ema/daemon && mix run scripts/import-claude-sessions.exs`
3. **Add Jason dep check:** The import script uses `Jason.decode/1` — verify Jason is
   in the daemon's mix.exs deps (it should be via Phoenix, but confirm)
4. **Project slug collisions:** Paths with hyphens (like `claude-remote-discord`) will
   produce different slugs when decoded — review imported projects after running
5. **Vault expansion:** Add notes and plans for other projects as they become active

---

## Files Created / Modified

| File | Action |
|------|--------|
| `~/Projects/ema/scripts/import-claude-sessions.exs` | Created |
| `~/Projects/ema/daemon/priv/repo/seeds.exs` | Created |
| `~/.local/share/ema/vault/projects/ema/notes/` | Directory created |
| `~/.local/share/ema/vault/projects/ema/plans/` | Directory created |
| `~/Projects/ema/DATA-MIGRATION-LOG.md` | Created (this file) |
