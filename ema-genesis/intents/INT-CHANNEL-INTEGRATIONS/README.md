---
id: INT-CHANNEL-INTEGRATIONS
type: intent
layer: intents
title: "Channel integrations — OAuth/API import bridges for external conversation history"
status: draft
kind: planning
phase: plan
priority: medium
created: 2026-04-12
updated: 2026-04-12
author: ema-cli
connections:
  - { target: "[[canon/specs/AGENT-RUNTIME]]", relation: references }
  - { target: "[[executions/EXE-004-cli-sprint]]", relation: surfaced_by }
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

## Exit condition

At least one external channel import path is specified end-to-end with:

1. auth method
2. data model mapping
3. review/approval boundary before canon writes
4. privacy and local-storage policy

## Notes

The CLI already reserves:

- `ema ingest link claude.ai`
- `ema ingest link chatgpt`
- `ema ingest link discord <channel>`
- `ema ingest link imessage`

All four currently return a directive deferral message pointing here.
