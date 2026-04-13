---
id: MOC-knowledge-graphs
type: moc
layer: research
title: "Knowledge Graphs — Map of Content"
status: active
created: 2026-04-12
updated: 2026-04-12
author: system
tags: [moc, research, knowledge-graphs]
connections:
  - { target: "[[research/_moc/RESEARCH-MOC]]", relation: references }
  - { target: "[[DEC-001]]", relation: references }
---

# Knowledge Graphs — Map of Content

> Repos covering Obsidian-style markdown PKM, typed-link systems, query DSLs, web-renderer pipelines, graph databases, and AI-PKM tools. **The primary source for `[[DEC-001]]` graph engine decision.**

## Tier S

| Repo | Pattern |
|---|---|
| [[research/knowledge-graphs/silverbulletmd-silverbullet\|silverbullet]] | Object Index over markdown — primary source for [[DEC-001]] |
| [[research/knowledge-graphs/iwe-org-iwe\|iwe]] | Agent-facing API: MCP + LSP + CLI verbs |
| [[research/knowledge-graphs/SkepticMystic-breadcrumbs\|breadcrumbs]] | Typed-edge Graph Builders model |
| [[research/knowledge-graphs/jackyzha0-quartz\|quartz]] | Web frontend — research layer renderer |
| [[research/knowledge-graphs/typedb-typedb\|typedb]] | Future graph DB escape valve (live) |
| [[research/knowledge-graphs/hedgedoc-hedgedoc\|hedgedoc]] | Realtime collaborative markdown |

## Tier A

| Repo | Pattern |
|---|---|
| [[research/knowledge-graphs/blacksmithgu-obsidian-dataview\|dataview]] | DQL query language shape |
| [[research/knowledge-graphs/logseq-logseq\|logseq]] | Cautionary tale — DataScript pivot |

## Tier B

| Repo | Pattern |
|---|---|
| [[research/knowledge-graphs/foambubble-foam\|foam]] | Minimum viable file-watcher → graph reference |
| [[research/knowledge-graphs/zk-org-zk\|zk]] | Notebook housekeeping CLI verbs |
| [[research/knowledge-graphs/squidfunk-mkdocs-material\|mkdocs-material]] | Canon-layer renderer alternative |
| [[research/knowledge-graphs/cozodb-cozo\|cozo]] | Going stale — replaced by TypeDB |
| [[research/knowledge-graphs/reorproject-reor\|reor]] | Auto-link suggestion via embeddings (stale) |

## Cross-cutting takeaways

1. **`[[DEC-001]]` is locked**: derived Object Index over markdown (SilverBullet pattern) + DQL query DSL (Dataview shape) + typed edges (Breadcrumbs grammar) + iwe agent API + Quartz web render + TypeDB future escape valve.
2. **Cozo is going stale.** TypeDB is the live alternative for the future graph-DB target. Kuzu is archived — do not use.
3. **The Object Index pattern beats raw graph DBs** for EMA's scale. SilverBullet, iwe, Foam, zk all prove it.
4. **Logseq is the cautionary tale**: pure markdown hits scale limits, but the migration path is clean if you start with the right primitives.
5. **Two web renderers serve different audiences**: Quartz for research-layer garden aesthetic, MkDocs Material for canon-layer structured docs.

## Connections

- [[research/_moc/RESEARCH-MOC]]
- [[DEC-001]] — graph engine decision
- [[canon/specs/EMA-GENESIS-PROMPT]] §5

#moc #research #knowledge-graphs
