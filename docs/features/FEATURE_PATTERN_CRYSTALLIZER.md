# Feature: Pattern Crystallizer

## What It Does

Watches for recurring workflow patterns that consistently succeed, proposes crystallizing them into permanent artifacts (skills, scripts, routing rules), and auto-creates those artifacts after human approval.

## Why It Matters

Ad-hoc success should become reliable infrastructure. If you've manually done "gap scan → create task → assign to coder → review PR → merge" 8 times with 7 successes, that's not a workflow — that's a script waiting to be written. The crystallizer detects these patterns and hardens them.

## How It Works (Technical)

### Pattern Detection

Track sequences of actions (tool calls, agent dispatches, pipe triggers) as patterns:
```
Pattern: "gap_to_fix"
Sequence: [gap_found, task_created, agent_dispatched, pr_created, pr_merged]
Occurrences: 8
Successes: 7
Rate: 87.5%
```

Detection runs on every workflow completion:
1. Extract action sequence from workflow events
2. Normalize (remove timing, IDs — keep action types and order)
3. Match against known patterns (subsequence matching, not exact)
4. If new pattern with 3+ occurrences → track it
5. If existing pattern → update counts

### Crystallization Threshold

Pattern becomes a crystallization candidate when:
- **5+ total occurrences**
- **70%+ success rate**
- **Consistent structure** (not highly variable between occurrences)

### Crystallization Proposal

When threshold is met:
1. Analyze the pattern — what's the invariant core?
2. Propose an artifact type:
   - **Skill** — complex multi-step with branching logic
   - **Script** — linear command sequence
   - **Routing rule** — delegation pattern (task type → agent)
   - **Pipe** — EMA automation pipe
3. Generate a draft artifact
4. Put in human approval queue with: pattern description, success stats, draft artifact

### Post-Approval

After human approves:
- Create the skill file / script / routing rule / pipe
- Register it (add to AGENTS.md, ~/bin/, pipe registry, etc.)
- Mark pattern as crystallized
- Future occurrences of this pattern use the crystallized version

## Current Status

- ✅ `memory/workflow-patterns.json` tracking in OpenClaw — working (in agent workspace)
- ❌ Pattern detector in EMA — not implemented
- ❌ Crystallization proposer — not implemented
- ❌ Approval queue — not implemented
- ❌ Auto-creation of artifacts — not implemented
- ❌ UI for any of this — not implemented

## Implementation Steps

1. Create `Ema.Crystallizer.PatternDetector` GenServer — hooks into workflow events, tracks patterns
2. Create `Ema.Crystallizer.Proposer` — generates crystallization proposals when threshold met
3. Create `Ema.Crystallizer.ApprovalQueue` — human review queue
4. Create `Ema.Crystallizer.SkillCreator` — generates skill files from patterns
5. Migration: `crystallization_patterns` and `crystallization_proposals` tables
6. Build approval queue UI

## Data Structures

### CrystallizationPattern (Planned)
| Field | Type | Description |
|---|---|---|
| id | string | Pattern ID |
| name | string | Human-readable name |
| sequence | json | Ordered action types |
| occurrences | integer | Total times observed |
| successes | integer | Successful completions |
| failures | integer | Failed completions |
| success_rate | float | successes / occurrences |
| crystallization_candidate | boolean | Meets threshold? |
| crystallized | boolean | Already crystallized? |
| artifact_type | string | skill, script, routing_rule, pipe |
| artifact_path | string | Path to created artifact |

## API Surface

| Endpoint | Method | Description |
|---|---|---|
| `/api/crystallizer/patterns` | GET | All tracked patterns |
| `/api/crystallizer/candidates` | GET | Patterns meeting crystallization threshold |
| `/api/crystallizer/proposals` | GET | Pending crystallization proposals |
| `/api/crystallizer/proposals/:id/approve` | POST | Approve a crystallization |
| `/api/crystallizer/proposals/:id/reject` | POST | Reject a crystallization |

## Next Steps

1. Create PatternDetector (needs Workflow Observatory events first)
2. Build proposer with draft artifact generation
3. Build approval queue UI
4. Wire into existing pipe/skill/script creation
