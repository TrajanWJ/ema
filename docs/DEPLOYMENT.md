# EMA — Deployment Guide

EMA is a **local-first desktop app**. "Deployment" means shipping a new version to Trajan's machine without breaking the running app or losing data.

---

## Normal Update Flow (Zero Downtime)

```bash
cd ~/Projects/ema

# 1. Pull latest
git pull

# 2. Preflight check — run tests, compile check
cd daemon && mix precommit
cd ../app && npm run build

# 3. Apply migrations (safe — additive only)
cd daemon && mix ecto.migrate

# 4. Restart daemon gracefully
# (Tauri app stays open, daemon restarts beneath it)
mix phx.server   # or pkill beam.smp && mix phx.server
```

Frontend changes are picked up by hot reload during dev. Production Tauri builds require `npx tauri build`.

---

## Database Migrations

### Writing Safe Migrations

**Always additive in a single deploy:**
- ✅ Add column with `null: true` or default
- ✅ Add table
- ✅ Add index (use `concurrently` if possible)
- ❌ Remove column (do in separate follow-up deploy)
- ❌ Rename column (add new, migrate data, drop old)
- ❌ Change column type without default

### Migration Template

```elixir
defmodule Ema.Repo.Migrations.AddXxxToYyy do
  use Ecto.Migration

  def change do
    alter table(:yyy) do
      add :xxx, :string, null: true        # null: true = safe default
      # or
      add :yyy, :integer, default: 0       # explicit default = also safe
    end

    # Optional: add index separately
    create index(:yyy, [:xxx])
  end
end
```

### Rollback a Migration

```bash
cd daemon
mix ecto.rollback            # rolls back the last migration
mix ecto.rollback --step 3   # rolls back last 3
```

Every migration must be reversible via `change/0` or explicit `up/down`.

---

## Rollback Procedures

### Code rollback

```bash
git log --oneline -10           # find the commit to go back to
git checkout <commit-hash>      # revert code

cd daemon
mix ecto.rollback --step N      # roll back N migrations added since that commit
mix phx.server                  # start with old code
```

### Database backup (before risky migrations)

```bash
cp ~/.local/share/ema/ema_dev.db ~/.local/share/ema/ema_dev.db.bak.$(date +%Y%m%d%H%M%S)
```

Restore:
```bash
pkill beam.smp   # stop daemon
cp ~/.local/share/ema/ema_dev.db.bak.20260403... ~/.local/share/ema/ema_dev.db
```

---

## Feature Flags

Use `Ema.Settings` for feature flags — they're stored in the DB and togglable at runtime:

```elixir
# Check a flag
Ema.Settings.get("feature.new_dashboard", "false") == "true"

# Set from IEx
Ema.Settings.set("feature.new_dashboard", "true")

# Or from the EMA UI: Settings → Developer → Feature Flags
```

### Shipping features disabled

1. Wrap new code in a flag check:
```elixir
if Ema.Settings.feature?("new_feature") do
  # new code path
else
  # old code path
end
```

2. Deploy with flag `false` (off by default)
3. Verify in prod, enable when confident
4. Remove flag after 2+ stable deploys

---

## Tauri Production Build

```bash
cd app
npx tauri build
```

Produces:
- `.deb` package (Linux)
- `.dmg` / `.app` (macOS)
- `.exe` installer (Windows)

Output in `app/src-tauri/target/release/bundle/`.

---

## Smoke Tests (Post-Deploy)

Run these manually (or via script) after every deploy:

```bash
# Health check
curl -s http://localhost:4488/api/health | jq .

# Core CRUD works
curl -s -X POST http://localhost:4488/api/brain_dump/items \
  -H 'Content-Type: application/json' \
  -d '{"content":"smoke test"}' | jq .

# Tasks endpoint
curl -s http://localhost:4488/api/tasks | jq '.data | length'

# WebSocket connect
wscat -c ws://localhost:4488/socket/websocket   # press Ctrl+C after connect
```

Or run the smoke test script:
```bash
./scripts/smoke-test.sh
```

---

## Checklist: Before Every Deploy

- [ ] `mix precommit` passes (no compile warnings, tests pass)
- [ ] Migrations are reversible (`mix ecto.rollback` was tested)
- [ ] Database backed up if migration is risky
- [ ] Feature flags set for incomplete work
- [ ] No hard-coded secrets in new code
- [ ] Smoke tests pass after deploy
