---
id: GAC-001
type: gac_card
layer: intents
title: "Cross-machine dispatch protocol — how does an agent run on a remote machine?"
status: answered
created: 2026-04-12
updated: 2026-04-12
answered_at: 2026-04-12
answered_by: human
resolution: deferred-to-v2
author: research-round-1+2-a
category: gap
priority: critical
connections:
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
  - { target: "[[canon/specs/EMA-GENESIS-PROMPT]]", relation: references }
  - { target: "[[research/agent-orchestration/generalaction-emdash]]", relation: derived_from }
  - { target: "[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]", relation: derived_from }
  - { target: "[[research/p2p-crdt/hashicorp-serf]]", relation: derived_from }
---

# GAC-001 — Cross-machine dispatch protocol

## Question

EMA canon says agents can dispatch to "any machine in the P2P network." How does this actually work at the protocol level? Currently the answer is "SSH tunnel" + "Tailscale + something" — that's not a spec.

## Context

Round 1 surfaced multiple working patterns. Round 2-A confirmed the resumable side. The five candidates collapsed into three families:

1. **SSH + worktree mirroring** (`[[research/agent-orchestration/generalaction-emdash]]`)
2. **Durable workflow with checkpoint store** (`[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]`, Temporal, Restate)
3. **Full container isolation per agent** (`[[research/agent-orchestration/dagger-container-use]]`)

EMA needs to pick a default. The current canon "SSH tunnel" answer is silent on resumability, on coordination, and on what happens when the remote machine dies mid-run.

Related: `[[research/p2p-crdt/hashicorp-serf]]` provides the failure detection layer (SWIM gossip) any of these would build on.

## Options

- **[A] DBOS-style durable workflow over local Tailscale**: Each EMA daemon hosts a DBOS-transact-ts checkpoint store in its local SQLite. Agents are workflow steps. Cross-machine dispatch = enqueue on the remote daemon's job queue. Resumability via per-step checkpoints + replay protocol.
  - **Implications:** Requires picking DBOS as a dependency. Resume across nodes works because state lives in the per-node SQLite, replicated via the storage layer. SWIM gossip via Serf for failure detection. Fits EMA's Electron+SQLite stack natively.
- **[B] emdash-style SSH + worktree mirroring**: Agent runs over SSH on the remote machine in a mirrored git worktree. Output streams back over the SSH channel. No durable state — if the connection drops, the run is lost.
  - **Implications:** Simpler. Matches existing SSH-everywhere muscle memory. Loses everything on disconnection. No resume.
- **[C] Container-use as the runtime, dispatcher chooses location**: All agents run in Dagger containers per `[[research/agent-orchestration/dagger-container-use]]`. The dispatcher decides whether the container starts on local or remote. Strong isolation. Less resume.
  - **Implications:** Adds container runtime as a hard dependency. Stronger isolation than worktree. Container start latency ~seconds. Doesn't solve the resume problem.
- **[D] Hybrid: DBOS for the orchestration layer + emdash for the transport**: The dispatcher uses DBOS for the workflow + checkpoint store, but each step is "open SSH to peer X and run command Y." Cross-machine handoff happens at workflow boundaries, not mid-step.
  - **Implications:** Most rigorous. Most complex. Requires both dependencies. Probably the right answer for the v2+ Life OS phase but overkill for v1.
- **[1] Defer**: Push to BLOCK-001 (block: cross-machine dispatch). v1 stays single-machine. Decide later.
- **[2] Skip**: Cross-machine is a v2+ concern by `[[canon/specs/EMA-V1-SPEC]]` §7 anyway. Don't decide now.

## Recommendation

**[1] Defer** for v1. **[A] DBOS durable workflow** for v2 Life OS phase. The recommendation track is: ship single-machine v1 (no cross-machine), then in v2 add DBOS as the durable layer + Serf for failure detection + Tailscale as the underlay. emdash and container-use are still useful as references but not as the architecture.

## What this changes

If [A] / [D]: `AGENT-RUNTIME.md` gains a "Cross-Machine Dispatch" section + DBOS dependency.
If [B]: AGENT-RUNTIME stays simple but EMA accepts no resume across machines.
If [C]: AGENT-RUNTIME gains a container runtime requirement.
If [1] / [2]: Canon explicitly defers; create BLOCK-001.

## Connections

- `[[canon/specs/AGENT-RUNTIME]]` — primary canon target
- `[[research/agent-orchestration/dbos-inc-dbos-transact-ts]]`
- `[[research/agent-orchestration/generalaction-emdash]]`
- `[[research/agent-orchestration/dagger-container-use]]`
- `[[research/agent-orchestration/temporalio-temporal]]`
- `[[research/agent-orchestration/restatedev-restate]]`
- `[[research/p2p-crdt/hashicorp-serf]]`

## Resolution (2026-04-12)

**Answer: [1] Defer to v2** with **[A] DBOS durable workflow** locked as the v2 target.

v1 ships single-machine only. `AGENT-RUNTIME.md` will not gain a "Cross-Machine Dispatch" section until v2. A BLOCK-001 placeholder is implied by the deferral — the v2 target is unambiguous (DBOS-transact-ts checkpoint store on each node's local SQLite, SWIM gossip via Serf for failure detection, Tailscale as the network underlay, emdash SSH transport as the step-level executor). The recovery wave documented in `[[_meta/SELF-POLLINATION-FINDINGS]]` Appendix A does not alter this — the old Elixir `Ema.Bridge.NodeCoordinator` tried to solve this prematurely and is correctly assigned TIER REPLACE.

#gac #gap #priority-critical #cross-machine-dispatch #agent-runtime #answered
