# EMA CLI Reference

## Installation

```bash
cd ~/Projects/ema/daemon
mix escript.build
# Binary at daemon/ema, wrapper at ~/bin/ema
```

## Usage

```
ema <feature> <subcommand> [options]
```

## Features & Commands

> Legend: ✅ implemented | ⚠️ stub (returns data but limited) | ❌ not implemented

### intent
Search and navigate the intent graph.

```bash
ema intent search "rate limiting"                        # ✅
ema intent search "auth" --project=ema --format=json     # ✅
ema intent graph --project=ema                           # ✅
ema intent list --level=1 --limit=10                     # ✅
ema intent trace <node-id>                               # ⚠️ basic output only
```

### proposal
Manage proposals through their lifecycle.

```bash
ema proposal list                                        # ✅
ema proposal list --status=pending --format=json         # ✅
ema proposal show <id>                                   # ✅
ema proposal validate <id>                               # ⚠️ basic validation only
ema proposal approve <id>                                # ✅
ema proposal reject <id> --reason="Not feasible"         # ✅
ema proposal generate --seed="add observability"         # ✅ (requires proposal engine running)
ema proposal genealogy <id>                              # ✅
```

### session
View and manage session continuity.

```bash
ema session state                                        # ⚠️ basic state only
ema session list --limit=5                               # ✅
ema session crystallize                                  # ❌ not implemented
ema session export --output=/tmp/session.json            # ❌ not implemented
```

### quality
Quality metrics, friction detection, budget tracking.

```bash
ema quality report                                       # ✅
ema quality report --days=14                             # ✅
ema quality friction                                     # ✅
ema quality gradient --days=7                            # ✅
ema quality budget                                       # ✅
ema quality threats                                      # ✅
ema quality improve                                      # ❌ not implemented
```

### routing
Agent fitness and routing engine.

```bash
ema routing status                                       # ✅
ema routing fitness                                      # ✅
ema routing dispatch coding --strategy=specialized       # ⚠️ dispatches but strategy ignored
```

### health
System health checks.

```bash
ema health dashboard                                     # ⚠️ basic stats
ema health check                                         # ⚠️ basic stats
```

### test
Run test suites.

```bash
ema test run                                             # ✅
ema test run --suite=unit                                # ✅
ema test run --suite=integration                         # ⚠️ limited coverage
ema test run --suite=ai                                  # ⚠️ limited coverage
ema test run --suite=all                                 # ✅
```

## Output Formats

All list commands support `--format=table|json|csv`.

```bash
ema proposal list --format=json | jq '.[] | select(.status == "pending")'
ema quality report --format=json > quality-snapshot.json
```

## Environment Variables

- `EMA_API_URL`: Override daemon URL (default: `http://localhost:4488/api`)

## Architecture

The CLI is a standalone escript that communicates with the running EMA daemon via HTTP REST API. It does NOT boot the full Phoenix application — only the HTTP client (Req + Jason).

Requirements:
- EMA daemon must be running (`mix phx.server` or Tauri dev)
- Features show as "not deployed" until their GenServers are started

## Test Suites

| Suite | What it tests |
|-------|--------------|
| `unit` | Individual API endpoints respond correctly |
| `integration` | Cross-feature workflows (proposal->intent, quality->routing) |
| `ai` | AI-powered features (proposal generation, Claude runner) |
| `stress` | High volume + concurrent request handling |
| `all` | Runs unit + integration + ai |
