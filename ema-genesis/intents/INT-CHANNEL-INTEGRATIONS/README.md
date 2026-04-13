---
id: INT-CHANNEL-INTEGRATIONS
type: intent
layer: intents
title: "Channel integrations — OAuth/API import bridges for external conversation history"
status: active
kind: planning
phase: plan
priority: high
created: 2026-04-12
updated: 2026-04-13
author: ema-cli
connections:
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
  - { target: "[[executions/EXE-004-cli-sprint]]", relation: surfaced_by }
  - { target: "[[intents/INT-CHRONICLE-LANDING-ZONE]]", relation: blocked_by }
tags: [intent, ingestion, channels, oauth, deferred]
---

# INT-CHANNEL-INTEGRATIONS — External conversation import bridges

## Why this exists

The ingestion vApp can already scan local agent tooling on disk, but the next
step requires explicit integrations for remote or app-siloed histories:

- claude.ai conversations
- ChatGPT history
- Discord channels
- iMessage threads

Those imports require OAuth, application APIs, or platform-specific access.
They should not be silently inferred or partially implemented behind fake
commands.

## Current design decision

All external channel bridges land in `Chronicle`, not directly in canon,
proposals, or the vault.

That means this intent is downstream of
`INT-CHRONICLE-LANDING-ZONE`. Connector work should assume:

1. imported raw payloads land in Chronicle-owned storage
2. normalized sessions/messages/traces are indexed there first
3. promotion into intents, canon, proposals, or execution evidence happens only
   through review

## Exit condition

At least one external channel import path is specified end-to-end with:

1. auth method
2. mapping into Chronicle objects
3. review/approval boundary before promotion into structured EMA objects
4. privacy and local-storage policy
5. failure/re-import semantics

## Notes

The CLI already reserves:

- `ema ingest link claude.ai`
- `ema ingest link chatgpt`
- `ema ingest link discord <channel>`
- `ema ingest link imessage`

All four currently return a directive deferral message pointing here.

The first serious targets should be:

1. ChatGPT export / browser-extension capture
2. claude.ai export / browser-extension capture
3. Cursor cloud/local history where available

Discord and iMessage should stay deferred until Chronicle exists and the privacy
model is explicit.
