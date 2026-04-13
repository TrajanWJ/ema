---
id: RES-typedb
type: research
layer: research
category: knowledge-graphs
title: "typedb/typedb — strongly-typed polymorphic graph DB with rule inference"
status: active
created: 2026-04-12
updated: 2026-04-12
author: research-round-2-f
source:
  url: https://github.com/typedb/typedb
  stars: 4282
  verified: 2026-04-12
  last_activity: 2026-04-10
  license: MPL-2.0
signal_tier: S
tags: [research, knowledge-graphs, graph-db, typedb, schema-first, inference]
connections:
  - { target: "[[research/knowledge-graphs/_MOC]]", relation: references }
  - { target: "[[research/knowledge-graphs/cozodb-cozo]]", relation: references }
  - { target: "[[DEC-001]]", relation: references }
---

# typedb/typedb

> The live graph DB option since Kuzu is archived AND Cozo is going stale. Strongly-typed schema, built-in rule inference. The right escape valve for `[[DEC-001]]` if the SQLite Object Index ever bottlenecks.

## Source

| Field | Value |
|---|---|
| URL | <https://github.com/typedb/typedb> |
| Stars | 4,282 (verified 2026-04-12) |
| Last activity | 2026-04-10 (v3.8.3 released 2026-03-30) |
| Signal tier | **S** |
| License | MPL-2.0 (embeddable) |
| Language | Rust core + TypeQL DSL |

## What it is

Strongly-typed polymorphic graph database with built-in rule inference. **Schema-first, not schemaless.** Entities have types, relations have types, attributes have types. Inheritance is first-class. Rules let you derive new facts from existing ones at query time.

The replacement for Kuzu (archived 2025-10-10) and Cozo (last commit December 2024, going stale).

## What to steal for EMA

### 1. Schema-as-code

EMA's intents/actors/phase_transitions are begging for typed graph semantics that SQLite can't express. TypeDB's schema looks like:

```typeql
define
  entity actor,
    abstract,
    owns name,
    owns slug,
    plays membership:member;

  entity human sub actor;
  entity agent sub actor,
    owns model,
    owns capabilities;

  entity intent,
    owns title,
    owns status,
    plays parentage:parent,
    plays parentage:child;

  relation parentage,
    relates parent,
    relates child;

  relation membership,
    relates space,
    relates member,
    owns role;
```

The schema catches "you linked an execution to an agent that isn't an actor" at insert time, not query time.

### 2. Rule inference

```typeql
rule blocked-by-incomplete-dependency:
  when {
    $intent isa intent, has status "active";
    (parent: $intent, child: $dep) isa dependency;
    $dep isa intent, has status $s;
    not { $s == "completed"; };
  } then {
    $intent has computed-status "blocked";
  };
```

EMA's "intent X is blocked because dependency Y is incomplete" can be a derived fact, not a denormalized field. Inference runs at query time.

### 3. TypeQL — its own query language

Not Cypher. Not Datalog. Not SQL. Worth the learning cost for the type-system + inference combo. Examples:

```typeql
match
  $intent isa intent, has title $title;
  $intent has computed-status "blocked";
  (parent: $intent, child: $dep) isa dependency;
  $dep has title $dep_title;
get $title, $dep_title;
```

### 4. Single-binary embedded mode

TypeDB ships as a single embedded binary. Same deployment story as SQLite (no separate server), with graph + inference capabilities.

## What it changes about the blueprint

| Canon doc | What changes |
|---|---|
| `[[DEC-001]]` graph engine future escape valve | TypeDB replaces Cozo as the named alternative for "if the Object Index bottlenecks" |
| `vapps/CATALOG.md` Vault | Future "rule inference" features have a concrete substrate |
| `[[canon/specs/EMA-V1-SPEC]]` ontology | Schemas can become typed graph schemas, not just YAML validation |

## Gaps surfaced

- **The Kuzu archive means Round 1's graph-DB recommendation is dead.** Cozo's last commit was December 2024 — also effectively dead. TypeDB is the only still-alive option that does inference + schema + graph.
- **EMA has no derived-state concept.** "blocked" is currently a manual status field. Rule inference would compute it from dependency state automatically.

## Notes

- TypeQL is its own DSL. Not Cypher or Datalog. Learning cost is real (~1 week to feel productive). For EMA's intent schematic, the rule engine alone (derive "blocked" from task dependencies) is worth the ramp.
- MPL-2.0 license is embeddable.
- Active development with quarterly releases.
- **Don't pick this for v1.** The SQLite Object Index per `[[DEC-001]]` is sufficient. Reach for TypeDB only if and when scale demands it.

## Connections

- `[[research/knowledge-graphs/_MOC]]`
- `[[research/knowledge-graphs/cozodb-cozo]]` — predecessor that's going stale
- `[[research/knowledge-graphs/silverbulletmd-silverbullet]]` — current Object Index pattern (the v1 choice)
- `[[DEC-001]]` — graph engine decision (escape valve target)
- `[[canon/specs/EMA-V1-SPEC]]` §4 ontology

#research #knowledge-graphs #signal-S #typedb #graph-db #inference #typeql
