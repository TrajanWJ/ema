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

### intent
Search and navigate the intent graph.

```bash
ema intent search "rate limiting"
ema intent search "auth" --project=execudeck --format=json
ema intent graph --project=execudeck
ema intent list --level=1 --limit=10
ema intent trace <node-id>
```

### proposal
Manage proposals through their lifecycle.

```bash
ema proposal list
ema proposal list --status=pending --format=json
ema proposal show <id>
ema proposal validate <id>
ema proposal approve <id>
ema proposal reject <id> --reason="Not feasible"
ema proposal generate --seed="add observability to pipes"
ema proposal generate --seed="improve vault search" --count=3 --measure-latency
ema proposal genealogy <id>
```

### session
View and manage session continuity (DCC).

```bash
ema session state
ema session list --limit=5
ema session crystallize
ema session export --output=/tmp/session.json
```

### quality
Quality metrics, friction detection, budget tracking.

```bash
ema quality report
ema quality report --days=14
ema quality friction
ema quality gradient --days=7
ema quality budget
ema quality threats
ema quality improve
```

### routing
Agent fitness and routing engine.

```bash
ema routing status
ema routing fitness
ema routing dispatch coding --strategy=specialized
```

### health
System health checks.

```bash
ema health dashboard
ema health check
```

### test
Run test suites.

```bash
ema test run
ema test run --suite=unit
ema test run --suite=integration
ema test run --suite=ai
ema test run --suite=all --output=/tmp/ema-test-report.json
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

This means:
- The EMA daemon must be running (`mix phx.server` or Tauri dev)
- Features show as "not deployed" until their GenServers are started (daemon restart required after new module deployments)

## Test Suites

| Suite | What it tests |
|-------|--------------|
| `unit` | Individual API endpoints respond correctly |
| `integration` | Cross-feature workflows (proposal→intent, quality→routing) |
| `ai` | AI-powered features (proposal generation, Claude runner) |
| `stress` | High volume + concurrent request handling |
| `all` | Runs unit + integration + ai |

## Scripting Examples

```bash
# Quality watchdog
if [ "$(ema quality gradient --format=json | jq -r '.trend')" = "degrading" ]; then
  echo "Quality degrading — triggering improvement cycle"
  ema quality improve
fi

# Batch validate proposals
ema proposal list --format=json | jq -r '.[].id' | while read id; do
  ema proposal validate "$id"
done

# Test before shipping
ema test run --suite=all --output="/tmp/ema-test-$(date +%Y%m%d).json"
```
