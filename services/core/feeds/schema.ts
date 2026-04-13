import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const feedSources = sqliteTable(
  "feed_sources",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    url: text("url"),
    description: text("description"),
    defaultWeight: text("default_weight").notNull().default("0.5"),
    active: text("active").notNull().default("1"),
    insertedAt: text("inserted_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    kindIdx: index("feed_sources_kind_idx").on(table.kind),
  }),
);

export const feedViews = sqliteTable(
  "feed_views",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    surface: text("surface").notNull(),
    scopeId: text("scope_id").notNull(),
    scopeKind: text("scope_kind").notNull(),
    prompt: text("prompt").notNull().default(""),
    filters: text("filters").notNull().default("{}"),
    shareTargets: text("share_targets").notNull().default("[]"),
    insertedAt: text("inserted_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    surfaceScopeIdx: index("feed_views_surface_scope_idx").on(
      table.surface,
      table.scopeId,
    ),
  }),
);

export const feedItems = sqliteTable(
  "feed_items",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    canonicalUrl: text("canonical_url"),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    creator: text("creator"),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("fresh"),
    score: text("score").notNull(),
    signals: text("signals").notNull().default("[]"),
    tags: text("tags").notNull().default("[]"),
    scopeIds: text("scope_ids").notNull().default("[]"),
    availableActions: text("available_actions").notNull().default("[]"),
    coverColor: text("cover_color"),
    metadata: text("metadata").notNull().default("{}"),
    discoveredAt: text("discovered_at").notNull(),
    publishedAt: text("published_at"),
    insertedAt: text("inserted_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    lastActionAt: text("last_action_at"),
  },
  (table) => ({
    statusIdx: index("feed_items_status_idx").on(table.status),
    sourceIdx: index("feed_items_source_idx").on(table.sourceId),
    discoveredIdx: index("feed_items_discovered_idx").on(table.discoveredAt),
  }),
);

export const feedItemActions = sqliteTable(
  "feed_item_actions",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id").notNull(),
    action: text("action").notNull(),
    actor: text("actor").notNull(),
    note: text("note"),
    targetScopeId: text("target_scope_id"),
    insertedAt: text("inserted_at").notNull(),
  },
  (table) => ({
    itemIdx: index("feed_item_actions_item_idx").on(table.itemId),
    insertedIdx: index("feed_item_actions_inserted_idx").on(table.insertedAt),
  }),
);

export const feedConversations = sqliteTable(
  "feed_conversations",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id").notNull(),
    title: text("title").notNull(),
    suggestedMode: text("suggested_mode").notNull(),
    opener: text("opener").notNull(),
    status: text("status").notNull().default("open"),
    insertedAt: text("inserted_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    itemIdx: index("feed_conversations_item_idx").on(table.itemId),
    statusIdx: index("feed_conversations_status_idx").on(table.status),
  }),
);

export const FEEDS_DDL = `
  CREATE TABLE IF NOT EXISTS feed_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    url TEXT,
    description TEXT,
    default_weight TEXT NOT NULL DEFAULT '0.5',
    active TEXT NOT NULL DEFAULT '1',
    inserted_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS feed_sources_kind_idx ON feed_sources(kind);

  CREATE TABLE IF NOT EXISTS feed_views (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    surface TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    scope_kind TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    filters TEXT NOT NULL DEFAULT '{}',
    share_targets TEXT NOT NULL DEFAULT '[]',
    inserted_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS feed_views_surface_scope_idx ON feed_views(surface, scope_id);

  CREATE TABLE IF NOT EXISTS feed_items (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    canonical_url TEXT,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    creator TEXT,
    kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'fresh',
    score TEXT NOT NULL,
    signals TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    scope_ids TEXT NOT NULL DEFAULT '[]',
    available_actions TEXT NOT NULL DEFAULT '[]',
    cover_color TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    discovered_at TEXT NOT NULL,
    published_at TEXT,
    inserted_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_action_at TEXT
  );

  CREATE INDEX IF NOT EXISTS feed_items_status_idx ON feed_items(status);
  CREATE INDEX IF NOT EXISTS feed_items_source_idx ON feed_items(source_id);
  CREATE INDEX IF NOT EXISTS feed_items_discovered_idx ON feed_items(discovered_at);

  CREATE TABLE IF NOT EXISTS feed_item_actions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    note TEXT,
    target_scope_id TEXT,
    inserted_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS feed_item_actions_item_idx ON feed_item_actions(item_id);
  CREATE INDEX IF NOT EXISTS feed_item_actions_inserted_idx ON feed_item_actions(inserted_at);

  CREATE TABLE IF NOT EXISTS feed_conversations (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    suggested_mode TEXT NOT NULL,
    opener TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    inserted_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS feed_conversations_item_idx ON feed_conversations(item_id);
  CREATE INDEX IF NOT EXISTS feed_conversations_status_idx ON feed_conversations(status);
`;

export function applyFeedsDdl(db: { exec: (sql: string) => unknown }): void {
  db.exec(FEEDS_DDL);
}
