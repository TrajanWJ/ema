# Engine Operator Kickoff Checklist

Use this before opening fresh Claude Code and Codex instances for EMA engine work.

## 1. Verify local EMA is up

```bash
curl http://localhost:4488/api/health
```

Expected:

```json
{"status":"ok","daemon":"ema"}
```

## 2. Start from the EMA repo

```bash
cd /home/trajan/Projects/ema
```

## 3. Know the active MCP trio

Both Claude and Codex should have:

- `ema`
- `filesystem`
- `qmd`

Current config files:

- Claude: `~/.claude/settings.json`
- Codex: `~/.codex/config.toml`

## 4. Read only the launch-critical docs first

- `docs/INTENT-ENGINE-BOOTSTRAP-START.md`
- `docs/CLAUDE-CODEX-ENGINE-LAUNCH.md`
- `docs/CODEX-ENGINE-SYSTEM-PROMPT.md`
- `docs/CLAUDE-ENGINE-SYSTEM-PROMPT.md`

## 5. Open Codex

```bash
cd /home/trajan/Projects/ema
codex
```

Or autonomous mode:

```bash
cd /home/trajan/Projects/ema
codex --profile yolo
```

Paste:

- `docs/CODEX-ENGINE-SYSTEM-PROMPT.md`

## 6. Open Claude Code

```bash
cd /home/trajan/Projects/ema
claude
```

Paste:

- `docs/CLAUDE-ENGINE-SYSTEM-PROMPT.md`

## 7. First mission for both

Do a bounded convergence pass on:

- intent/session/execution seams
- MCP tool and response-shape seams
- CLI/API contract seams
- stale wiki/operator docs that would mislead later agents

## 8. Guardrails

- no broad rewrite
- no speculative expansion
- trust `daemon/lib/` over stale docs
- findings first
- exact file references
- verify small fixes immediately

## 9. Known live caveats

- `ema_create_task` now mirrors the `/api/tasks` contract, so MCP/CLI clients can create tasks without the old wrapper.
- some MCP/wiki docs remain stale
- runtime auto-linking exists but still needs careful validation

## 10. Desired output

Each agent should leave:

- a short readiness report
- small verified fixes if safe
- a clear statement of remaining risks
