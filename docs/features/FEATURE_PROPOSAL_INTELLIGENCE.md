# Feature: Proposal Intelligence

## What It Does

Makes the proposal engine smarter: validates proposals before approval, auto-approves safe ones, links proposals to outcomes, and feeds results back into seed selection.

## Why It Matters

The current proposal engine generates ideas but doesn't validate them or learn from outcomes. A proposal that breaks the build, duplicates killed work, or costs too much shouldn't reach the approval queue. And when proposals succeed, that signal should improve future generation.

## How It Works (Technical)

### Validation Loop
Before a proposal enters the approval queue, run:
1. **Lint check** — Does the proposed code/config change parse?
2. **Build simulation** — Would this break existing tests?
3. **Code quality** — Does it match project style/patterns?
4. **KillMemory check** — Was a similar proposal already killed? Why?
5. **Cost estimation** — How many tokens/agent-hours will execution take?

### Auto-Approve Rules
"Safe" proposals bypass manual review:
- Score > 0.8 AND
- No kill history for similar proposals AND
- Cost estimate < threshold AND
- Project has auto-approve enabled AND
- Change scope is small (< 50 LOC or config-only)

### Outcome Linking
After execution completes:
- Link proposal → execution → outcome (success/failure/partial)
- Record what changed (files, metrics, test results)
- Calculate "proposal effectiveness" score

### Feedback Loop
Outcome data feeds back into seed selection:
- Seeds that produce approved, successfully-executed proposals get boosted
- Seeds that produce killed or failed proposals get downweighted
- Combiner prioritizes high-success-rate seed clusters

## Current Status

- ✅ Proposal generation from seeds — working
- ✅ Manual approval/rejection flow — working
- ✅ Combiner cross-pollination — working
- ✅ Proposal scoring — working
- ❌ Validation loop — not implemented
- ❌ KillMemory — not implemented
- ❌ Auto-approve — not implemented
- ❌ Outcome linking — not implemented
- ❌ Feedback loop — not implemented

## Implementation Steps

1. Create `Ema.ProposalEngine.Validator` — orchestrates the 5-check validation pipeline
2. Create `Ema.ProposalEngine.KillMemory` — stores killed proposal signatures, similarity search
3. Create `Ema.ProposalEngine.CostEstimator` — estimates execution cost based on scope
4. Create `Ema.ProposalEngine.AutoApprover` — rules engine for safe auto-approval
5. Create `Ema.ProposalEngine.OutcomeLinker` — links proposals to execution results
6. Create `Ema.ProposalEngine.FeedbackLoop` — adjusts seed weights based on outcomes
7. Add validation status to proposal schema (migration)
8. Wire into existing ProposalEngine.Generator pipeline

## Data Structures

### ProposalValidation (Planned)
| Field | Type | Description |
|---|---|---|
| proposal_id | string | Validated proposal |
| lint_ok | boolean | Passed lint check |
| build_ok | boolean | Passed build simulation |
| quality_score | float | Code quality score 0-1 |
| kill_memory_hit | boolean | Similar proposal was killed before |
| estimated_cost | float | Estimated execution cost in $ |
| auto_approve_eligible | boolean | Meets auto-approve criteria |

## API Surface

Extends existing `/api/proposals` endpoints:
| Endpoint | Method | Description |
|---|---|---|
| `/api/proposals/:id/validate` | POST | Trigger validation |
| `/api/proposals/:id/validation` | GET | Get validation results |
| `/api/proposals/:id/outcome` | GET | Linked outcome data |
| `/api/proposals/auto-approve-rules` | GET/PUT | Manage auto-approve rules |

## Next Steps

1. Start with KillMemory (simple, high-value — stops repeating mistakes)
2. Build validator framework, add checks incrementally
3. Outcome linking after Workflow Observatory ships (needs workflow events)
