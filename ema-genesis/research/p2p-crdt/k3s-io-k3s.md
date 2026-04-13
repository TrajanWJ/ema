---
id: RES-k3s
type: research
layer: research
category: p2p-crdt
title: "k3s-io/k3s — lightweight Kubernetes for edge/homelab with embedded SQLite datastore"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-f
source:
  url: https://github.com/k3s-io/k3s
  stars: 32724
  verified: 2026-04-12
  last_activity: 2026-04-10
signal_tier: B
tags: [research, p2p-crdt, signal-B, k3s, kubernetes, self-healing, homelab]
connections:
  - { target: "[[research/p2p-crdt/_MOC]]", relation: references }
  - { target: "[[research/p2p-crdt/hashicorp-nomad]]", relation: references }
---

# k3s-io/k3s

> Lightweight Kubernetes distribution (<100MB binary) for edge / IoT / homelab. **Embedded SQLite as datastore is exactly EMA's storage model.** The patterns matter for the Life OS multi-device vision.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/k3s-io/k3s> |
| Stars | 32,724 (verified 2026-04-12) |
| Last activity | 2026-04-10 |
| Signal tier | **B** |

## What to learn

### 1. Liveness/readiness probes

Applicable to EMA's GenServer health checks. Phoenix channels currently have no readiness probe — there's no way to know if a worker is "alive but stuck" vs "alive and responding."

### 2. ReplicaSet "one should always be running"

For Pipes.Executor and ProposalEngine.Scheduler supervision. Declare "exactly one of these must run" — k3s handles the rest.

### 3. CRD (Custom Resource Definition) model

Maps to EMA's Ecto schemas as declarative state. Every entity becomes a CRD; the orchestrator reconciles.

### 4. Embedded SQLite as datastore option

**Exactly EMA's storage model.** k3s ships with SQLite as the default backing store, with optional Postgres/MySQL/etcd for production. EMA's daemon can follow the same pattern.

## Changes canon

| Doc | Change |
|---|---|
| New future spec | "k3s-style liveness probes" for each supervised system |
| Future Operations doc | Add k3s as the reference for EMA's eventual multi-machine federation |

## Gaps surfaced

- EMA's OTP supervision handles "crash and restart" but not "is this GenServer actually responding or just alive?" Phoenix channels have no readiness probe.

## Notes

- **Lower signal (B)** because k3s is overkill for single-user EMA today.
- The patterns matter for the Life OS multi-device vision. File the learnings now, apply when federation ships.

## Connections

- `[[research/p2p-crdt/hashicorp-nomad]]` — alternative orchestrator
- `[[research/p2p-crdt/hashicorp-serf]]` — failure detection layer

#research #p2p-crdt #signal-B #k3s #homelab
