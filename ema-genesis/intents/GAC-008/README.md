---
id: GAC-008
type: gac_card
layer: intents
title: "Identity layer — does EMA need cryptographic peer identity (HALO-style) before P2P?"
status: pending
created: 2026-04-12
updated: 2026-04-12
author: research-round-1+2-b
category: gap
priority: medium
connections:
  - { target: "[[canon/specs/EMA-GENESIS-PROMPT]]", relation: references }
  - { target: "[[research/p2p-crdt/dxos-dxos]]", relation: derived_from }
  - { target: "[[research/p2p-crdt/anyproto-any-sync]]", relation: derived_from }
---

# GAC-008 — Identity layer

## Question

EMA canon mentions "host peer / regular peer / invisible peer" roles but never defines **who you are** at the protocol level. Currently the implicit answer is "you are whoever runs the daemon." That breaks the moment you have two machines.

## Context

`[[research/p2p-crdt/dxos-dxos]]` proves the right pattern: **HALO** is identity (cryptographic keypair generated locally), **ECHO** is data, **MESH** is transport. Three independent layers.

`[[research/p2p-crdt/anyproto-any-sync]]` adds the membership angle: linear signed ACL chain where every member-add/remove/role-change is cryptographically signed and verified.

Without identity:
- "Host peer" is just the machine you happened to designate
- "Membership" is implicit
- Cross-machine sync is "trust whoever connects"

## Options

- **[A] DXOS HALO model**: Each EMA instance generates a local keypair on first run. Identity = pubkey hash. All P2P messages are signed. Membership operations require valid sigs.
  - **Implications:** Cryptographic correctness. Adds key management UX (backup, recovery). Identity is portable across devices via key transfer.
- **[B] Anytype-style ACL chain**: Identity AND membership as a linear signed chain. Every operation appends a signed record. Backward verification.
  - **Implications:** Stronger than [A] — gives you tamper-evident membership history. More complex to implement.
- **[C] Simple secret-based identity**: Each instance has a UUID + a shared secret per space. No public-key crypto. Trust within a space is "knowing the secret."
  - **Implications:** Simplest. Loses tamper-evidence. Acceptable for v1 single-user; insufficient for multi-user.
- **[D] Defer entirely until P2P ships**: Single-user v1 doesn't need identity. Add HALO when P2P begins.
  - **Implications:** Avoids over-engineering. Risk: v1 schemas get baked in without identity, harder to retrofit.
- **[1] Defer**: BLOCK-006.
- **[2] Skip**: Single-user means single-identity, no work needed.

## Recommendation

**[D]** for v1, **[A]** for v2+ when P2P begins. But **stub the identity field on Actor schema now** so the v2 migration is additive, not breaking. Add an `identity_pubkey: string?` to Actor — null in v1, populated when HALO ships.

## What this changes

`Actor` schema gains an optional `identity_pubkey` field. `EMA-GENESIS-PROMPT.md §9` documents the HALO/ECHO/MESH split as the v2 architecture target. v1 works without it.

## Connections

- `[[canon/specs/EMA-GENESIS-PROMPT]]` §9
- `[[research/p2p-crdt/dxos-dxos]]`
- `[[research/p2p-crdt/anyproto-any-sync]]`
- `[[research/p2p-crdt/garden-co-jazz]]` — Group permission model (separate concern)

#gac #gap #priority-medium #identity #p2p
