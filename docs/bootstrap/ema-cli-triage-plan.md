# EMA CLI Triage Plan

Updated: 2026-04-07
Status: first plan
Scope: D1 docs cleanup plus CLI triage plan only

## Overview

The EMA CLI has a broad command surface, but first-pass live host testing shows that command trustworthiness is currently limited by environment fragility, inconsistent help behavior, telemetry noise, and at least one clearly broken flagship command: ema brief.

This plan focuses on documenting actual behavior, triaging the most visible breakages, and making the CLI legible before attempting a larger rebuild.

## Phase 1 - Document reality

### Goals
- stop pretending the whole CLI is equally functional
- make audited command status visible in docs
- capture friction without waiting for full fixes

### Tasks
1. Maintain docs/EMA-CLI-COMPATIBILITY-MATRIX.md
2. Add explicit status labels into docs/CLI.md and docs/EMA-CLI-REFERENCE.md
3. Document host shell requirements for running EMA CLI over SSH and noninteractive shells

## Phase 2 - Fix operator-facing basics

### Goals
- make the top-level entrypoint predictable
- remove confusing warnings and errors from common flows
- restore trust in core commands

### Priority issues
1. ema brief broken with missing actor command
2. subcommand help inconsistency for ema brief --help
3. telemetry warnings on basic CLI use
4. environment and bootstrap fragility for noninteractive shells

## Phase 3 - Continue live audit

### Targets
- task
- proposal
- wiki
- loop
- memory
- intent
- doctor
- schema
- skills

### Method
- test against live host EMA
- classify each as WORKING or PARTIAL or BROKEN or UNVERIFIED
- append findings to matrix and scratch pad

## Acceptance criteria for this triage scope
- compatibility matrix exists and is honest
- friction scratch pad exists and is current
- CLI docs mention known nonfunctional and high-friction commands
- at least the most visible operator paths are accurately labeled
