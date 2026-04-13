---
id: INT-P2P-FEDERATED-SYNC
type: intent
layer: intents
title: "P2P sync / federated Life OS — CRDT sync between EMA instances via Tailscale (12 modules)"
status: preliminary
kind: new-work
phase: discover
priority: low
created: 2026-04-12
updated: 2026-04-12
author: recovery-agent
recovered_from: "IGNORE_OLD_TAURI_BUILD/daemon/.superman/intents/calendar-q3-2026-july-p2p-sync-federated-life-os-cr/"
recovered_at: 2026-04-12
original_author: human
original_schedule: "2026-07+ (Q3 2026, explicitly after production hardening + outcome loop + skills ecosystem)"
exit_condition: "All 12 planned modules exist per LIFE-OS-ARCHITECTURE.md. CRDT sync works between two EMA instances on different machines, over Tailscale. Delta propagation is eventual-consistent, conflict resolution is deterministic. Integration test proves convergence after network partition."
connections:
  - { target: "[[canon/decisions/DEC-002-crdt-filesync-split]]", relation: depends_on }
  - { target: "[[intents/INT-FEEDBACK-LOOP-INTEGRATION]]", relation: depends_on }
  - { target: "[[intents/INT-SKILLS-ECOSYSTEM]]", relation: depends_on }
tags: [intent, new-work, p2p, crdt, federation, tailscale, recovered, preliminary]
---

# INT-P2P-FEDERATED-SYNC

## Original intent text (verbatim)

> CALENDAR (Q3 2026 - July+): P2P sync / federated Life OS. CRDT-based sync between EMA instances across devices via Tailscale. Designed in LIFE-OS-ARCHITECTURE.md but never started. 12 modules planned. Depends on everything else being stable first. Don't start until production hardening + outcome loop + skills ecosystem are all done.

## Status

Long-horizon. Explicitly blocked on everything else. Not near-term.

## What this is

EMA runs on multiple devices (desktop, laptop, maybe phone). Each device has a local daemon and a local vault. This intent is the sync layer that makes them converge — CRDT-based, running over Tailscale for connectivity, handling network partition gracefully.

## The referenced design doc

`LIFE-OS-ARCHITECTURE.md` is **not in the recovered corpus**. It was referenced by the old intent but the actual file wasn't found in the scan of `IGNORE_OLD_TAURI_BUILD/` or the EMA wiki. It may live in the legacy Obsidian vault (not found there either) or may be lost. **Follow-up:** targeted search for LIFE-OS-ARCHITECTURE.md across all sources.

Until it's found, the "12 modules planned" claim is provisional — we know there are 12 but we don't know what they are.

## Existing genesis context

- [[canon/decisions/DEC-002-crdt-filesync-split]] — already decides that structured data uses CRDT (automerge-repo / Loro) and wiki folders use Syncthing. This intent builds on that split.
- [[_meta/SELF-POLLINATION-FINDINGS]] — `Ema.Bridge.NodeCoordinator` is a TIER REPLACE item with automerge-repo + Syncthing as replacements.

## Hard blockers (from original)

1. Production hardening complete
2. Outcome feedback loop closed ([[intents/INT-FEEDBACK-LOOP-INTEGRATION]])
3. Skills ecosystem shipped ([[intents/INT-SKILLS-ECOSYSTEM]])

Do not start before all three.

## Gaps / open questions

- **LIFE-OS-ARCHITECTURE.md content.** Lost or unrecovered — the module list and design is currently a black box.
- **Conflict resolution rules.** CRDT gives you mechanical convergence but business-logic conflicts (e.g., two devices both mark an intent as completed with different outcomes) need rules.
- **Trust model across devices.** Is every device equally trusted? Host peer / regular peer / invisible peer model from the old wiki suggests not. Per-peer permissions.
- **Mobile.** iOS / Android EMA is handwaved. Probably v3+.

## Related

- [[canon/decisions/DEC-002-crdt-filesync-split]] — parent decision
- [[intents/INT-FEEDBACK-LOOP-INTEGRATION]] — blocker
- [[intents/INT-SKILLS-ECOSYSTEM]] — blocker
- [[_meta/SELF-POLLINATION-FINDINGS]] — NodeCoordinator / SyncCoordinator TIER REPLACE

#intent #new-work #p2p #crdt #federation #tailscale #recovered #preliminary
