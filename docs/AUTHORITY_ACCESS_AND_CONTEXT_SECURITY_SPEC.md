# EMA Authority, Access, and Context Security Spec

Generated: 2026-04-07
Status: draft bootstrap spec

## Why this exists

EMA is becoming a shared workspace and executive-functioning system for humans and agents. That means it needs a clean model for:
- who is acting
- what authority they have
- what context they may access
- what context may be injected into which surface/session
- what truth source wins when system layers disagree

This is broader than login/authentication alone. EMA needs an authority model, an access model, and a context-security model.

## Core principle

Authorization in EMA is not only about API access. It is also about context access and context mutation.

A caller may be allowed to:
- read runtime status
- read private operator memory
- mutate intents
- bind sessions to surfaces
- inject context into a provider prompt
- promote a reflection into durable memory
- cross-pollinate knowledge from one domain into another

These should be modeled explicitly.

## Layer 1 — Identity

Actors should include at minimum:
- human operator
- assistant/system actor
- agent worker
- external surface actor
- automation/cron actor

Suggested actor attributes:
- actor_id
- actor_type
- display_name
- origin_surface
- project_scope
- trust_level
- default_sensitivity_ceiling

## Layer 2 — Authentication

Phase 1 acceptable auth modes:
- local trusted host session
- signed service token / bearer token
- API key for narrow machine integrations
- surface-bound trusted session (CLI/MCP/internal channel)

Future auth modes:
- user auth for GUI/web
- delegated agent/service identities
- signed peer federation

## Layer 3 — Authorization

EMA should authorize by capability, not only by endpoint.

Suggested capabilities:
- runtime.read
- runtime.mutate
- intents.read
- intents.mutate
- memory.read.internal
- memory.read.private
- memory.write
- wiki.read
- wiki.overlay.assemble
- context.packet.read
- context.packet.assemble
- context.inject
- loops.read
- loops.mutate
- proposals.read
- proposals.mutate
- executions.read
- executions.mutate
- governance.read
- governance.mutate
- research.import
- cross_pollinate.promote

## Layer 4 — Sensitivity

Phase 1 sensitivity labels:
- public
- internal
- private
- secret

Rules:
- public: safe for any normal surface
- internal: EMA/system-only unless explicitly exposed
- private: operator/private-session scoped
- secret: never injected into prompts or broad packets; access by explicit secret-aware path only

## Layer 5 — Context injection policy

Context injection should be gated by:
- actor identity
- surface type
- packet type
- sensitivity ceiling
- project/intent scope
- explicit allow/deny rules

Examples:
- a Discord-facing summary packet should never include `private` operator memory unless explicitly allowed
- a local trusted operator CLI session may receive `private` context
- `secret` material should not ride in normal prompt context packets at all

## Authority hierarchy

For operational questions:
1. runtime truth
2. intent schematic truth
3. wiki knowledge truth
4. memory truth
5. semantic expansion/reference imports

For access decisions:
1. explicit deny rules
2. sensitivity ceiling
3. capability grants
4. scope match
5. relevance ranking

## Context-security model

Every context item should be tagged with:
- authority_level
- sensitivity
- source_kind
- allowed_surfaces
- allowed_actor_types
- project_refs
- intent_refs
- mutation_policy

Mutation policy examples:
- read_only
- promote_only_with_review
- auto_promotable
- session_local_only
- secret_path_only

## Immediate implementation slices

1. define actor/capability vocabulary in docs and code
2. define context item access metadata in the packet/common envelope
3. gate packet assembly by sensitivity ceiling + surface policy
4. add explicit secret-exclusion path for prompt injection
5. expose runtime authority mismatches as auditable diagnostics
6. only then add richer GUI/web auth flows

## Non-goals

- do not block all local development on enterprise auth
- do not collapse auth, authority, and context-security into one boolean
- do not allow prompt injection paths to bypass sensitivity policy

## Working interpretation for EMA

EMA needs full auth in the broad sense:
- identity
- capability
- authority
- sensitivity
- context-security

Not just a login screen.
