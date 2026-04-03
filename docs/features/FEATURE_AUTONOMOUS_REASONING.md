# Feature: Autonomous Reasoning

## What It Does

EMA's autonomous layer — systems that run continuously without human prompting:

1. **Auto Improvement Loop** — detects code gaps → generates proposals → validates → applies (with approval gate)
2. **Threat Model Automaton** — continuous security analysis
3. **Multi-Project Health Dashboard** — health scores, trends, alerts
4. **Agent Specialization Autotune** — adjusts agent params based on performance
5. **Vault-Integrated Seeding** — mines vault for proposal seeds

## Why It Matters

An OS that only responds to commands is a tool. An OS that notices problems and proposes solutions is a partner. Autonomous reasoning is what makes EMA proactive — it spots the stale task, the security gap, the underperforming agent, and does something about it.

## How It Works (Technical)

### Auto Improvement Loop

```
Every N hours:
  1. GapScanner identifies code gaps, stale tasks, orphan notes
  2. For high-priority gaps → auto-generate proposals
  3. Proposals go through Proposal Intelligence validation
  4. "Safe" proposals auto-approved → auto-executed
  5. "Risky" proposals → human approval queue
  6. After execution: verify (tests pass, no regressions)
  7. If verification fails → auto-revert, log failure, adjust strategy
```

### Threat Model Automaton

Continuous security scanning:
- Dependency vulnerability checks (mix audit, npm audit)
- Config exposure analysis (env vars, secrets in code)
- Access pattern anomalies
- API endpoint security posture

### Multi-Project Health Dashboard

Per-project health score (0-1) based on:
- Open bug count / total issues ratio
- Test coverage trend
- Time since last commit
- Stale PR count
- GapScanner findings severity
- Proposal success rate

### Agent Specialization Autotune

Based on `memory/agent-performance.md` patterns:
- Increase/decrease agent autonomy based on success rates
- Route task types to best-performing agents
- Adjust temperature/prompt style per agent

### Vault-Integrated Seeding

Mine the vault for proposal seeds:
- Research notes with "TODO" or "idea" tags
- Decision records with unresolved alternatives
- Session notes with "next steps" that were never followed up
- Pattern: vault knowledge → seeds → proposals → execution

## Current Status

- ✅ GapScanner running (7 sources, hourly) — working
- ✅ TokenTracker with spike detection — working
- ✅ Proposal generation from seeds — working
- ❌ Auto improvement loop — not implemented
- ❌ Threat model automaton — not implemented
- ❌ Multi-project health dashboard — not implemented
- ❌ Agent autotune — not implemented
- ❌ Vault-integrated seeding — not implemented

## Implementation Steps

1. Create `Ema.Autonomous.ImprovementLoop` GenServer — scheduled gap → proposal pipeline
2. Create `Ema.Autonomous.ThreatModel` GenServer — scheduled security scans
3. Create `Ema.Autonomous.HealthDashboard` — aggregates metrics per project
4. Create `Ema.Autonomous.AgentTuner` — adjusts agent params from performance data
5. Create `Ema.Autonomous.VaultSeeder` — mines vault for seeds
6. Build health dashboard UI with trend charts
7. Build approval queue UI for autonomous proposals

## Data Structures

### HealthScore (Planned)
| Field | Type | Description |
|---|---|---|
| project_id | string | Project being scored |
| score | float | 0-1 overall health |
| components | json | Breakdown: {bugs: 0.8, coverage: 0.6, staleness: 0.9, ...} |
| trend | string | improving, stable, declining |
| timestamp | datetime | When scored |

## API Surface

| Endpoint | Method | Description |
|---|---|---|
| `/api/autonomous/health` | GET | All project health scores |
| `/api/autonomous/health/:project_id` | GET | Single project health detail |
| `/api/autonomous/threats` | GET | Current threat findings |
| `/api/autonomous/improvement-log` | GET | Auto-improvement history |

## Next Steps

1. Start with HealthDashboard (aggregation, no autonomy yet)
2. Build ImprovementLoop (the big one)
3. Add ThreatModel as background scanner
4. AgentTuner and VaultSeeder after other autonomous systems prove stable
