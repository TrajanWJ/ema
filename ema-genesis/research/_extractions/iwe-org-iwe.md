---
id: EXTRACT-iwe-org-iwe
type: extraction
layer: research
category: knowledge-graphs
title: "Source Extractions — iwe-org/iwe"
status: active
created: 2026-04-12
updated: 2026-04-12
author: A1
clone_path: "../_clones/iwe-org-iwe/"
source:
  url: https://github.com/iwe-org/iwe
  sha: fbaeaf7
  clone_date: 2026-04-12
  depth: shallow-1
  size_mb: 7
tags: [extraction, knowledge-graphs, iwe, rust, graph, lsp, cli, primary-port-target]
connections:
  - { target: "[[research/knowledge-graphs/iwe-org-iwe]]", relation: source_of }
  - { target: "[[research/_clones/INDEX]]", relation: references }
  - { target: "[[DEC-001]]", relation: informs }
---

# Source Extractions — iwe-org/iwe

> Primary port target for the **arena-backed markdown graph + CLI verbs + LSP/MCP bridge** pattern. IWE represents every markdown file as a linked-list structure in a single `Arena`, maintains an append-only `RefIndex` for backlinks, and exposes verbs (retrieve, find, rename, delete, extract, inline, normalize, tree, squash) as a CLI that's orthogonal to an LSP server. The key cross-pollination signal for EMA: **parallel FS walk → parse → build arena → index → expose via CLI/LSP/MCP from one core library.**

## Clone metadata

| Field | Value |
|---|---|
| URL | https://github.com/iwe-org/iwe |
| Clone depth | --depth=1 shallow |
| Clone date | 2026-04-12 |
| Clone size | ~7 MB |
| Language | Rust (workspace with 4 crates) |
| License | Apache-2.0 |
| Key commit SHA | fbaeaf7 |

## Install attempt

- **Attempted:** no
- **Command:** would be `cargo build --release` in `/home/trajan/Projects/ema/ema-genesis/research/_clones/iwe-org-iwe/`
- **Result:** skipped
- **If skipped, why:** Cold `cargo build` on this workspace (4 crates, rayon, tokio-adjacent deps, tree-sitter, lsp-server, pulldown-cmark, serde, fuzzy-matcher, uuid, ignore) would compile ~300 crates. Under the "trivially safe + <30s" rule this is a skip. Also, we're extracting architecture, not runtime behavior — the source files are the source of truth.

## Run attempt

- **Attempted:** no
- **Result:** skipped
- **If skipped, why:** see install. No binary to run without the build.

## Key files identified

Ordered by porting priority:

1. `crates/liwe/src/graph.rs` — **core** `Graph` struct + `build_key_and`/`from_markdown`/`from_state` + `GraphContext` trait
2. `crates/liwe/src/graph/index.rs` — `RefIndex` recursive `index_node` walker (block_references + inline_references)
3. `crates/liwe/src/model.rs` — core types (`Key`, `NodeId`, `LineId`, `State`) and `Key` path semantics
4. `crates/liwe/src/model/node.rs` — `Node` enum with Document/Section/Leaf/Reference/Table variants
5. `crates/liwe/src/fs.rs` — parallel markdown walk using `ignore::WalkBuilder` (git-aware)
6. `crates/liwe/src/find.rs` — `DocumentFinder` + `FindOptions` + fuzzy-matcher ranking
7. `crates/liwe/src/retrieve.rs` — `DocumentReader` + `RetrieveOptions` (depth/context/links/backlinks/exclude) for context assembly
8. `crates/liwe/src/operations/rename.rs` — `rename` op producing `Changes` list (pure, returns diff not mutation)
9. `crates/liwe/src/operations/changes.rs` — `Changes` data model (create/update/remove)
10. `crates/iwe/src/main.rs` — CLI subcommands in clap (Init/New/Retrieve/Find/Normalize/Tree/Squash/Export/Stats/Rename/Delete/Extract/Inline)
11. `crates/iwes/src/router.rs` — LSP message router on top of the same core Graph
12. `crates/liwe/src/operations/extract.rs` — section extraction into a new document (256 lines, meaty)

## Extracted patterns

### Pattern 1: Arena-backed graph with RefIndex as a parallel projection

**Files:**
- `crates/liwe/src/graph.rs:45-58` — `Graph` struct definition
- `crates/liwe/src/graph.rs:84-237` — lifecycle methods (`new`, `build_key_and`, `from_markdown`, `update_key`)
- `crates/liwe/src/graph/index.rs:7-11` — `RefIndex` struct (block + inline tables)
- `crates/liwe/src/graph/index.rs:49-152` — `index_node` recursive walker

**Snippet (verbatim from source):**
```rust
// crates/liwe/src/graph.rs:45-58
#[derive(Clone, Default)]
pub struct Graph {
    arena: Arena,
    index: RefIndex,
    keys: HashMap<Key, NodeId>,
    nodes_map: HashMap<Key, NodesMap>,
    global_nodes_map: HashMap<NodeId, LineRange>,
    sequential_keys: bool,
    keys_to_ref_text: HashMap<Key, String>,
    markdown_options: MarkdownOptions,
    metadata: HashMap<Key, String>,
    content: Documents,
    frontmatter_document_title: Option<String>,
}
```

```rust
// crates/liwe/src/graph/index.rs:7-47
#[derive(Default, Clone)]
pub struct RefIndex {
    block_references: HashMap<Key, HashSet<NodeId>>,
    inline_references: HashMap<Key, HashSet<NodeId>>,
}

impl RefIndex {
    pub fn new() -> RefIndex {
        RefIndex::default()
    }

    pub fn merge(&mut self, other: RefIndex) {
        for (key, set) in other.block_references {
            self.block_references.entry(key).or_default().extend(set);
        }
        for (key, set) in other.inline_references {
            self.inline_references.entry(key).or_default().extend(set);
        }
    }

    pub fn get_block_references_to(&self, key: &Key) -> Vec<NodeId> {
        self.block_references
            .get(key)
            .map(|set| set.iter().cloned().collect())
            .unwrap_or_default()
    }

    pub fn get_inline_references_to(&self, key: &Key) -> Vec<NodeId> {
        self.inline_references
            .get(key)
            .map(|set| set.iter().cloned().collect())
            .unwrap_or_default()
    }
    // ...
}
```

```rust
// crates/liwe/src/graph/index.rs:49-89
pub fn index_node(&mut self, graph: &Graph, node_id: NodeId) {
    match graph.graph_node(node_id) {
        GraphNode::Reference(reference) => {
            self.block_references
                .entry(reference.key().clone())
                .or_default()
                .insert(reference.id());
            if let Some(child_id) = reference.next_id() {
                self.index_node(graph, child_id);
            }
        }
        GraphNode::Section(section) => {
            for key in graph.get_line(section.line_id()).ref_keys() {
                self.inline_references
                    .entry(key.clone())
                    .or_default()
                    .insert(section.id());
            }
            // ...
        }
        // ... Leaf, Document, Quote, Lists, Table variants
    }
}
```

**What to port to EMA:**
EMA's `@ema/core` should own a `Graph` value that mirrors this structure. The load-bearing insight is the **two-level separation**:
1. **Arena** — all nodes stored in a flat `Vec<GraphNode>` with `NodeId: u64` stable handles. No pointer ownership issues.
2. **RefIndex** — a secondary projection of "which nodes reference this key" computed by walking the arena. Cheap to rebuild, cheap to merge.

The `RefIndex::merge` method at `index.rs:18-25` is how IWE updates a single file without rebuilding the full index: build a local `RefIndex` from the re-indexed file, then `merge` it into the global one. This is the right shape for incremental reindex.

Lands in:
- `packages/core/src/graph/arena.ts` — a flat `Map<NodeId, GraphNode>` (TypeScript doesn't get zero-cost Vec<...> but Map is good enough).
- `packages/core/src/graph/ref-index.ts` — two `Map<Key, Set<NodeId>>` for block refs and inline refs; add a `merge(other)` method.
- `packages/core/src/graph/graph.ts` — the container class owning `arena`, `index`, `keys`, `content`, and exposing the public API.

**Adaptation notes:**
- TypeScript doesn't give you zero-cost `Arc<String>` sharing like Rust, so `Key` becomes a plain `string`. That's fine — EMA's vault is small enough.
- Don't try to port the `GraphPatch` trait — TypeScript generics get ugly. Just expose `graph.addDocument(key, content)` and `graph.updateDocument(key, content)` as methods.
- Skip `Arena::delete_branch` at this stage — just rebuild the affected subtree. IWE does it because Rust can't easily tombstone in a shared `Vec`, but TypeScript `Map.delete` is cheap.
- Port the `RefIndex::merge` pattern **exactly** — it's the cleanest incremental-update mechanism I've seen.

### Pattern 2: Split block references vs inline references

**Files:**
- `crates/liwe/src/graph/index.rs:9-11` — the two index fields
- `crates/liwe/src/graph/index.rs:49-60` — `Reference` node case (block ref)
- `crates/liwe/src/graph/index.rs:61-75` — `Section` case (inline refs in heading lines)
- `crates/liwe/src/graph.rs:444-474` — `get_block_references_to` and `get_inline_references_to`

**Snippet (verbatim from source):**
```rust
// crates/liwe/src/graph/index.rs:49-75
GraphNode::Reference(reference) => {
    self.block_references
        .entry(reference.key().clone())
        .or_default()
        .insert(reference.id());

    if let Some(child_id) = reference.next_id() {
        self.index_node(graph, child_id);
    }
}
GraphNode::Section(section) => {
    for key in graph.get_line(section.line_id()).ref_keys() {
        self.inline_references
            .entry(key.clone())
            .or_default()
            .insert(section.id());
    }
    // ... recurse into children
}
```

```rust
// crates/liwe/src/graph.rs:444-474
pub fn get_block_references_to(&self, key: &Key) -> Vec<NodeId> {
    // remove empty node ids
    self.index
        .get_block_references_to(key)
        .iter()
        .filter(|id| !self.graph_node(**id).is_empty())
        .cloned()
        .collect()
}

pub fn get_block_references_in(&self, key: &Key) -> Vec<NodeId> {
    self.maybe_key(key)
        .map(|node| {
            node.get_all_sub_nodes()
                .into_iter()
                .filter(|id| !self.graph_node(*id).is_empty())
                .filter(|id| self.graph_node(*id).is_ref())
                .collect()
        })
        .unwrap_or_default()
}

pub fn get_inline_references_to(&self, key: &Key) -> Vec<NodeId> {
    self.index
        .get_inline_references_to(key)
        .iter()
        .filter(|id| !self.graph_node(**id).is_empty())
        .cloned()
        .collect()
}
```

**What to port to EMA:**
This is a subtle but massively useful distinction. IWE separates:
- **Block references** — a link that is **the entire content** of a list item or block, e.g. `- [[Alpha]]`. These are structural — if `[[Alpha]]` is a block ref in `Beta.md`, then `Alpha` is **inlined into `Beta`'s structure**, so `Beta` conceptually "contains" `Alpha`. The `retrieve` verb follows block refs downward for context.
- **Inline references** — a link **inside** a paragraph or heading, e.g. `See also [[Alpha]] for more`. These are associative — they don't imply containment.

EMA needs this distinction for agent context assembly. When an agent asks "give me the context for `BOOTSTRAP-v0.2`", you want to follow block refs to get the contained content (the actual plan) but only list inline refs as "related" (not inline them into the context). Without the split you either over-fetch or under-fetch.

**Adaptation notes:**
- EMA's markdown parser must distinguish "link that is the sole child of a list item" vs "link inside a paragraph". Using `mdast`, check if the parent is `listItem` and the listItem has exactly one child which is the link. If yes → block ref. Otherwise → inline ref.
- The pattern `.filter(|id| !self.graph_node(**id).is_empty())` at `graph.rs:450` is critical — empty nodes survive deletion as tombstones but must be filtered from user-visible results. EMA's `Graph.getBacklinks()` must do the same.
- Store the two indices separately, not as a single `{type, nodeId}` union — you want to query "all block-pointers to `X`" and "all inline-pointers to `X`" independently without filtering.

### Pattern 3: CLI verbs are pure functions producing a `Changes` diff

**Files:**
- `crates/liwe/src/operations/changes.rs:1-84` — `Changes` data model
- `crates/liwe/src/operations/rename.rs:11-46` — the entire rename operation
- `crates/iwe/src/main.rs:47-62` — CLI subcommand enum
- `crates/iwe/src/main.rs:480` — dispatch to command handlers

**Snippet (verbatim from source):**
```rust
// crates/liwe/src/operations/rename.rs:11-46
pub fn rename(graph: &Graph, old_key: &Key, new_key: &Key) -> Result<Changes, OperationError> {
    if graph.get_node_id(old_key).is_none() {
        return Err(OperationError::NotFound(old_key.clone()));
    }
    if graph.get_node_id(new_key).is_some() {
        return Err(OperationError::AlreadyExists(new_key.clone()));
    }

    let mut result = Changes::default();
    let options = graph.markdown_options();

    let block_refs = graph.get_block_references_to(old_key);
    let inline_refs = graph.get_inline_references_to(old_key);

    let affected: HashSet<Key> = block_refs
        .into_iter()
        .chain(inline_refs)
        .map(|node_id| graph.key_of(node_id))
        .filter(|k| k != old_key)
        .collect();

    for affected_key in affected.iter().sorted() {
        let tree = graph.collect(affected_key);
        let updated = tree.change_key(old_key, new_key);
        let markdown = updated.iter().to_markdown(&affected_key.parent(), &options);
        result.add_update(affected_key.clone(), markdown);
    }

    let tree = graph.collect(old_key);
    let updated_tree = tree.change_key(old_key, new_key);
    let markdown = updated_tree.iter().to_markdown(&new_key.parent(), &options);
    result.add_create(new_key.clone(), markdown);
    result.add_remove(old_key.clone());

    Ok(result)
}
```

```rust
// crates/iwe/src/main.rs:47-62
#[derive(Debug, Subcommand)]
enum Command {
    Init(Init),
    New(New),
    Retrieve(Retrieve),
    Find(Find),
    Normalize(Normalize),
    Tree(TreeArgs),
    Squash(Squash),
    Export(Export),
    Stats(Stats),
    Rename(Rename),
    Delete(Delete),
    Extract(Extract),
    Inline(Inline),
}
```

**What to port to EMA:**
The pattern is: **CLI verbs don't mutate the graph**. They take a `&Graph` and return a `Changes` object — a list of `(Create | Update | Remove)(Key, Content)` operations. The CLI main then either prints those (dry-run) or applies them to disk.

This maps perfectly to EMA's canon verbs. EMA should implement:
- `ema graph rename <old> <new>` — pure, prints diff, `--apply` flag commits.
- `ema graph delete <key>` — pure, prints diff of backlinks that need rewriting.
- `ema graph extract <key> --section "Foo"` — pure, creates new file + updates source with a link.
- `ema graph inline <key> --ref <target>` — pure, merges target content into source.

Lands in:
- `packages/core/src/operations/rename.ts` — mirror the function signature: `(graph: Graph, oldKey: string, newKey: string) => Changes`
- `packages/core/src/operations/delete.ts`, `extract.ts`, `inline.ts` — same shape
- `packages/core/src/operations/changes.ts` — the `Changes` class
- `packages/cli/src/commands/graph/*.ts` — thin wrappers that print or apply

**Adaptation notes:**
- Use `Result<Changes, OperationError>` equivalent — a discriminated union `{ ok: true, changes: Changes } | { ok: false, error: OperationError }` instead of throwing. IWE's error cases (NotFound, AlreadyExists) are exactly the ones EMA needs.
- Port the operation-then-apply split ruthlessly. It makes `--dry-run` trivially `console.log(changes)` and `--apply` trivially `applyToDisk(changes)`.
- For agent usage, expose `ema graph rename old new --json` that writes the `Changes` structure as JSON so agents can plan without touching disk.
- IWE's `extract.rs` is 256 lines — that's the non-trivial operation. When porting, read it carefully; section-extraction has edge cases around nested headings.

### Pattern 4: Context assembly with depth + context + backlinks

**Files:**
- `crates/liwe/src/retrieve.rs:44-52` — `RetrieveOptions` shape
- `crates/liwe/src/retrieve.rs:63-101` — `retrieve` / `retrieve_many`
- `crates/liwe/src/retrieve.rs:103-143` — `collect_document_keys` combines depth/context/links
- `crates/liwe/src/retrieve.rs:240-273` — `build_document_output`

**Snippet (verbatim from source):**
```rust
// crates/liwe/src/retrieve.rs:29-52
#[derive(Debug, Clone, Serialize)]
pub struct DocumentOutput {
    pub key: String,
    pub title: String,
    pub content: String,
    pub parent_documents: Vec<ParentDocumentInfo>,
    pub child_documents: Vec<ChildDocumentInfo>,
    pub backlinks: Vec<BacklinkInfo>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RetrieveOutput {
    pub documents: Vec<DocumentOutput>,
}

#[derive(Debug, Clone, Default)]
pub struct RetrieveOptions {
    pub depth: u8,
    pub context: u8,
    pub links: bool,
    pub backlinks: bool,
    pub exclude: HashSet<Key>,
    pub no_content: bool,
}
```

```rust
// crates/liwe/src/retrieve.rs:103-143
fn collect_document_keys(&self, key: &Key, options: &RetrieveOptions) -> Vec<Key> {
    let mut result = vec![key.clone()];

    if options.depth > 0 {
        let expanded_keys = self.get_expanded_keys(key, options.depth);
        for expanded_key in expanded_keys {
            if expanded_key != *key {
                result.push(expanded_key);
            }
        }
    }

    if options.context > 0 {
        let context_keys = self.collect_context(key, options.context);
        for context_key in context_keys {
            if context_key != *key && !result.contains(&context_key) {
                result.push(context_key);
            }
        }

        if options.depth > 0 {
            let sub_doc_parents = self.collect_sub_document_parents(key, options.context);
            for parent_key in sub_doc_parents {
                if parent_key != *key && !result.contains(&parent_key) {
                    result.push(parent_key);
                }
            }
        }
    }

    if options.links {
        let linked_keys = self.get_inline_referenced_keys(key);
        for linked_key in linked_keys {
            if linked_key != *key && !result.contains(&linked_key) {
                result.push(linked_key);
            }
        }
    }

    result
}
```

**What to port to EMA:**
**This is the context assembler EMA needs.** The `depth`, `context`, `links`, `backlinks`, `exclude`, `no_content` option set is exactly how an agent should be asking the vault: "Give me this node, plus N levels of block-ref descendants, plus M levels of parent context, plus optional inline-linked documents, optionally with backlinks listed, optionally metadata-only".

This is the retrieval API that bridges to EMA's agent runtime. When an agent wants to "load BOOTSTRAP-v0.2", it should be able to call `retrieve([BOOTSTRAP-v0.2], {depth: 2, context: 1, backlinks: true})` and get a ready-to-prompt context bundle.

Lands in:
- `packages/core/src/retrieve/retrieve.ts` — `DocumentReader` class with `retrieve(key, options): RetrieveOutput`
- `packages/core/src/retrieve/types.ts` — `RetrieveOptions`, `DocumentOutput`, `BacklinkInfo`
- `packages/agent-runtime/src/context.ts` — thin layer that calls retrieve + formats for a Claude/Codex prompt

**Adaptation notes:**
- Port the exact field names — `depth`, `context`, `links`, `backlinks`, `exclude`, `no_content`. They're documented via the CLI help text.
- The `seen_keys` dedup in `retrieve_many:82-98` is important — without it, diamond-shaped link patterns produce duplicate docs in output.
- `no_content: true` mode (returns metadata only) is useful for cheap "what would this return?" calls in agent tool loops.
- Consider adding a `max_tokens` option on top of IWE's model — EMA cares about context window budgets, IWE doesn't.
- The `section_path` helper at `retrieve.rs:363-385` walks up the tree collecting parent section titles as a breadcrumb. Port this — it's useful for both UI and agent prompts.

### Pattern 5: Parallel markdown walk with `ignore` crate (git-aware)

**Files:**
- `crates/liwe/src/fs.rs:13-46` — `new_for_path` walks a directory tree with `WalkBuilder`
- `crates/liwe/src/graph.rs:347-402` — `from_state` builds the graph in parallel using `rayon`

**Snippet (verbatim from source):**
```rust
// crates/liwe/src/fs.rs:13-46
pub fn new_for_path(base_path: &PathBuf) -> State {
    if !base_path.exists() {
        error!("path doesn't exist");
        return State::new();
    }

    WalkBuilder::new(base_path)
        .follow_links(false)
        .hidden(true)
        .require_git(false)
        .build()
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();

            if !path.is_file() || path.extension().is_none_or(|ext| ext != "md") {
                return None;
            }

            let relative_path = path.strip_prefix(base_path).ok()?;
            let key = if let Some(parent) = relative_path.parent() {
                if parent == std::path::Path::new("") {
                    to_file_name(path)
                } else {
                    format!("{}/{}", parent.to_string_lossy(), to_file_name(path))
                }
            } else {
                to_file_name(path)
            };

            fs::read_to_string(path).ok().map(|content| (key, content))
        })
        .collect()
}
```

```rust
// crates/liwe/src/graph.rs:347-402
pub fn from_state(
    state: State,
    sequential_ids: bool,
    markdown_options: MarkdownOptions,
    frontmatter_document_title: Option<String>,
) -> Self {
    let mut graph = Graph::new_with_options(markdown_options.clone());
    graph.set_sequential_keys(sequential_ids);
    graph.frontmatter_document_title = frontmatter_document_title;

    let reader = MarkdownReader::new();

    let blocks = state
        .iter()
        .sorted_by(|a, b| a.0.cmp(b.0))
        .collect_vec()
        .par_iter()   // <-- rayon parallel parse
        .map(|(k, v)| {
            debug!("parsing content, key={}", k);
            (Key::name(k), reader.document(v, &markdown_options))
        })
        .collect::<Vec<_>>();

    for (key, document) in blocks.into_iter() {
        if let Some(meta) = document.metadata.clone() {
            graph.metadata.insert(key.clone(), meta);
        } else {
            graph.metadata.remove(&key);
        }

        let nodes_map =
            SectionsBuilder::new(&mut graph.build_key(&key), &document.blocks, &key)
                .nodes_map();
        graph.nodes_map.insert(key.clone(), nodes_map.clone());
        graph.global_nodes_map.extend(nodes_map);
    }

    let mut index = RefIndex::new();
    for node in graph.arena.nodes() {
        index.index_node(&graph, node.id());
    }
    graph.index = index;

    for (key, _) in graph.keys.clone() {
        graph
            .extract_ref_text(&key)
            .map(|text| graph.keys_to_ref_text.insert(key.clone(), text));
    }

    graph.content = state
        .iter()
        .map(|(k, v)| (Key::name(k), v.clone()))
        .collect();

    graph
}
```

**What to port to EMA:**
Two separate good ideas:

1. **Use `ignore`-style git-aware walking.** The crate respects `.gitignore`, `.ignore`, and hidden-file rules out of the box. EMA's vault scanner needs the same — the Node.js equivalent is `globby` with `{ gitignore: true }` or `fast-glob` + manual `.gitignore` parsing. Choose `globby` for simplicity.

2. **Parse first (parallel), build graph second (sequential).** The key insight in `from_state:359-368` is that the parallel step only produces `(Key, Document)` tuples — independent, no shared state. Then the sequential step inserts them into the arena. This avoids mutex contention on the arena.

Lands in:
- `packages/core/src/fs/walk.ts` — uses `globby` or `fast-glob` with gitignore support. Returns `Map<string, string>` of path → content.
- `packages/core/src/graph/from-state.ts` — the two-phase build: parallel `Promise.all(entries.map(parseMarkdown))` then sequential `for (const [key, doc] of parsed) graph.insertFromParsed(key, doc)`.

**Adaptation notes:**
- Node.js doesn't have rayon, but `Promise.all` over a CPU-bound JS parse is still slow because of the single event loop. For vaults under ~5000 files, `Promise.all` is fine. For larger vaults, consider `worker_threads` or a streaming build.
- Don't worry about `par_iter` during initial port — ship the sync `for await` version first, optimize later.
- Port the **indexing-after-all-inserts** pattern exactly: build the arena first, THEN walk all nodes calling `index_node`. Doing index inserts incrementally during arena insert causes cache invalidation and messy ordering.
- Path-to-key conversion at `fs.rs:32-41` is worth copying: relative path + parent + filename-without-extension. EMA's `Key` should be "relative path without `.md`".

### Pattern 6: Single core library, multiple front-ends (CLI, LSP, MCP)

**Files:**
- `crates/iwe/Cargo.toml` (the CLI binary) depends on `liwe`
- `crates/iwes/Cargo.toml` (the LSP server) depends on `liwe`
- `crates/iwec/Cargo.toml` (MCP server for agents) depends on `liwe`
- `crates/liwe/src/lib.rs` — the core library all three consume
- `crates/iwes/src/router.rs:70-85` — LSP server initializes a `Server` wrapping `liwe::Graph`

**Snippet (verbatim from source):**
```rust
// crates/iwes/src/router.rs:35-85
pub struct ServerConfig {
    pub base_path: String,
    pub state: State,
    pub sequential_ids: Option<bool>,
    pub configuration: Configuration,
    pub lsp_client: LspClient,
}

#[derive(Clone)]
pub struct Router {
    server: Arc<Server>,
    sender: Sender<Message>,
}

impl Router {
    // ...

    pub fn new(sender: Sender<Message>, config: ServerConfig) -> Self {
        debug!(
            "initializing LSP database at {}, with {} docs",
            config.base_path,
            config.state.len()
        );

        let router = Self {
            server: Arc::new(Server::new(config)),
            sender,
        };

        debug!("initializing LSP database complete");

        router
    }
}
```

**What to port to EMA:**
IWE is organized as one library (`liwe`) and three thin binaries (`iwe` CLI, `iwes` LSP, `iwec` MCP). All three depend on the same core graph. This is **exactly** EMA's monorepo model: `@ema/core` (the library), `@ema/cli` (the CLI), `@ema/electron` (desktop host), `@ema/mcp` (MCP server), `@ema/lsp` (maybe a future LSP server for Zed/Helix integration).

The pattern EMA should copy:
- One `Graph` type, one `Config` type, one `State` alias (which is just `Map<Key, Content>` in TS).
- All mutations go through core verbs (`rename`, `delete`, `extract`, `inline`, `update_document`).
- CLI, LSP, MCP are all thin routing layers on top of the same core API. None of them contain graph logic.

Lands in:
- `packages/core/src/index.ts` — exports `Graph`, `Config`, `State`, all operations, all retrieval functions.
- `packages/cli/src/index.ts` — clap-equivalent (use `commander` or `citty`) routing to core.
- `packages/mcp-server/src/index.ts` — MCP routing to core (each tool wraps a core function).
- `packages/electron/src/ipc.ts` — IPC routing to core (renderer calls forwarded to main-process core).

**Adaptation notes:**
- Don't let per-frontend logic creep into `@ema/core`. The moment `@ema/core/lsp.ts` exists, the architecture has rotted.
- Each frontend should have its own config, but they all hand a `Config` object into core at boot. No frontend configures the graph directly.
- `crates/iwes/src/router.rs:70-85` shows that the LSP server takes a preloaded `State` — it doesn't reload on boot. EMA's LSP/MCP servers should similarly take a fully-built `Graph` from the Electron main process, not re-parse.
- Consider adopting IWE's three-binary naming: `ema` (CLI), `emas` (LSP/MCP server), `emad` (daemon). Or just `ema` for everything with subcommands — up to taste.

## Gotchas found while reading

- **`index_node` is recursive, not iterative.** At `graph/index.rs:49-152`, every branch of the `match` calls `self.index_node(graph, child_id)` recursively. On deeply nested markdown lists (think `- - - - - - - item`), this can blow the stack. Rust's default 8MB stack usually survives, but a Node.js/V8 port with a 1MB default stack might not. Port as iterative with a worklist to be safe.
- **`from_state` wipes the index and rebuilds from scratch** at `graph.rs:384-388`. This is called on every `ServerConfig` init. There's no incremental load path — if you want to update one file, use `update_key` (which does a single-file delete-and-rebuild). This is fine for a vault of 1000 files but gets slow at 10000. Plan for incremental.
- **`update_document` is actually delete + re-insert** via `update_key:325-332` + `from_markdown`. If you hold `NodeId` references to a document across an update, they're invalidated. IWE doesn't expose NodeIds to the CLI for this reason — only keys. EMA should follow suit: internal IDs for internal use, keys for external (agent) use.
- **`Arena::delete_branch` at `graph.rs:131` tombstones but doesn't reclaim.** Long-lived daemon processes accumulate dead nodes. IWE doesn't have a compaction step because it relies on frequent restarts via the LSP lifecycle. EMA's daemon should either (a) compact on some schedule or (b) full-rebuild on a memory threshold.
- **Frontmatter title lookup is configurable** at `graph.rs:252-257` — the key `frontmatter_document_title` determines which frontmatter field is treated as the doc title. EMA should hardcode this to `title` to avoid config bloat; users can work around it.
- **Random key generation** at `graph.rs:604-629` creates 8-char alphanumeric lowercase IDs, retrying until unique. This is fine for `iwe new` but agents may want deterministic content-hash IDs. EMA should expose both strategies.
- **`Key` uses `Arc<String>` for cheap cloning** at `model.rs:31-34`. TypeScript `string` is already cheap to clone (CoW), so this is not a porting concern — but be aware that IWE's `Key::clone()` is O(1) and TypeScript `.slice()`-based copies are not.
- **`build_key_and` merges indices via `RefIndex::new(); index_node; self.index.merge(index)`** at `graph.rs:232-234`. This mini-pattern is the incremental-update idiom — it builds a local index for just the new subtree, then merges. Critical for avoiding full reindexes on every file update.
- **`get_block_references_to` filters empty nodes** at `graph.rs:447-451`. If you port naively without the `is_empty` filter, orphaned arena entries leak into backlinks. Port the filter.
- **IWE has zero runtime async** — it's fully synchronous Rust. The LSP server uses `crossbeam_channel` for message dispatch, but the graph operations block. TypeScript is async-by-default which will change the API shape — consider whether core functions should return sync or async. Recommend sync core + async wrappers at the IO layer.
- **`fs::new_for_path` reads files synchronously** at `fs.rs:43` (`fs::read_to_string`). TypeScript port should do `await fs.readFile(...)` in parallel via `Promise.all`. Use `p-map` if you want backpressure.
- **Section-path walking in `find.rs:211-231` and `retrieve.rs:363-385` is duplicated** — both walk up from a node collecting parent section titles. In an EMA port, extract this into a single `getSectionPath(graph, nodeId)` helper to avoid drift.

## Port recommendation

Concrete next steps for EMA's port:

1. **Start with `packages/core/src/graph/`** as these files (in this order):
   - `types.ts` — port `Key` (just `string`), `NodeId` (just `number`), `State` (`Map<string, string>`), `LineRange` (`[number, number]`).
   - `arena.ts` — a `Map<NodeId, GraphNode>` with `next_node_id()`, `set_node(id, node)`, `delete_branch(id)`.
   - `ref-index.ts` — two `Map<string, Set<NodeId>>` for block and inline refs, with `merge(other)`, `indexNode(graph, nodeId)`.
   - `graph.ts` — the container class. Port the public API: `get_document`, `insert_document`, `update_document`, `remove_document`, `from_markdown`, `to_markdown`, `get_block_references_to`, `get_inline_references_to`, `from_state`.
2. **Then port the operations** as `packages/core/src/operations/`:
   - `changes.ts` — `Changes` class + `OperationError` enum
   - `rename.ts`, `delete.ts`, `extract.ts`, `inline.ts` — pure functions producing `Changes`
3. **Then port retrieve/find** as `packages/core/src/retrieve/` and `packages/core/src/find/`:
   - Copy `RetrieveOptions` field-by-field
   - Copy `FindOptions` field-by-field
   - Port fuzzy-matcher via `fuzzy-finder` npm package (`fzy-js` or `fuse.js`)
4. **Then ship `packages/cli/src/`** with `commander` or `citty`:
   - Mirror IWE's subcommand names: `init`, `new`, `retrieve`, `find`, `tree`, `rename`, `delete`, `extract`, `inline`, `normalize`, `stats`
   - Each command is a 10-20 line wrapper: parse args, load graph, call core, print output
5. **Only after all of the above**, wire `packages/mcp-server/` to re-expose the same verbs as MCP tools.
6. **Dependency decisions**:
   - Use `remark` + `unified` for markdown parsing (the iwe equivalent is `pulldown-cmark`)
   - Use `globby` with `{ gitignore: true }` for the walk (the iwe equivalent is `ignore::WalkBuilder`)
   - Use `fuse.js` for fuzzy matching (the iwe equivalent is `fuzzy-matcher::SkimMatcherV2`)
   - Skip `rayon` — use `Promise.all` for parallel parse, sequential for arena insert
   - Use `immer` if you want immutable graph snapshots, but vanilla Map-based mutation is fine for v1
7. **Testing**:
   - Port a few of iwe's integration tests from `crates/iwe/tests/` — they're markdown-fixture driven
   - Test the `retrieve` function with a 3-document fixture (A → B → C) and verify depth/context/backlinks are correct
   - Unit-test `RefIndex::merge` semantics — it's the load-bearing piece for incremental updates
8. **Risks**:
   - **Stack overflow on deep trees** if you port `index_node` recursively. Rewrite iteratively.
   - **Arena tombstones accumulate** in long-lived daemons. Need a compaction strategy EMA doesn't have yet.
   - **Async-vs-sync impedance** — the core will be easier to reason about if synchronous, but file I/O must be async in Node. Split: sync core functions that take pre-loaded content, async wrappers that load content and call core.
   - **Licensing** — Apache 2.0. EMA is Apache-2.0 friendly per genesis. Record the port attribution in each file header.

## Related extractions

- `[[research/_extractions/silverbulletmd-silverbullet]]` — the other primary port target (complementary: hybrid KV + Lua DSL vs arena + pure verbs)
- `[[research/_extractions/foambubble-foam]]` — simpler file-watcher → graph approach
- `[[research/_extractions/zk-org-zk]]` — CLI noun-verb pattern parallel

## Connections

- `[[research/knowledge-graphs/iwe-org-iwe]]` — original research node
- `[[research/_clones/INDEX]]`
- `[[DEC-001]]` — canon decision to use derived index
- `[[BOOTSTRAP-V0.1]]` — informs the CLI verb set

#extraction #knowledge-graphs #iwe #rust #graph #lsp #cli #primary-port-target
