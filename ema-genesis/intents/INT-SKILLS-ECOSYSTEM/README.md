---
id: INT-SKILLS-ECOSYSTEM
type: intent
layer: intents
title: "Skills Ecosystem — adopt promethos SKILL.md contract, port external skill libraries, wire trigger-loading"
status: preliminary
kind: new-work
phase: discover
priority: medium
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/.superman/intents/calendar-may-2026-activate-skills-ecosystem-adopt-promet/"
recovered_at: 2026-04-12
original_author: human
original_schedule: "2026-05"
exit_condition: "promethos SKILL.md contract adopted as canonical format. 11+ skills ported from muratcankoylan / NeoLabHQ / k-kolomeitsev into wiki/Skills/. OpenHands microagent trigger-loading wired into ContextManager. Agents auto-load relevant skills based on task context without explicit invocation."
connections:
  - { target: "[[canon/specs/EMA-CORE-PROMPT]]", relation: references }
  - { target: "[[canon/specs/agents/_MOC]]", relation: references }
tags: [intent, new-work, skills, promethos, openhands, recovered, preliminary]
---

# INT-SKILLS-ECOSYSTEM

## Original intent text (verbatim)

> CALENDAR (May 2026): Activate Skills Ecosystem. Adopt promethos SKILL.md contract. Port 11 muratcankoylan + NeoLabHQ + k-kolomeitsev skills to wiki/Skills/. Wire OpenHands microagent trigger-loading into ContextManager. Result: agents auto-load relevant skills based on task context.

## What this is

A skill is a scoped capability definition — a markdown file describing what to do, when to do it, and what constraints apply. Claude Code's superpowers skills use this pattern. promethos has a structured SKILL.md contract that formalizes it.

The intent: adopt the contract, port 11 existing external skills, wire a trigger-loader so agents pick up relevant skills automatically based on task context.

## Components

1. **Adopt promethos SKILL.md contract.** External dependency — need to find and fetch the contract spec from the promethos project.
2. **Port 11 skills from external sources** — muratcankoylan, NeoLabHQ, k-kolomeitsev. These are GitHub authors with skill repos. Port into `wiki/Skills/` as individual markdown files.
3. **Wire OpenHands microagent trigger-loading into ContextManager** — OpenHands has a pattern for loading "microagents" (small task-specific prompt fragments) when trigger keywords appear in the user's input. Port that pattern into EMA's ContextManager so skills auto-activate.
4. **Result:** when a user says "help me write tests," the context manager detects the trigger, loads the relevant testing skill, and injects it into the agent's prompt without the user having to say "use your testing skill."

## Gaps / open questions

- **promethos SKILL.md contract location.** Not in the recovered corpus. Needs external fetch.
- **Does ContextManager exist in the new TS build?** Probably not yet — likely becomes a new services/ module.
- **Skill scoping.** Which skills are global, which are per-space, which are per-vApp? Not specified.
- **Conflict resolution.** What happens if two skills both trigger on the same keyword? Priority? Merge? Ask user?
- **Trust model.** Can third-party skills be loaded or only vetted ones? Implications for the P2P case where skills arrive from other EMA instances.

## Related

- [[canon/specs/EMA-CORE-PROMPT]] — soul prompt is the foundation; skills layer on top
- [[canon/specs/agents/_MOC]] — recovered agents will consume skills
- Claude Code's superpowers plugin — closest existing pattern

#intent #new-work #skills #promethos #openhands #recovered #preliminary
