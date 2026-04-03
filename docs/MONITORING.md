# EMA — Monitoring Guide

## What to Watch

| Signal | Where | Threshold |
|---|---|---|
| Daemon alive | `curl localhost:4488/api/health` | Any non-200 = problem |
| DB query latency | Phoenix telemetry logs | > 500ms = slow |
| Error log entries | `[error]` in daemon logs | Any unexpected |
| AI run failures | `Ema.Claude.Runner` error returns | Repeated = backend issue |
| Pipes stalled | `Ema.Pipes` run count plateau | 0 runs in 10min + jobs queued |
| Memory fragments | DB row count growth | Review if > 10k rows |
| Evolution engine | Last run timestamp | Stale > 24h |

---

## Structured Logging

EMA uses Elixir's standard Logger. In dev, logs print to console. In prod they should be piped to a file or log aggregator.

### Log format
Default in `config/config.exs`:
```elixir
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]
```

For structured JSON logs (recommended if feeding to a log aggregator):
```elixir
# Add to config/prod.exs
config :logger,
  backends: [:console],
  format: {LoggerJSON.Formatters.GoogleCloudLogger, :format}
```

Add `logger_json` dep: `{:logger_json, "~> 6.0"}`.

### Key log points
- Every Phoenix request logs `[info] GET /api/tasks` with duration
- DB query over 100ms logged automatically (Ecto telemetry)
- Claude runner: `[info] Claude run: #{ms}ms` on success, `[error] Claude run failed: #{reason}` on failure
- Pipes: `[info] Pipe executed: #{pipe_name}` on each run
- Agent: `[info] Agent #{agent_id} task completed` / `[error] Agent #{agent_id} crashed`

---

## Health Check Endpoint

```
GET /api/health
```

Returns `{"status":"ok","db":"connected","version":"0.1.0"}`.

Should be queried:
- By any uptime monitor
- In smoke tests post-deploy
- By EMA's own VM health dashboard (`Ema.Intelligence.VmMonitor`)

---

## Key Metrics per Feature

### Brain Dump
- Items created per day (throughput)
- Items unprocessed (queue depth — alert if > 50)
- Processing time (how fast items get triaged)

### Tasks
- Open tasks count (informational)
- Tasks created / completed per day
- Avg time from inbox → done

### Proposals
- Pending proposals in queue
- Proposal engine run frequency (should run on schedule)
- Acceptance rate (% approved by Trajan)

### Pipes
- Active pipes count
- Runs per pipe per day
- Failed runs (should be 0)
- Last execution timestamp per pipe

### AI / Claude
- Total tokens used per day (`Ema.Intelligence.TokenTracker`)
- Cost per day (from token rates × model)
- Error rate on Claude calls
- Avg latency per call

### Evolution Engine
- Last run timestamp
- Signals processed
- Mutations applied

---

## Dashboards in EMA UI

The **VM Health** and **Intelligence** panels in EMA show:
- Elixir node memory/CPU (via `Ema.Intelligence.VmMonitor`)
- Token spending (via `Ema.Intelligence.TokenTracker`)
- Cost forecast (via `Ema.Intelligence.CostForecaster`)
- Trust scores per agent (via `Ema.Intelligence.TrustScorer`)

Open EMA → navigate to the Intelligence or System Health view.

---

## Alerts

EMA can send alerts to Discord or Telegram via the OpenClaw bridge.

### Setting up an alert

In `Ema.Intelligence` or any GenServer, use the broadcast pattern:
```elixir
Phoenix.PubSub.broadcast(Ema.PubSub, "alerts", {:alert, %{
  level: :error,
  source: "pipes",
  message: "Pipe executor stalled — no runs in 10 minutes",
  context: %{last_run: last_run_at}
}})
```

A subscriber (in `Ema.Openclaw` or the bridge channel) handles `:alert` messages and routes them to Discord/Telegram.

### Alert levels
- `:info` — log only
- `:warning` — log + EMA notification
- `:error` — log + EMA notification + Discord ping
- `:critical` — all of the above + Telegram

---

## Debugging a Production Issue

1. **Check logs first:**
   ```bash
   # Dev: running in terminal — scroll up
   # If daemon runs as a service:
   journalctl -u ema-daemon -n 100 --no-pager
   ```

2. **Connect to running node:**
   ```bash
   cd daemon
   iex --remsh ema@localhost
   ```

3. **Check process tree:**
   ```elixir
   :observer.start()   # GUI process inspector
   # or without GUI:
   Supervisor.which_children(Ema.Application)
   ```

4. **Query the DB directly:**
   ```elixir
   Ema.Repo.all(Ema.Pipes.Pipe) |> Enum.filter(& &1.active)
   Ema.Repo.aggregate(Ema.BrainDump.Item, :count, :id)
   ```

5. **Check token tracker:**
   ```elixir
   Ema.Intelligence.TokenTracker.get_stats()
   ```

---

## Common Issues

### Daemon won't start
```
** (Postgrex.Error) FATAL 42P04 (duplicate_database)
```
→ Wrong DB adapter in config. EMA uses `ecto_sqlite3`, not Postgres.

```
[error] could not start child Ema.Repo
```
→ Run `mix ecto.create && mix ecto.migrate`

### Claude runs failing
```
[error] Claude run failed: :enoent
```
→ `claude` not on PATH. Run `which claude` — install if missing.

```
[error] Claude run failed: {:timeout, 120000}
```
→ Increase timeout in runner config or check prompt size.

### Pipes not executing
→ Check `config :ema, pipes_workers: true` in your env config (it's `false` in test).
→ Check pipe is `active: true` in DB: `Ema.Pipes.list_pipes() |> Enum.filter(& &1.active)`

### WebSocket disconnecting
→ Check CORS config (`EmaWeb.CORSPlug`) — frontend origin must be allowed.
→ Check `check_origin: false` in dev config.
