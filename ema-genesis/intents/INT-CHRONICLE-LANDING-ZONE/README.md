---
id: INT-CHRONICLE-LANDING-ZONE
type: intent
layer: intents
title: "Chronicle landing zone — first-class raw history layer for imported sessions, traces, and artifacts"
status: active
kind: design
phase: plan
priority: critical
created: 2026-04-13
updated: 2026-04-13
author: codex
exit_condition: "EMA has a first-class Chronicle layer with durable storage for imported bundles, normalized sessions, entries, traces, artifacts, review items, and promotion receipts; the UI can browse a unified timeline and review raw imported material before it becomes intents, proposals, canon, or execution evidence."
connections:
  - { target: "[[intents/INT-CHANNEL-INTEGRATIONS]]", relation: enables }
  - { target: "[[intents/INT-FRONTEND-VAPP-RECONCILIATION]]", relation: informs }
  - { target: "[[intents/INT-PROPOSAL-PIPELINE]]", relation: feeds }
  - { target: "[[executions/EXE-006-ingestion-v1]]", relation: derived_from }
tags: [intent, chronicle, ingestion, review, provenance, critical]
---

# INT-CHRONICLE-LANDING-ZONE

## Why this intent exists

The repo now has an ingestion entry point, but not the missing product seam:

- local agent configs can be discovered
- local session histories can be parsed
- backfeed can generate reviewable suggestions

What does not exist yet is the durable place where imported material lives as
first-class EMA data before promotion.

Without that layer:

- imports are ephemeral reports instead of product state
- review has no stable substrate
- session archaeology is disconnected from projects and intents
- external connectors have nowhere coherent to land

## What must land

The target is a first-class product/domain named `Chronicle`.

Minimum scope:

1. durable raw import storage
2. normalized session/message/trace/artifact records
3. unified timeline and session grouping
4. review items and promotion receipts
5. provenance links from promoted objects back to Chronicle evidence

## What it should own

- source accounts
- import bundles
- chronicle sessions
- chronicle entries
- chronicle traces
- chronicle artifacts
- review items derived from Chronicle
- promotion receipts

## What it should not own

- final canon truth
- proposal approval
- execution runtime dispatch
- vault knowledge management

Chronicle is the arrival and provenance layer, not the whole product.

## Product role

Chronicle should become the product answer to:

- "What did I and my tools already do?"
- "Where did this idea come from?"
- "Which session led to this proposal?"
- "What raw evidence supports this canon decision?"

## Why it is critical

EMA cannot become a real collaborative operating system while imported history
is either invisible, transient, or trapped inside source-specific tooling.

Chronicle is the first place where:

- human work
- agent work
- imported chat history
- shell and CLI traces
- system evidence

become one inspectable substrate.

## Success conditions

- one surface shows a unified imported/activity timeline
- one review flow promotes Chronicle material into structured EMA objects
- external connectors target Chronicle rather than inventing their own storage
- promoted objects preserve exact provenance back to raw Chronicle entries

## Follow-on work this intent feeds

- external OAuth/API connectors
- review queue implementation
- proposal generation from imported material
- execution evidence linking
- search and trace unification
