---
id: INT-AGENT-COLLABORATION
type: intent
layer: intents
title: "Agent workspace collaboration — wire UCBRouter + TrustScorer + worktree-per-agent + Coordinator + phase cadence enforcement"
status: preliminary
kind: wiring
phase: discover
priority: high
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/.superman/intents/calendar-q2-2026-june-build-agent-workspace-collaborati/"
recovered_at: 2026-04-12
original_author: human
original_schedule: "2026-06 (Q2 2026)"
exit_condition: "Agent dispatch uses UCBRouter and TrustScorer (currently decorative). Worktree-per-agent isolation via gstack pattern works end-to-end. Coordinator module routes cross-agent work. Phase cadence (plan→execute→review→retro) is enforced — agents can't skip phases. 17 agents go from 'bootstrapped but decorative' to 'actively collaborating'."
connections:
  - { target: "[[canon/specs/agents/_MOC]]", relation: references }
  - { target: "[[_meta/SELF-POLLINATION-FINDINGS]]", relation: references }
tags: [intent, wiring, agents, collaboration, worktree, phase-cadence, recovered, preliminary]
---

# INT-AGENT-COLLABORATION

## Original intent text (verbatim)

> CALENDAR (Q2 2026 - June): Build agent workspace collaboration that actually works. 17 agents bootstrapped but only 3 active. UCBRouter and TrustScorer exist but agent dispatch doesn't use them. Worktree-per-agent isolation (gstack pattern). Coordinator for cross-agent work. Phase cadence enforcement (plan→execute→review→retro). The actor system was supposed to be the 'first native workspace' but it's decorative.

## The framing

This is a **wiring** intent, not a features intent. Everything it names already exists in the old build; none of it is wired up properly. The verdict from the original: **"the actor system was supposed to be the 'first native workspace' but it's decorative."**

## Components

1. **UCBRouter and TrustScorer used by agent dispatch.** Both exist in the old codebase. The router decides which agent picks up a job; the trust scorer weights agent selection by historical reliability. Currently agent dispatch ignores both — it assigns work arbitrarily.
2. **Worktree-per-agent isolation (gstack pattern).** Each agent gets its own git worktree so parallel work doesn't collide. gstack is a reference pattern for this — also see [[research/agent-orchestration/generalaction-emdash]] in the existing research corpus.
3. **Coordinator for cross-agent work.** When two agents need to collaborate on the same task, a Coordinator mediates handoffs and shared state. Does not currently exist as a named module.
4. **Phase cadence enforcement.** Actors cycle through `plan → execute → review → retro` (per [[_meta/SELF-POLLINATION-FINDINGS]] §A.5, confirmed phase vocabulary `idle/plan/execute/review/retro`). Currently phases are a property on the actor but transitions aren't enforced — agents can skip phases or loop inappropriately.

## Why this matters

The soul prompt ([[canon/specs/EMA-CORE-PROMPT]]) commits EMA to being a thinking companion. The three recovered role prompts (Archivist, Strategist, Coach in [[canon/specs/agents/_MOC]]) are the concrete thinking roles. But **without actual collaboration between agents**, each role operates in isolation — the Strategist decomposes goals, the Coach surfaces blockers, the Archivist captures learnings, but none of them talk to each other. This intent is what makes them a team.

## Gaps / open questions

- **Which 17 agents?** Old build bootstrapped 17 but only 3 had prompt files. The other 14 had schemas. Do we port the 14 decorative ones or start fresh?
- **gstack pattern details.** Reference exists; implementation details are vague. Worth a research node under `research/agent-orchestration/`.
- **Coordinator module shape.** New module. Needs its own spec.
- **Phase cadence enforcement mechanism.** State machine with guards? Decorator pattern? Middleware? Unspecified.
- **Dependency on agent runtime port.** [[canon/specs/AGENT-RUNTIME]] already exists — this intent extends it with the collaboration layer.

## Related

- [[canon/specs/agents/_MOC]] — recovered agent prompts
- [[canon/specs/AGENT-RUNTIME]] — parent runtime spec
- [[_meta/SELF-POLLINATION-FINDINGS]] §A TIER PORT `Ema.Actors` — phase cadence as state machine
- [[research/agent-orchestration/generalaction-emdash]] — worktree-per-agent pattern

#intent #wiring #agents #collaboration #worktree #phase-cadence #recovered #preliminary
