---
id: EXTRACT-silverbulletmd-silverbullet
type: extraction
layer: research
category: knowledge-graphs
title: "Source Extractions — silverbulletmd/silverbullet"
status: active
created: 2026-04-12
updated: 2026-04-12
author: A1
clone_path: "../_clones/silverbulletmd-silverbullet/"
source:
  url: https://github.com/silverbulletmd/silverbullet
  sha: b7d46fa
  clone_date: 2026-04-12
  depth: shallow-1
  size_mb: 12
tags: [extraction, knowledge-graphs, silverbullet, object-index, primary-port-target, dql]
connections:
  - { target: "[[research/knowledge-graphs/silverbulletmd-silverbullet]]", relation: source_of }
  - { target: "[[research/_clones/INDEX]]", relation: references }
  - { target: "[[DEC-001]]", relation: informs }
---

# Source Extractions — silverbulletmd/silverbullet

> Primary port target for EMA's Object Index pattern. SilverBullet is a self-hosted Markdown-first PKM. The key insight is that it derives a **hybrid KV / Lua-query object index** from plain markdown files. No separate graph DB — the index is a projection, not an authority. This matches EMA's canon DEC-001.

## Clone metadata

| Field | Value |
|---|---|
| URL | https://github.com/silverbulletmd/silverbullet |
| Clone depth | --depth=1 shallow |
| Clone date | 2026-04-12 |
| Clone size | ~12 MB |
| Language | TypeScript (core), Go (server), Lua (query DSL) |
| License | MIT |
| Key commit SHA | b7d46fa |

## Install attempt

- **Attempted:** no
- **Command:** n/a
- **Result:** skipped
- **If skipped, why:** SilverBullet is a full-stack PKM app (Deno + Go + browser client). Not relevant to validate — we're extracting data model patterns, not runtime behavior. Build chain includes Deno and full client bundle. No trivial single-command build.

## Run attempt

- **Attempted:** no
- **Result:** skipped
- **If skipped, why:** see install. The interesting parts are its source files, which we have read directly.

## Key files identified

Ordered by porting priority:

1. `client/data/object_index.ts` — **core** ObjectIndex class (KV + Lua query wiring, validation, tag metatables)
2. `plug-api/types/index.ts` — `ObjectValue<T>` canonical shape (`ref`, `tag`, `tags`, `itags`)
3. `client/space_lua/query_collection.ts` — Lua-style `LuaCollectionQuery` DSL (where/orderBy/select/groupBy/having/limit)
4. `plugs/index/indexer.ts` — orchestrator that runs all indexers over a parsed page
5. `plugs/index/link.ts` — link indexer producing LinkObject + AspiringPageObject
6. `plugs/index/item.ts` — list-item / task indexer (task inherits from item)
7. `plugs/index/tags.ts` — tag indexer + `updateITags` (implicit/inherited tags)
8. `plugs/index/page.ts` — page indexer, merges frontmatter → PageMeta
9. `plugs/index/data.ts` — embedded YAML `data` fenced-code indexer (structured payloads inside prose)
10. `plug-api/syscalls/index.ts` — public syscall surface (`indexObjects`, `queryLuaObjects`, etc.)
11. `client/data/kv_primitives.ts` — KV abstract interface (backend-agnostic)
12. `client/data/indexeddb_kv_primitives.ts` — IndexedDB backend (prefix query via range bounds)
13. `plug-api/types/datastore.ts` — `KvKey = string[]` type

## Extracted patterns

### Pattern 1: Object Index as a KV projection over markdown

**Files:**
- `client/data/object_index.ts:26-32` — constants and version
- `client/data/object_index.ts:58-104` — `ObjectIndex` class + file-delete listener + initial-index tracking
- `client/data/object_index.ts:357-399` — `batchSet`, `batchDelete`, `clearFileIndex`
- `client/data/object_index.ts:419-567` — `indexObjects`, `processObjectsToKVs` (validation + transform + tag enrichment)

**Snippet (verbatim from source):**
```typescript
// client/data/object_index.ts:15-47
const indexKey = "idx";
const pageKey = "ridx";

const indexVersionKey = ["$indexVersion"];

// Bump this one every time a full reindex is needed
const desiredIndexVersion = 9;

type TagDefinition = {
  tagPage?: string;
  metatable?: any;
  mustValidate?: boolean;
  schema?: any;
  validate?: (o: ObjectValue) => Promise<string | null | undefined>;
  transform?: (
    o: ObjectValue,
  ) =>
    | Promise<ObjectValue[] | ObjectValue>
    | ObjectValue[]
    | ObjectValue
    | null;
};
```

```typescript
// client/data/object_index.ts:357-399
batchSet(page: string, kvs: KV[]): Promise<void> {
  const finalBatch: KV[] = [];
  for (const { key, value } of kvs) {
    finalBatch.push(
      {
        key: [indexKey, ...key, page],
        value,
      },
      {
        key: [pageKey, page, ...key],
        value: true,
      },
    );
  }
  return this.ds.batchSet(finalBatch);
}

batchDelete(page: string, keys: KvKey[]): Promise<void> {
  const finalBatch: KvKey[] = [];
  for (const key of keys) {
    finalBatch.push([indexKey, ...key, page]);
  }
  return this.ds.batchDelete(finalBatch);
}

/**
 * Clears all keys for a given file
 */
public async clearFileIndex(file: string): Promise<void> {
  if (file.endsWith(".md")) {
    file = file.replace(/\.md$/, "");
  }
  const allKeys: KvKey[] = [];
  for await (const { key } of this.ds.query({
    prefix: [pageKey, file],
  })) {
    allKeys.push(key);
    allKeys.push([indexKey, ...key.slice(2), file]);
  }
  await this.ds.batchDelete(allKeys);
}
```

**Key namespace scheme** from the comment at `plugs/index/api.ts:15-20`:
```
[indexKey ("idx"), type, ...key, page] -> value      # the actual object
[pageKey  ("ridx"), page, ...key]       -> true      # reverse index for fast per-page clear
["type", type]                          -> true      # fast tag listing
```

**What to port to EMA:**
Make this the core of EMA's `@ema/core` knowledge engine. Each markdown file is parsed once, produces a list of `ObjectValue` derivations, and those get written to a KV store under `[idx, tag, ...key, filepath]`. Store a **reverse index** `[ridx, filepath, ...key]` so that deleting a file is `query({prefix: [ridx, filepath]}) -> delete both sides`. Bump `desiredIndexVersion` whenever the derivation logic changes to trigger a forced reindex.

Lands in:
- `packages/core/src/object-index/index.ts` (class)
- `packages/core/src/object-index/kv-store.ts` (abstract KV interface — port `client/data/kv_primitives.ts`)
- `packages/core/src/object-index/sqlite-kv.ts` (default SQLite backend for EMA)
- `packages/core/src/object-index/types.ts` (port `ObjectValue<T>` shape)

**Adaptation notes:**
- EMA uses Electron main process, so IndexedDB isn't the right default backend. Use **better-sqlite3** with a `(key TEXT PRIMARY KEY, value BLOB)` table and treat `key` as `\0`-separated joined parts, exactly like the IndexedDB primitives do at `client/data/indexeddb_kv_primitives.ts:7,94-108`.
- Keep the three-segment key pattern (`[idx, tag, ...key, page]`) — it enables O(range-scan) tag filtering without joins.
- Keep `indexVersion` as an explicit bump mechanism — don't auto-migrate on schema change.
- Consider prefix bounds `[..., ""]` and `[..., "\uffff"]` exactly like `indexeddb_kv_primitives.ts:69-74`.

### Pattern 2: ObjectValue<T> — universal record shape

**Files:**
- `plug-api/types/index.ts:44-56` — canonical `ObjectValue<T>` type
- `plug-api/types/index.ts:18-27` — `PageMeta` as `ObjectValue<...>`
- `plugs/index/link.ts:30-44` — `LinkObject` as `ObjectValue<{ page, pos, type, ... }>`
- `plugs/index/item.ts:18-41` — `ItemObject`, `TaskObject` extending item

**Snippet (verbatim from source):**
```typescript
// plug-api/types/index.ts:44-56
/**
 * An ObjectValue that can be indexed by the `index` plug, needs to have a minimum of
 * of two fields:
 * - ref: a unique reference (id) for the object, ideally a page reference
 * - tags: a list of tags that the object belongs to
 */
export type ObjectValue<T = any> = {
  ref: string;
  tag: string; // main tag
  range?: [number, number];
  tags?: string[];
  itags?: string[]; // implicit or inherited tags (inherited from the page for instance)
} & T;
```

```typescript
// plugs/index/link.ts:30-44
export type LinkObject = ObjectValue<{
  // Common to all links
  page: string;
  pos: number;
  type: "page" | "file" | "url";
  snippet: string;
  alias?: string;
  pageLastModified: string;
  // Page Link
  toPage?: string;
  // File Link
  toFile?: string;
  // External URL
  toURL?: string;
}>;
```

```typescript
// plugs/index/item.ts:18-41
export type ItemObject = ObjectValue<
  {
    page: string;
    name: string;
    text: string;
    pos: number;
    toPos: number;
    parent?: string;
    links?: string[];
    ilinks?: string[];
    pageLastModified: string;
  } & Record<string, any>
>;

export type TaskObject = ObjectValue<
  // "Inherit" everyting from item
  ItemObject & {
    done: boolean;
    state: string;
  } & Record<string, any>
>;
```

**What to port to EMA:**
This is the single most load-bearing type in SilverBullet. EMA should copy it verbatim into `packages/core/src/object-index/types.ts`. The `tag` vs `tags` vs `itags` split is clever:
- `tag` is the primary tag — determines which KV namespace the object lands in.
- `tags` are additional tags that cause the object to be indexed under those namespaces too (so one object appears under multiple prefix ranges without duplicating storage).
- `itags` (implicit/inherited) are the bubbled-up set from frontmatter and parents — used for queries that match across all tag sources.

The `ref` field uses the convention `${page}@${pos}` so the position in the file is baked into identity. When a page is reindexed, old position-based refs naturally drop out.

**Adaptation notes:**
- Keep `range?: [number, number]` — when EMA tracks edit positions in markdown, this lets you jump back to source.
- The `Record<string, any>` escape hatch is intentional — user frontmatter gets spread into the object. Don't narrow this; EMA should allow arbitrary user fields.
- Consider naming the tag field `type` in EMA (more conventional), but `tag` matches the canon doc DEC-001.

### Pattern 3: Indexer orchestration — one pass per file → N derivations

**Files:**
- `plugs/index/indexer.ts:20-82` — `IndexerFunction` type and `allIndexers` array
- `plugs/index/page.ts:22-74` — concrete page indexer (merges frontmatter into PageMeta)
- `plugs/index/tags.ts:27-62` — tag indexer with task-context awareness
- `plugs/index/data.ts:22-86` — embedded YAML `data` fenced-code block indexer

**Snippet (verbatim from source):**
```typescript
// plugs/index/indexer.ts:20-82
export type IndexerFunction = (
  pageMeta: PageMeta,
  frontmatter: FrontMatter,
  tree: ParseTree,
  text: string,
) => Promise<ObjectValue<any>[]>;

export const allIndexers: IndexerFunction[] = [
  pageIndexPage,
  indexData,
  indexItems,
  indexHeaders,
  indexParagraphs,
  indexLinks,
  indexTables,
  indexSpaceLua,
  indexSpaceStyle,
  indexTags,
];

/**
 * Ad-hoc index a piece of markdown text
 */
export async function indexMarkdown(
  text: string,
  pageMeta: PageMeta = {
    ref: "", tag: "", name: "", perm: "ro", lastModified: "", created: "",
  },
): Promise<ObjectValue<any>> {
  const tree = await markdown.parseMarkdown(text);
  const frontmatter = extractFrontMatter(tree);
  const index = await Promise.all(
    allIndexers
      .filter((indexer) => indexer !== pageIndexPage)
      .map((indexer) => {
        return indexer(pageMeta, frontmatter, tree, text);
      }),
  );
  return index.flat();
}

export async function indexPage({ name, tree, meta, text }: IndexTreeEvent) {
  const frontmatter = extractFrontMatter(tree);
  const indexResults = await Promise.all(
    allIndexers.map((indexer) => {
      return indexer(meta, frontmatter, tree, text);
    }),
  );
  await index.indexObjects<any>(name, indexResults.flat());
}
```

```typescript
// plugs/index/tags.ts:27-62 — task-aware tag indexing
export function indexTags(
  pageMeta: PageMeta,
  frontmatter: FrontMatter,
  tree: ParseTree,
) {
  const tags = new Set<string>(); // name:parent
  const pageTags: string[] = frontmatter.tags || [];
  for (const pageTag of pageTags) {
    tags.add(`${pageTag}:page`);
  }
  collectNodesOfType(tree, "Hashtag").forEach((h) => {
    const tagName = extractHashtag(h.children![0].text!);
    // Check if this occurs in the context of a task
    if (findParentMatching(h, (n) => n.type === "Task")) {
      tags.add(`${tagName}:task`);
    } else if (findParentMatching(h, (n) => n.type === "ListItem")) {
      tags.add(`${tagName}:item`);
    } else if (findParentMatching(h, (n) => n.type === "Paragraph")) {
      tags.add(`${tagName}:page`);
    }
  });
  return Promise.resolve(
    [...tags].map((tag) => {
      const [tagName, parent] = tag.split(":");
      return {
        ref: tag,
        tag: "tag",
        name: tagName,
        page: pageMeta.name,
        parent,
      };
    }),
  );
}
```

**What to port to EMA:**
EMA's `@ema/core` should have a registry of `IndexerFunction` exactly like this. Each indexer is:
1. Pure (given `(pageMeta, frontmatter, tree, text)`, returns `ObjectValue[]`).
2. Independent (they run in `Promise.all`).
3. Owned by a domain (link, task, tag, header, data, etc.).
4. Can push multiple objects per page.

The `indexMarkdown` variant that excludes the page indexer is important — it lets the engine dry-run over text without registering the page itself. EMA should expose this for agent workflows ("what would be indexed if I wrote this?").

**Adaptation notes:**
- EMA parses markdown via `micromark` or `remark` — not SilverBullet's custom CodeMirror-based parser. The `ParseTree` type will differ. Create a thin `MarkdownNode` adapter with the same traversal API (`findParentMatching`, `collectNodesOfType`) so indexers don't couple to the parser.
- Task-in-context detection is a significant win — `findParentMatching(h, n => n.type === "Task")` means `#priority` inside a `- [ ] ...` list item is tagged as `priority:task` not `priority:page`. EMA vault users will love this. Copy the exact parent-walk pattern.
- The `name:parent` format for tag refs (e.g. `priority:task`) is the key discriminator that makes Lua queries able to ask "all tasks tagged priority" vs "all pages tagged priority" without a separate join.

### Pattern 4: Lua-based query DSL with where/orderBy/select/groupBy/having

**Files:**
- `client/space_lua/query_collection.ts:163-206` — `LuaCollectionQuery` shape + `ArrayQueryCollection`
- `client/space_lua/query_collection.ts:684-992` — `applyQuery` full pipeline (where → groupBy → having → orderBy → select → distinct → limit/offset)
- `client/space_lua/query_collection.ts:994-1076` — `queryLua` over a KV prefix + `DataStoreQueryCollection`
- `client/data/object_index.ts:123-139` — `tag(tagName)` returns a `LuaQueryCollection` scoped to one tag namespace

**Snippet (verbatim from source):**
```typescript
// client/space_lua/query_collection.ts:163-206
export type LuaOrderBy = {
  expr: LuaExpression;
  desc: boolean;
  nulls?: "first" | "last";
  using?: string | LuaFunctionBody;
};

export type LuaGroupByEntry = {
  expr: LuaExpression;
  alias?: string;
};

/**
 * Represents a query for a collection
 */
export type LuaCollectionQuery = {
  objectVariable?: string;
  where?: LuaExpression;
  orderBy?: LuaOrderBy[];
  select?: LuaExpression;
  limit?: number;
  offset?: number;
  distinct?: boolean;
  groupBy?: LuaGroupByEntry[];
  having?: LuaExpression;
};

export interface LuaQueryCollection {
  query(
    query: LuaCollectionQuery,
    env: LuaEnv,
    sf: LuaStackFrame,
    config?: Config,
  ): Promise<any[]>;
}

export class ArrayQueryCollection<T> implements LuaQueryCollection {
  constructor(private readonly array: T[]) {}
  query(
    query: LuaCollectionQuery,
    env: LuaEnv,
    sf: LuaStackFrame,
    config?: Config,
  ): Promise<any[]> {
    return applyQuery(this.array, query, env, sf, config);
  }
}
```

```typescript
// client/space_lua/query_collection.ts:994-1076 — bridge from a KV prefix to LuaQueryCollection
export async function queryLua<T = any>(
  kv: KvPrimitives,
  prefix: KvKey,
  query: LuaCollectionQuery,
  env: LuaEnv,
  sf: LuaStackFrame = LuaStackFrame.lostFrame,
  enricher?: (key: KvKey, item: any) => any,
  config?: Config,
): Promise<T[]> {
  const results: T[] = [];
  for await (let { key, value } of kv.query({ prefix })) {
    if (enricher) {
      value = enricher(key, value);
    }
    results.push(value);
  }
  return applyQuery(results, query, env, sf, config);
}

export class DataStoreQueryCollection implements LuaQueryCollection {
  constructor(
    private readonly dataStore: DataStore,
    readonly prefix: string[],
  ) {}
  query(
    query: LuaCollectionQuery,
    env: LuaEnv,
    sf: LuaStackFrame,
    config?: Config,
  ): Promise<any[]> {
    return queryLua(
      this.dataStore.kv,
      this.prefix,
      query,
      env,
      sf,
      undefined,
      config,
    );
  }
}
```

**What to port to EMA:**
EMA's DQL (per DEC-001) wants a query DSL that reads like "`from tag where ... order by ... select`". The structure of `LuaCollectionQuery` is **exactly** what EMA should model, but **without Lua** — EMA should use a small typed AST + TypeScript eval instead (much faster to ship, much smaller dep surface, no need to ship a Lua interpreter to browser). Copy the type, swap `LuaExpression` for something like:

```typescript
type DqlExpr =
  | { type: "Variable"; name: string }
  | { type: "Binary"; operator: string; left: DqlExpr; right: DqlExpr }
  | { type: "PropertyAccess"; object: DqlExpr; property: string }
  | { type: "Literal"; value: unknown }
  | { type: "FunctionCall"; name: string; args: DqlExpr[] };
```

And port the **pipeline order** in `applyQuery:684-992` verbatim: where → groupBy → having → orderBy → select → distinct → limit/offset. That ordering is SQL-correct and handles the tricky case of evaluating aggregate expressions on grouped results.

Also copy the **Schwartzian transform** for orderBy at lines 552-601 — pre-compute all sort keys once per item, then sort on the cached array. Without this, a `select` that re-evaluates expressions inside a comparator becomes O(n² · k) for k expressions.

**Adaptation notes:**
- EMA can ship the DSL as a tagged template literal: `` dql`from page where tags includes "project" order by name` `` parsed into the same `{ where, orderBy, select }` shape.
- Skip groupBy/having in the first release — those are only useful for the dataview-style aggregates. Ship where/orderBy/limit first.
- The `ArrayQueryCollection` and `DataStoreQueryCollection` interface split is really useful — agents can query either an in-memory array or the full KV-backed index with the same API. Port both.
- Look at the `precomputeSortKeys` function at `client/space_lua/query_collection.ts:552-601` for exactly how to avoid N² evaluation during sort.

### Pattern 5: Aspiring pages — index links to pages that don't exist yet

**Files:**
- `plugs/index/link.ts:46-58` — `AspiringPageObject` type
- `plugs/index/link.ts:218-249` — existence check + "aspiring page" object creation
- `plugs/index/page.ts:52-71` — when a page is written, delete the aspiring entry

**Snippet (verbatim from source):**
```typescript
// plugs/index/link.ts:46-58
/**
 * Represents a page that does not yet exist, but is being linked to. A page "aspiring" to be created.
 */
export type AspiringPageObject = ObjectValue<{
  page: string;       // the page the link appears on
  pos: number;        // position in that page
  name: string;       // the page the link points to
}>;
```

```typescript
// plugs/index/link.ts:218-249
// Now let's check which are aspiring pages
// Collect unique target pages and check existence in parallel
const pageLinks = objects.filter(
  (link): link is LinkObject => !!link.toPage,
);
const uniqueTargets = [...new Set(pageLinks.map((link) => link.toPage!))];
const existenceResults = await Promise.all(
  uniqueTargets.map((target) => space.fileExists(`${target}.md`)),
);
const missingPages = new Set(
  uniqueTargets.filter((_, i) => !existenceResults[i]),
);

for (const link of pageLinks) {
  if (missingPages.has(link.toPage!)) {
    objects.push({
      ref: `${name}@${link.pos}`,
      tag: "aspiring-page",
      page: name,
      pos: link.pos,
      range: link.range,
      name: link.toPage,
    } as AspiringPageObject);
    console.info(
      "Link from", name, "to", link.toPage,
      "is broken, indexing as aspiring page",
    );
  }
}
```

```typescript
// plugs/index/page.ts:52-71
// Make sure this page is no (longer) in the aspiring pages list
const aspiringPages = await index.queryLuaObjects<AspiringPageObject>(
  "aspiring-page",
  {
    objectVariable: "_",
    where: await lua.parseExpression(`_.name == pageRef`),
  },
  { pageRef: pageMeta.name },
);
await Promise.all(
  aspiringPages.map((aspiringPage) => {
    return index.deleteObject(
      "aspiring-page",
      aspiringPage.page,
      aspiringPage.ref,
    );
  }),
);
```

**What to port to EMA:**
This is the "broken wikilink → future intent" pattern that EMA's agent side needs. When a page references `[[SomeFutureNode]]` that doesn't exist, the index records it. EMA can then:
1. Show a "Aspiring Pages" list in the vault UI (what does the user want to write next but hasn't?).
2. Feed this list to agents ("create stubs for these aspiring pages").
3. Let agents query `from aspiring-page where name == "X"` to see if anything is waiting on a page.

The cleanup logic at `page.ts:52-71` is important — when you finally create `SomeFutureNode.md`, the aspiring-page entries pointing at it get deleted as a side effect of the indexing pass. Copy this pattern verbatim.

**Adaptation notes:**
- EMA should use this for **intents** too — an intent node in the canon wiki that links to `[[unbuilt-feature]]` gets stored as an aspiring-page object. When the feature ships, the aspiring entry naturally cleans up.
- The existence check is done in parallel with `Promise.all(fileExists)` — cheap for ~50 pages, expensive for 10k. EMA may want to cache existence in-memory during a full reindex pass.
- `uniqueTargets` deduplication is a small but critical optimization — don't `fileExists` the same target page N times if multiple links point at it.

## Gotchas found while reading

- **`indexKey` vs `pageKey`**: At `object_index.ts:26-27`, there are TWO prefix constants — `"idx"` and `"ridx"`. Only `idx` is the queryable index; `ridx` is a reverse side-index storing `true` just so `clearFileIndex` can walk one page's keys in O(page_size) instead of O(total_index). A naive port might drop the reverse index and end up with O(n) per-file deletions. Don't.
- **Index version bump semantics**: `desiredIndexVersion = 9` at `object_index.ts:32` — when this int is bumped in code, the next client boot sees the mismatch and triggers a full reindex. There's no migration logic. EMA needs the same "bump + full reindex" model or migrations become unbounded.
- **Tag metatables are Lua-specific**: At `object_index.ts:106-121`, the `enricher` attaches a Lua metatable to query results if one is configured for the tag. EMA porting to TypeScript means **dropping metatables entirely** — TypeScript doesn't have per-object metatables. The equivalent is attaching transient methods via `Object.defineProperty`, or just returning plain objects and letting the query layer do enrichment.
- **`processObjectsToKVs` can loop-insert**: At `object_index.ts:441-562`, tag `transform` callbacks can push new objects onto the working array mid-iteration. The `while (objects.length > 0) objects.shift()!` loop handles this. There's an infinite-loop guard at lines 547-551 — if a transform doesn't return at least one object with the same ref, it throws. Port that guard.
- **Aspiring pages don't handle renames**: If `[[Alpha]]` is an aspiring page and you create `Alpha.md`, cleanup works. But if you then rename `Alpha.md` to `Beta.md`, the source page still says `[[Alpha]]` and you now have a broken link — but no aspiring-page entry regenerates until the source page itself is reindexed. Subtle. EMA should force a link-indexer rerun on rename events, not just on content-change events.
- **Parent-walk in tag indexer stops at paragraph**: `indexTags:45-48` checks `findParentMatching(h, n => n.type === "Paragraph")` as the fallback case. That means a hashtag inside a blockquote or callout gets tagged `:page` not `:quote`. If EMA wants richer tagging (e.g. `#todo` inside a callout), extend the parent type enum.
- **The tag index emits `${tagName}:${parent}` as the `ref` field** at `tags.ts:52-60`, meaning tag dedupe happens via this ref. You can't have two different "project" tags on the same page at different nesting levels — second one overwrites first. May be intentional, may be a bug. Verify before porting.
- **`indexObjects` is a batch-only API** (`object_index.ts:419-429`) — there's no single-object insert. Callers must always pass arrays. EMA should preserve this constraint; mixing single/batch leads to perf regressions.
- **Index queue uses a MQ abstraction**, not direct calls. At `object_index.ts:80-104`, the constructor listens for `mq:emptyQueue:indexQueue` events to detect "initial full index complete". This is clever — it decouples "I'm done indexing" from "the caller that kicked off indexing has returned." EMA may want a simpler synchronous-ish path at first and graduate to MQ later.

## Port recommendation

Concrete next steps for EMA's port:

1. **Create `packages/core/src/object-index/`** with these files as the first port target:
   - `types.ts` — copy `ObjectValue<T>`, `PageMeta`, `LinkObject`, `ItemObject`, `TaskObject` verbatim. Strip the `Record<string, any>` only if EMA wants stricter typing (I recommend keeping it).
   - `kv-primitives.ts` — port `KvPrimitives` interface from `client/data/kv_primitives.ts:7-26`.
   - `sqlite-kv.ts` — new file: implement `KvPrimitives` over `better-sqlite3`. Use `\0` separator and the range-scan query pattern from `indexeddb_kv_primitives.ts:66-88`.
   - `object-index.ts` — port the `ObjectIndex` class. Drop the Lua metatable stuff. Drop the MQ-based initial-index completion detection (use a simple Promise-based flag).
2. **Then port the query DSL** as `packages/core/src/dql/` — typed AST in `ast.ts`, eval in `eval.ts`, template literal in `dql.ts`. Use the pipeline ordering from `applyQuery:684-992` as the spec. Ship where/orderBy/limit first, add groupBy/having later.
3. **Then port indexers** as `packages/core/src/indexers/`. One file per domain (page, link, task, tag, header, data, paragraph). Import a common `ParseTree` adapter that wraps the chosen markdown parser (recommend `mdast` from `remark`).
4. **Testing**: use SilverBullet's own fixture pages as test cases if license allows. The `plugs/index/item.test.ts`, `link.test.ts`, `tags.test.ts`, `page.test.ts`, `task.test.ts` files are test fixtures that should survive a straight port of the indexer logic. Check the `.test.ts` files when you're porting each domain.
5. **Dependency decisions**:
   - Choose `better-sqlite3` over `sqlite3` (synchronous API, much faster for batch writes).
   - Choose `remark` + `unified` for markdown parsing (well-documented AST).
   - Skip Lua entirely. Use a small TypeScript parser for the DSL.
   - Do NOT port `space_lua/` — it's ~5kLOC of Lua runtime that EMA does not need.
6. **Risks**:
   - The `LuaCollectionQuery` semantics leak into `plugs/index/link.ts:274-285` (`getBackLinks` uses `lua.parseExpression`). Every time EMA's indexer needs a query, it must use EMA's DSL. This means the DSL has to be available during indexing — circular-ish. Solve by making `indexers` only return `ObjectValue[]`, not execute queries. Delete the `getBackLinks` helper and let the UI layer do the query.
   - `findParentMatching` and `collectNodesOfType` are SilverBullet's custom tree helpers. If EMA uses `remark`/`unist-util-visit`, you get similar but slightly different traversal semantics. Write a compat layer or just use `unist-util-visit-parents`.
   - The `ref` scheme `${page}@${pos}` bakes position into identity. That's great for the indexer but bad if EMA wants stable agent references to items. Consider a `ref-stable` field computed as a hash of content for agent use, separate from the indexer's position-based `ref`.

## Related extractions

- `[[research/_extractions/iwe-org-iwe]]` — Rust markdown graph with LSP (complementary perspective)
- `[[research/_extractions/blacksmithgu-obsidian-dataview]]` — the other DQL reference
- `[[research/_extractions/SkepticMystic-breadcrumbs]]` — typed-edge patterns that complement ObjectIndex

## Connections

- `[[research/knowledge-graphs/silverbulletmd-silverbullet]]` — original research node
- `[[research/_clones/INDEX]]`
- `[[DEC-001]]` — canon decision to use derived Object Index

#extraction #knowledge-graphs #silverbullet #object-index #dql #primary-port-target
