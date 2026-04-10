# EMA Context Assembler System Spec

Generated: 2026-04-07
Status: draft bootstrap spec

## Purpose

EMA is not just a task engine or chat wrapper. It is a shared workspace and executive-functioning system between humans and agents. The context assembler is the subsystem that turns runtime state, intent structure, knowledge, memory, and session continuity into bounded context products that help humans and agents act coherently.

This subsystem should behave like a control-plane context compiler, not like naive prompt stuffing.

## Core definition

The context assembler:
- gathers multi-source context
- normalizes it into a common envelope
- filters it by safety and relevance
- scores and assembles context packets
- supports both reactive and proactive operation
- stays tightly coupled to session flow, intent progression, and live host truth

## Source strata

### 1. Runtime truth
Highest authority for operational questions.
Examples:
- host truth
- active executions
- proposals/tasks state
- incidents/anomalies
- dispatch state
- session/provider status

### 2. Intent schematic truth
Primary direction layer.
Examples:
- active intents
- aspiration/target structures
- contradictions/clarifications
- current objective frame
- bindings to tasks/proposals/executions

### 3. Wiki / knowledge truth
Durable explanatory layer.
Examples:
- architecture docs
- contracts
- research distillations
- operational patterns
- Mermaid-supported system views
- anti-patterns and decisions

### 4. Memory truth
Reusable typed memory for operator/project continuity.
Examples:
- actor memory bundles
- project memory bundles
- distilled lessons
- recurring preferences

### 5. Semantic expansion
Advisory relatedness layer inspired by Superman-like systems.
Examples:
- similar concepts
- cross-linked pages
- latent neighbors
- prior related incidents and patterns

### 6. Session-local continuity
Immediate conversational and workstream context.
Examples:
- current surface/thread/session
- recent requests
- already-injected context
- current packet family
- active omissions and unresolved questions

## Authority model

For operational reality:
1. runtime truth
2. intent schematic truth
3. wiki/knowledge truth
4. memory truth
5. semantic expansion
6. external research imports

For conceptual explanation:
- wiki may lead, but runtime drift must be surfaced when relevant.

## Packet families

### Operator packet
Purpose:
- what is going on
- what should happen next

### Project packet
Purpose:
- current project state
- key docs/intents/tasks/proposals/executions

### Intent packet
Purpose:
- intent definition
- bindings
- blockers
- relevant knowledge neighborhood

### Execution packet
Purpose:
- execution lineage
- relevant state
- recovery hints
- intent and proposal ties

### Briefing packet
Purpose:
- bounded operator-facing update
- now / next / risk / why

### Query-conditioned wiki packet
Purpose:
- stable page core plus context-aware overlay assembled for a particular query, intent, or session

## Common envelope

Each selected context item should carry:
- id
- source_kind
- source_ref
- entity_kind
- title
- summary
- body
- timestamp
- freshness_score
- confidence_score
- authority_level
- sensitivity
- intent_refs
- project_refs
- session_refs
- tags

## Sensitivity model

Phase 1 labels:
- public
- internal
- private
- secret

## Assembly pipeline

### Stage 1: resolve mode
Identify whether the request/workstream is:
- status
- planning
- implementation
- diagnosis
- bootstrap
- explanation
- briefing
- recovery

### Stage 2: resolve scope
Determine the relevant:
- operator
- project
- intent
- execution
- page/topic
- session/surface

### Stage 3: gather candidates
Pull candidates from the source strata.

### Stage 4: normalize
Convert candidates to the common envelope.

### Stage 5: safety filter
Apply:
- sensitivity gating
- surface/session constraints
- stale/conflicting private context suppression
- anti-poisoning checks

### Stage 6: rank
Hybrid ranking:
- hard rules for safety and required inclusions
- weighted scoring for usefulness

Primary scoring dimensions:
- runtime salience
- intent alignment
- freshness
- source authority
- semantic proximity
- session salience

### Stage 7: assemble
Assemble packet sections such as:
- current reality
- intent frame
- relevant knowledge
- semantic neighbors
- risks/drift
- next actions
- sources

### Stage 8: trace and observe
Record:
- why context was selected
- budget allocation
- omitted items
- usefulness feedback
- repeated missing-context patterns

## Proactive / subconscious mode

The assembler should run in background to:
- precompute operator/project/intent briefings
- maintain context cache entries
- detect stale wiki-vs-runtime drift
- detect contradictory intent structures
- detect missing runbooks for recurring failures
- prepare likely next-needed packets for active sessions

It should not silently promote weak inferences into canonical truth.

## Existing host EMA modules that already align

Current host code already contains pieces of this system:
- `Ema.Claude.ContextInjector`
- `Ema.Claude.ContextManager`
- `Ema.Intelligence.ContextBudget`
- `Ema.Intelligence.ContextCache`
- `Ema.Intelligence.ContextTrace`
- `Ema.SecondBrain.SystemBrain`
- `Ema.Evolution.SignalScanner`
- `Ema.Intents.Schematic.*`
- `Ema.Loops.*`

These should be unified under one explicit assembly contract rather than growing independently.

## Immediate implementation priorities

1. expose runtime-authority diagnostics so EMA can explain why API truth and service-manager truth diverge
2. define packet structs and a packet-family resolver
3. add source adapters for runtime, intents, wiki, memory, semantic expansion, and session continuity
4. unify briefing, memory, and prompt injection on top of the same packet model
5. support query-conditioned wiki overlays rather than only static page retrieval
6. add feedback loops that improve ranking without silently mutating canonical truth

## Non-goals

The context assembler is not:
- raw top-k retrieval
- a single giant memory blob
- a replacement for canonical runtime state
- an excuse to inject everything everywhere
- an uncontrolled autonomy engine

## Guiding principle

EMA should help humans and agents share workspace, continuity, and executive function. The context assembler exists to put the right bounded truth in front of the right actor at the right moment.
