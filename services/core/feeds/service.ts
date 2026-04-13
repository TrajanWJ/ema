import { nanoid } from "nanoid";

import {
  feedActionSchema,
  feedConversationSchema,
  feedItemSchema,
  feedSourceSchema,
  feedViewSchema,
  feedWorkspaceSchema,
  type FeedAction,
  type FeedActionType,
  type FeedConversation,
  type FeedItem,
  type FeedItemStatus,
  type FeedScore,
  type FeedSource,
  type FeedSuggestedMode,
  type FeedSurface,
  type FeedView,
  type FeedWorkspace,
} from "@ema/shared/schemas";
import { getDb } from "../../persistence/db.js";
import { applyFeedsDdl } from "./schema.js";

type DbRow = Record<string, unknown>;

const DEFAULT_SURFACE: FeedSurface = "reader";
const DEFAULT_SCOPE_ID = "personal";
const DEFAULT_SCORE: FeedScore = {
  overall: 0.5,
  novelty: 0.5,
  relevance: 0.5,
  signal: 0.5,
  recency: 0.5,
  serendipity: 0.5,
};

const SEED_BASE_TIME = Date.parse("2026-04-12T12:00:00.000Z");

let initialised = false;

export interface FeedWorkspaceQuery {
  surface?: FeedSurface | undefined;
  scope_id?: string | undefined;
  view_id?: string | undefined;
  query?: string | undefined;
  include_hidden?: boolean | undefined;
}

export interface FeedActionInput {
  action: FeedActionType;
  actor: string;
  note?: string | null | undefined;
  target_scope_id?: string | null | undefined;
}

export interface FeedActionResult {
  item: FeedItem;
  action: FeedAction;
  conversation?: FeedConversation;
}

export class FeedItemNotFoundError extends Error {
  public readonly code = "feed_item_not_found";
  constructor(public readonly itemId: string) {
    super(`Feed item not found: ${itemId}`);
    this.name = "FeedItemNotFoundError";
  }
}

export class FeedViewNotFoundError extends Error {
  public readonly code = "feed_view_not_found";
  constructor(public readonly viewId: string) {
    super(`Feed view not found: ${viewId}`);
    this.name = "FeedViewNotFoundError";
  }
}

export function initFeeds(): void {
  if (initialised) return;
  applyFeedsDdl(getDb());
  initialised = true;
  seedFeedWorkspace();
}

function encode(value: unknown): string {
  return JSON.stringify(value);
}

function decode<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toBoolean(raw: unknown): boolean {
  return raw === "1" || raw === 1 || raw === true;
}

function toNumber(raw: unknown, fallback: number): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && raw.length > 0) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function isoAt(hoursOffset: number): string {
  return new Date(SEED_BASE_TIME + hoursOffset * 60 * 60 * 1000).toISOString();
}

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 1);
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function mapSourceRow(row: DbRow | undefined): FeedSource | null {
  if (!row) return null;
  const candidate: FeedSource = {
    id: String(row.id),
    name: String(row.name),
    kind: String(row.kind) as FeedSource["kind"],
    url: typeof row.url === "string" ? row.url : null,
    description: typeof row.description === "string" ? row.description : null,
    default_weight: toNumber(row.default_weight, 0.5),
    active: toBoolean(row.active),
    inserted_at: String(row.inserted_at),
    updated_at: String(row.updated_at),
  };
  const parsed = feedSourceSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function mapViewRow(row: DbRow | undefined): FeedView | null {
  if (!row) return null;
  const candidate: FeedView = {
    id: String(row.id),
    title: String(row.title),
    surface: String(row.surface) as FeedView["surface"],
    scope_id: String(row.scope_id),
    scope_kind: String(row.scope_kind) as FeedView["scope_kind"],
    prompt: typeof row.prompt === "string" ? row.prompt : "",
    filters: decode<Record<string, unknown>>(row.filters, {}),
    share_targets: decode<string[]>(row.share_targets, []),
    inserted_at: String(row.inserted_at),
    updated_at: String(row.updated_at),
  };
  const parsed = feedViewSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function mapItemRow(row: DbRow | undefined): FeedItem | null {
  if (!row) return null;
  const candidate: FeedItem = {
    id: String(row.id),
    source_id: String(row.source_id),
    canonical_url:
      typeof row.canonical_url === "string" ? row.canonical_url : null,
    title: String(row.title),
    summary: String(row.summary),
    creator: typeof row.creator === "string" ? row.creator : null,
    kind: String(row.kind) as FeedItem["kind"],
    status: String(row.status) as FeedItemStatus,
    score: decode<FeedScore>(row.score, DEFAULT_SCORE),
    signals: decode<string[]>(row.signals, []),
    tags: decode<string[]>(row.tags, []),
    scope_ids: decode<string[]>(row.scope_ids, []),
    available_actions: decode<FeedActionType[]>(row.available_actions, []),
    cover_color:
      typeof row.cover_color === "string" ? row.cover_color : null,
    metadata: decode<Record<string, unknown>>(row.metadata, {}),
    discovered_at: String(row.discovered_at),
    published_at:
      typeof row.published_at === "string" ? row.published_at : null,
    inserted_at: String(row.inserted_at),
    updated_at: String(row.updated_at),
    last_action_at:
      typeof row.last_action_at === "string" ? row.last_action_at : null,
  };
  const parsed = feedItemSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function mapActionRow(row: DbRow | undefined): FeedAction | null {
  if (!row) return null;
  const candidate: FeedAction = {
    id: String(row.id),
    item_id: String(row.item_id),
    action: String(row.action) as FeedActionType,
    actor: String(row.actor),
    note: typeof row.note === "string" ? row.note : null,
    target_scope_id:
      typeof row.target_scope_id === "string" ? row.target_scope_id : null,
    inserted_at: String(row.inserted_at),
  };
  const parsed = feedActionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function mapConversationRow(row: DbRow | undefined): FeedConversation | null {
  if (!row) return null;
  const candidate: FeedConversation = {
    id: String(row.id),
    item_id: String(row.item_id),
    title: String(row.title),
    suggested_mode: String(row.suggested_mode) as FeedSuggestedMode,
    opener: String(row.opener),
    status: String(row.status) as FeedConversation["status"],
    inserted_at: String(row.inserted_at),
    updated_at: String(row.updated_at),
  };
  const parsed = feedConversationSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function listSources(): FeedSource[] {
  initFeeds();
  const rows = getDb()
    .prepare("SELECT * FROM feed_sources ORDER BY inserted_at ASC")
    .all() as DbRow[];
  return rows
    .map((row) => mapSourceRow(row))
    .filter((row): row is FeedSource => row !== null);
}

export function listFeedViews(): FeedView[] {
  initFeeds();
  const rows = getDb()
    .prepare("SELECT * FROM feed_views ORDER BY surface ASC, inserted_at ASC")
    .all() as DbRow[];
  return rows
    .map((row) => mapViewRow(row))
    .filter((row): row is FeedView => row !== null);
}

function listFeedItems(): FeedItem[] {
  initFeeds();
  const rows = getDb()
    .prepare("SELECT * FROM feed_items ORDER BY discovered_at DESC")
    .all() as DbRow[];
  return rows
    .map((row) => mapItemRow(row))
    .filter((row): row is FeedItem => row !== null);
}

function listRecentActions(limit = 12): FeedAction[] {
  initFeeds();
  const rows = getDb()
    .prepare(
      "SELECT * FROM feed_item_actions ORDER BY inserted_at DESC LIMIT ?",
    )
    .all(limit) as DbRow[];
  return rows
    .map((row) => mapActionRow(row))
    .filter((row): row is FeedAction => row !== null);
}

function listRecentConversations(limit = 8): FeedConversation[] {
  initFeeds();
  const rows = getDb()
    .prepare(
      "SELECT * FROM feed_conversations ORDER BY updated_at DESC LIMIT ?",
    )
    .all(limit) as DbRow[];
  return rows
    .map((row) => mapConversationRow(row))
    .filter((row): row is FeedConversation => row !== null);
}

export function getFeedItem(itemId: string): FeedItem | null {
  initFeeds();
  const row = getDb()
    .prepare("SELECT * FROM feed_items WHERE id = ? LIMIT 1")
    .get(itemId) as DbRow | undefined;
  return mapItemRow(row);
}

function rankFeedItem(
  item: FeedItem,
  input: {
    surface: FeedSurface;
    scopeId: string;
    prompt: string;
    query: string;
  },
): FeedItem {
  const reasons: string[] = [];
  let score = item.score.overall * 0.5;
  score += item.score.relevance * 0.22;
  score += item.score.signal * 0.18;
  score += item.score.recency * 0.08;
  score += item.score.serendipity * 0.02;

  const matchHaystack = [
    item.title,
    item.summary,
    item.creator ?? "",
    item.tags.join(" "),
    item.signals.join(" "),
  ].join(" ").toLowerCase();

  const promptTokens = tokenise(input.prompt);
  const queryTokens = tokenise(input.query);
  const promptMatches = uniqueStrings(promptTokens).filter((token) =>
    matchHaystack.includes(token),
  ).length;
  const queryMatches = uniqueStrings(queryTokens).filter((token) =>
    matchHaystack.includes(token),
  ).length;

  if (promptMatches > 0) {
    score += Math.min(promptMatches * 0.08, 0.28);
    reasons.push(`prompt matched ${promptMatches} signals`);
  }
  if (queryMatches > 0) {
    score += Math.min(queryMatches * 0.12, 0.3);
    reasons.push(`search matched ${queryMatches} terms`);
  }

  if (input.surface === "reader") {
    score += item.score.serendipity * 0.16;
    if (item.kind === "video" || item.kind === "article") {
      score += 0.06;
      reasons.push("reader-friendly format");
    }
  }

  if (input.surface === "triage") {
    score += item.score.signal * 0.18;
    if (item.signals.length >= 3) {
      score += 0.07;
      reasons.push("dense signal cluster");
    }
  }

  if (input.surface === "agent") {
    const buildable = item.available_actions.includes("queue_build");
    const researchable = item.available_actions.includes("queue_research");
    if (buildable) {
      score += 0.11;
      reasons.push("build-ready");
    }
    if (researchable) {
      score += 0.07;
      reasons.push("research-ready");
    }
  }

  if (item.scope_ids.includes(input.scopeId)) {
    score += 0.06;
    reasons.push("scoped to current workspace");
  } else if (item.scope_ids.includes("global")) {
    score += 0.03;
    reasons.push("globally relevant");
  }

  if (item.status === "saved") {
    score += 0.05;
    reasons.push("previously saved");
  } else if (item.status === "promoted") {
    score += 0.1;
    reasons.push("already promoted");
  } else if (item.status === "acted_on") {
    score += 0.04;
    reasons.push("active follow-up exists");
  }

  return {
    ...item,
    ranked_score: roundScore(score),
    rank_reasons: reasons,
  };
}

export function getFeedWorkspace(query: FeedWorkspaceQuery = {}): FeedWorkspace {
  initFeeds();

  const surface = query.surface ?? DEFAULT_SURFACE;
  const scopeId = query.scope_id ?? DEFAULT_SCOPE_ID;
  const allViews = listFeedViews();
  const matchingViews = allViews.filter(
    (view) => view.surface === surface && view.scope_id === scopeId,
  );
  const activeView =
    (query.view_id
      ? allViews.find((view) => view.id === query.view_id) ?? null
      : null) ??
    matchingViews[0] ??
    allViews.find((view) => view.surface === surface) ??
    allViews[0];

  if (!activeView) {
    throw new FeedViewNotFoundError(query.view_id ?? "default");
  }

  const prompt = activeView.prompt;
  const searchQuery = query.query ?? "";
  const allItems = listFeedItems();
  const filteredItems = allItems
    .filter((item) => query.include_hidden || item.status !== "hidden")
    .filter(
      (item) =>
        item.scope_ids.includes(scopeId) ||
        item.scope_ids.includes("global") ||
        scopeId === "global",
    )
    .map((item) =>
      rankFeedItem(item, {
        surface,
        scopeId,
        prompt,
        query: searchQuery,
      }),
    )
    .filter((item) => {
      if (!searchQuery.trim()) return true;
      return (item.rank_reasons ?? []).some((reason) =>
        reason.startsWith("search matched"),
      );
    })
    .sort(
      (a, b) =>
        (b.ranked_score ?? b.score.overall) - (a.ranked_score ?? a.score.overall),
    );

  const workspace = {
    surface,
    scope_id: scopeId,
    active_view_id: activeView.id,
    query: searchQuery,
    sources: listSources(),
    views: allViews,
    items: filteredItems,
    recent_actions: listRecentActions(16),
    conversations: listRecentConversations(10),
    stats: {
      total_items: allItems.length,
      visible_items: filteredItems.length,
      saved_items: allItems.filter((item) => item.status === "saved").length,
      promoted_items: allItems.filter((item) => item.status === "promoted").length,
      hidden_items: allItems.filter((item) => item.status === "hidden").length,
      sources: listSources().length,
      open_conversations: listRecentConversations(100).filter(
        (conversation) => conversation.status !== "resolved",
      ).length,
    },
  } satisfies FeedWorkspace;

  return feedWorkspaceSchema.parse(workspace);
}

export function updateFeedViewPrompt(viewId: string, prompt: string): FeedView {
  initFeeds();
  const existing = getDb()
    .prepare("SELECT * FROM feed_views WHERE id = ? LIMIT 1")
    .get(viewId) as DbRow | undefined;
  if (!existing) throw new FeedViewNotFoundError(viewId);

  const updatedAt = new Date().toISOString();
  getDb()
    .prepare(
      "UPDATE feed_views SET prompt = ?, updated_at = ? WHERE id = ?",
    )
    .run(prompt, updatedAt, viewId);

  return mapViewRow(
    getDb()
      .prepare("SELECT * FROM feed_views WHERE id = ? LIMIT 1")
      .get(viewId) as DbRow | undefined,
  ) as FeedView;
}

function statusForAction(action: FeedActionType, current: FeedItemStatus): FeedItemStatus {
  if (action === "hide" || action === "dismiss") return "hidden";
  if (action === "save") return "saved";
  if (action === "promote") return "promoted";
  if (action === "queue_research" || action === "queue_build" || action === "start_chat") {
    return current === "promoted" || current === "saved" ? current : "acted_on";
  }
  return current;
}

function conversationModeForAction(action: FeedActionType): FeedSuggestedMode | null {
  if (action === "queue_build") return "build";
  if (action === "queue_research") return "research";
  if (action === "start_chat") return "chat";
  return null;
}

function conversationTitleForAction(action: FeedActionType, title: string): string {
  if (action === "queue_build") return `Build session: ${title}`;
  if (action === "queue_research") return `Research session: ${title}`;
  return `Conversation: ${title}`;
}

function conversationOpenerForAction(item: FeedItem, input: FeedActionInput): string {
  if (input.note && input.note.trim()) return input.note.trim();
  if (input.action === "queue_build") {
    return `Turn "${item.title}" into an implementation slice with next-step tasks and a delivery path.`;
  }
  if (input.action === "queue_research") {
    return `Research the claims and adjacent ideas around "${item.title}", then surface the strongest signals and open questions.`;
  }
  return `Talk through why "${item.title}" matters, what it changes, and what EMA should do with it.`;
}

export function actOnFeedItem(itemId: string, input: FeedActionInput): FeedActionResult {
  initFeeds();
  const item = getFeedItem(itemId);
  if (!item) throw new FeedItemNotFoundError(itemId);

  const now = new Date().toISOString();
  const nextStatus = statusForAction(input.action, item.status);
  const nextScopeIds =
    input.action === "share" && input.target_scope_id
      ? uniqueStrings([...item.scope_ids, input.target_scope_id])
      : item.scope_ids;
  const nextMetadata =
    input.action === "share" && input.target_scope_id
      ? {
          ...item.metadata,
          shared_to: uniqueStrings([
            ...((item.metadata.shared_to as string[] | undefined) ?? []),
            input.target_scope_id,
          ]),
        }
      : item.metadata;

  getDb()
    .prepare(
      `
        UPDATE feed_items
        SET status = ?, scope_ids = ?, metadata = ?, updated_at = ?, last_action_at = ?
        WHERE id = ?
      `,
    )
    .run(
      nextStatus,
      encode(nextScopeIds),
      encode(nextMetadata),
      now,
      now,
      itemId,
    );

  const actionRecord = {
    id: `feed_action_${nanoid(10)}`,
    item_id: itemId,
    action: input.action,
    actor: input.actor,
    note: input.note ?? null,
    target_scope_id: input.target_scope_id ?? null,
    inserted_at: now,
  } satisfies FeedAction;

  getDb()
    .prepare(
      `
        INSERT INTO feed_item_actions (id, item_id, action, actor, note, target_scope_id, inserted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      actionRecord.id,
      actionRecord.item_id,
      actionRecord.action,
      actionRecord.actor,
      actionRecord.note,
      actionRecord.target_scope_id,
      actionRecord.inserted_at,
    );

  let conversation: FeedConversation | undefined;
  const suggestedMode = conversationModeForAction(input.action);
  if (suggestedMode) {
    conversation = {
      id: `feed_conversation_${nanoid(10)}`,
      item_id: itemId,
      title: conversationTitleForAction(input.action, item.title),
      suggested_mode: suggestedMode,
      opener: conversationOpenerForAction(item, input),
      status: input.action === "start_chat" ? "open" : "queued",
      inserted_at: now,
      updated_at: now,
    };
    getDb()
      .prepare(
        `
          INSERT INTO feed_conversations (id, item_id, title, suggested_mode, opener, status, inserted_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        conversation.id,
        conversation.item_id,
        conversation.title,
        conversation.suggested_mode,
        conversation.opener,
        conversation.status,
        conversation.inserted_at,
        conversation.updated_at,
      );
  }

  return {
    item: getFeedItem(itemId) as FeedItem,
    action: feedActionSchema.parse(actionRecord),
    ...(conversation ? { conversation: feedConversationSchema.parse(conversation) } : {}),
  };
}

export function seedFeedWorkspace(): void {
  initFeeds();
  const db = getDb();

  const hasViews = db
    .prepare("SELECT COUNT(*) as count FROM feed_views")
    .get() as { count: number };
  if (hasViews.count > 0) return;

  const sources: FeedSource[] = [
    {
      id: "feed_source_signal_essays",
      name: "Signal Essays",
      kind: "rss",
      url: "https://example.com/signal-essays",
      description: "Long-form conceptual writing about curation, systems, and attention.",
      default_weight: 0.83,
      active: true,
      inserted_at: isoAt(-96),
      updated_at: isoAt(-96),
    },
    {
      id: "feed_source_youtube_curiosity",
      name: "Curiosity Video",
      kind: "youtube",
      url: "https://example.com/curiosity-video",
      description: "Video essays and analogies that make dense ideas easier to act on.",
      default_weight: 0.88,
      active: true,
      inserted_at: isoAt(-96),
      updated_at: isoAt(-96),
    },
    {
      id: "feed_source_github_watch",
      name: "GitHub Watch",
      kind: "github",
      url: "https://example.com/github-watch",
      description: "Repos and operator tools worth stealing patterns from.",
      default_weight: 0.79,
      active: true,
      inserted_at: isoAt(-96),
      updated_at: isoAt(-96),
    },
    {
      id: "feed_source_social_patterns",
      name: "Social Patterns",
      kind: "reddit",
      url: "https://example.com/social-patterns",
      description: "Operator anecdotes, threads, and community observations.",
      default_weight: 0.72,
      active: true,
      inserted_at: isoAt(-96),
      updated_at: isoAt(-96),
    },
  ];

  const views: FeedView[] = [
    {
      id: "feed_view_reader_personal",
      title: "Personal Reader",
      surface: "reader",
      scope_id: "personal",
      scope_kind: "personal",
      prompt:
        "Show things that expand taste, sharpen judgment, and create useful analogies for EMA.",
      filters: { kind: ["video", "article", "thread"] },
      share_targets: ["org:ema", "space:studio"],
      inserted_at: isoAt(-72),
      updated_at: isoAt(-72),
    },
    {
      id: "feed_view_reader_global",
      title: "World Scan",
      surface: "reader",
      scope_id: "global",
      scope_kind: "global",
      prompt:
        "Bias toward surprisingly original material, humane product thinking, and strong taste.",
      filters: { kind: ["video", "article", "repo", "thread"] },
      share_targets: ["personal"],
      inserted_at: isoAt(-72),
      updated_at: isoAt(-72),
    },
    {
      id: "feed_view_triage_personal",
      title: "Personal Triage",
      surface: "triage",
      scope_id: "personal",
      scope_kind: "personal",
      prompt:
        "Prioritize timely signals, edges worth testing, and items that could alter this week's decisions.",
      filters: { status: ["fresh", "saved", "acted_on"] },
      share_targets: ["space:studio", "org:ema"],
      inserted_at: isoAt(-72),
      updated_at: isoAt(-72),
    },
    {
      id: "feed_view_triage_studio",
      title: "Studio Queue",
      surface: "triage",
      scope_id: "space:studio",
      scope_kind: "space",
      prompt:
        "Surface practical references for the feed system, social replacement flows, and ranking ergonomics.",
      filters: { status: ["fresh", "saved", "promoted"] },
      share_targets: ["org:ema"],
      inserted_at: isoAt(-72),
      updated_at: isoAt(-72),
    },
    {
      id: "feed_view_agent_personal",
      title: "Personal Agent Console",
      surface: "agent",
      scope_id: "personal",
      scope_kind: "personal",
      prompt:
        "Show items that can become research sessions, build slices, or high-leverage conversations right now.",
      filters: { actions: ["queue_research", "queue_build", "start_chat"] },
      share_targets: ["space:studio"],
      inserted_at: isoAt(-72),
      updated_at: isoAt(-72),
    },
    {
      id: "feed_view_agent_org",
      title: "Org Relay",
      surface: "agent",
      scope_id: "org:ema",
      scope_kind: "organization",
      prompt:
        "Highlight durable organizational signals and things worth routing into a shared queue.",
      filters: { actions: ["promote", "queue_build", "share"] },
      share_targets: ["personal"],
      inserted_at: isoAt(-72),
      updated_at: isoAt(-72),
    },
  ];

  const commonActions: FeedActionType[] = [
    "save",
    "promote",
    "hide",
    "queue_research",
    "queue_build",
    "start_chat",
    "share",
  ];

  const items: FeedItem[] = [
    {
      id: "feed_item_restaurant_signal",
      source_id: "feed_source_youtube_curiosity",
      canonical_url: "https://example.com/watch/restaurant-signal",
      title: "How kitchens separate signal from noise during service",
      summary:
        "A chef's mise en place becomes an analogy for triage: prep the likely moves, keep the station legible, and let the rush reveal the real bottleneck.",
      creator: "Field Notes Kitchen",
      kind: "video",
      status: "fresh",
      score: { overall: 0.82, novelty: 0.8, relevance: 0.78, signal: 0.74, recency: 0.73, serendipity: 0.88 },
      signals: ["triage", "operations", "analogy"],
      tags: ["food", "workflow", "attention"],
      scope_ids: ["global", "personal"],
      available_actions: commonActions,
      cover_color: "#f97316",
      metadata: { duration: "16m", media: "video" },
      discovered_at: isoAt(-18),
      published_at: isoAt(-24),
      inserted_at: isoAt(-18),
      updated_at: isoAt(-18),
      last_action_at: null,
    },
    {
      id: "feed_item_certainty_trap",
      source_id: "feed_source_signal_essays",
      canonical_url: "https://example.com/read/certainty-trap",
      title: "Algorithmic certainty is a trap, not a feature",
      summary:
        "An essay arguing that the strongest feeds leave room for operator override, uncertainty, and visible reasons instead of pretending the model always knows best.",
      creator: "Signal Essays",
      kind: "article",
      status: "saved",
      score: { overall: 0.9, novelty: 0.71, relevance: 0.93, signal: 0.87, recency: 0.66, serendipity: 0.69 },
      signals: ["ranking transparency", "operator control", "product philosophy"],
      tags: ["feeds", "ema", "systems"],
      scope_ids: ["global", "personal", "space:studio"],
      available_actions: commonActions,
      cover_color: "#6366f1",
      metadata: { reading_time: "9 min", media: "article" },
      discovered_at: isoAt(-32),
      published_at: isoAt(-42),
      inserted_at: isoAt(-32),
      updated_at: isoAt(-32),
      last_action_at: isoAt(-8),
    },
    {
      id: "feed_item_graph_workspace_repo",
      source_id: "feed_source_github_watch",
      canonical_url: "https://example.com/repo/graph-workspace",
      title: "Graph-first workspace starter for linking sources to actions",
      summary:
        "A repo pattern worth stealing: source cards, explainable ranking metadata, and one-click promotion from reading into durable work objects.",
      creator: "Open Builders",
      kind: "repo",
      status: "promoted",
      score: { overall: 0.88, novelty: 0.76, relevance: 0.95, signal: 0.82, recency: 0.7, serendipity: 0.61 },
      signals: ["promotion flow", "graph structure", "product architecture"],
      tags: ["github", "build", "ema"],
      scope_ids: ["space:studio", "org:ema"],
      available_actions: commonActions,
      cover_color: "#10b981",
      metadata: { stars_hint: "mid", media: "repo" },
      discovered_at: isoAt(-14),
      published_at: isoAt(-54),
      inserted_at: isoAt(-14),
      updated_at: isoAt(-14),
      last_action_at: isoAt(-5),
    },
    {
      id: "feed_item_small_list_manifesto",
      source_id: "feed_source_signal_essays",
      canonical_url: "https://example.com/read/small-list",
      title: "The small list beats the endless feed",
      summary:
        "A case for bounded daily selections: fewer items, better annotations, and stronger memory because the system forces choice instead of passive scroll.",
      creator: "Signal Essays",
      kind: "article",
      status: "fresh",
      score: { overall: 0.78, novelty: 0.62, relevance: 0.82, signal: 0.71, recency: 0.77, serendipity: 0.83 },
      signals: ["bounded list", "memory", "product UX"],
      tags: ["reader", "curation", "design"],
      scope_ids: ["global", "personal"],
      available_actions: commonActions,
      cover_color: "#f59e0b",
      metadata: { reading_time: "6 min", media: "article" },
      discovered_at: isoAt(-9),
      published_at: isoAt(-20),
      inserted_at: isoAt(-9),
      updated_at: isoAt(-9),
      last_action_at: null,
    },
    {
      id: "feed_item_retention_vs_curiosity",
      source_id: "feed_source_youtube_curiosity",
      canonical_url: "https://example.com/watch/retention-curiosity",
      title: "Designing for curiosity instead of retention",
      summary:
        "A personable talk about replacing habit loops with intrigue loops: make the next item feel like a doorway, not a trap door.",
      creator: "Studio Public",
      kind: "video",
      status: "fresh",
      score: { overall: 0.86, novelty: 0.74, relevance: 0.85, signal: 0.75, recency: 0.81, serendipity: 0.84 },
      signals: ["curiosity", "retention critique", "product voice"],
      tags: ["video essay", "social replacement", "taste"],
      scope_ids: ["global", "personal", "org:ema"],
      available_actions: commonActions,
      cover_color: "#ec4899",
      metadata: { duration: "22m", media: "video" },
      discovered_at: isoAt(-6),
      published_at: isoAt(-16),
      inserted_at: isoAt(-6),
      updated_at: isoAt(-6),
      last_action_at: null,
    },
    {
      id: "feed_item_operator_thread",
      source_id: "feed_source_social_patterns",
      canonical_url: "https://example.com/thread/operator-habits",
      title: "Operators on what they actually save vs what they only admire",
      summary:
        "A thread collecting the gap between performative inspiration and genuinely reusable references, useful for teaching EMA what deserves durable promotion.",
      creator: "Social Patterns",
      kind: "thread",
      status: "acted_on",
      score: { overall: 0.77, novelty: 0.67, relevance: 0.89, signal: 0.84, recency: 0.69, serendipity: 0.58 },
      signals: ["save behavior", "promotion policy", "user research"],
      tags: ["thread", "signals", "behavior"],
      scope_ids: ["personal", "space:studio"],
      available_actions: commonActions,
      cover_color: "#06b6d4",
      metadata: { comments: 43, media: "thread" },
      discovered_at: isoAt(-28),
      published_at: isoAt(-30),
      inserted_at: isoAt(-28),
      updated_at: isoAt(-28),
      last_action_at: isoAt(-3),
    },
    {
      id: "feed_item_build_queue_brief",
      source_id: "feed_source_signal_essays",
      canonical_url: "https://example.com/brief/build-queue",
      title: "Org brief: which feed signals deserve a build spike this week",
      summary:
        "A compact brief meant for an agent console: compare ranking transparency, save-to-workflow friction, and triage ergonomics before shipping the next slice.",
      creator: "EMA Internal",
      kind: "brief",
      status: "fresh",
      score: { overall: 0.91, novelty: 0.58, relevance: 0.97, signal: 0.92, recency: 0.88, serendipity: 0.44 },
      signals: ["build spike", "ship next", "org context"],
      tags: ["brief", "agent", "delivery"],
      scope_ids: ["org:ema", "space:studio"],
      available_actions: commonActions,
      cover_color: "#8b5cf6",
      metadata: { media: "brief" },
      discovered_at: isoAt(-4),
      published_at: isoAt(-4),
      inserted_at: isoAt(-4),
      updated_at: isoAt(-4),
      last_action_at: null,
    },
    {
      id: "feed_item_research_harness",
      source_id: "feed_source_github_watch",
      canonical_url: "https://example.com/repo/research-harness",
      title: "Research-agent harness for explainable scoring and retries",
      summary:
        "A repo pattern focused on low-risk automation: deterministic first pass, agent pass second, and visible reasons for why an item moved up or down.",
      creator: "Open Builders",
      kind: "repo",
      status: "fresh",
      score: { overall: 0.89, novelty: 0.73, relevance: 0.94, signal: 0.86, recency: 0.79, serendipity: 0.55 },
      signals: ["hybrid ranking", "agent retry", "explainability"],
      tags: ["repo", "ranking", "agents"],
      scope_ids: ["space:studio", "org:ema"],
      available_actions: commonActions,
      cover_color: "#22c55e",
      metadata: { media: "repo" },
      discovered_at: isoAt(-12),
      published_at: isoAt(-40),
      inserted_at: isoAt(-12),
      updated_at: isoAt(-12),
      last_action_at: null,
    },
    {
      id: "feed_item_compost_analogy",
      source_id: "feed_source_youtube_curiosity",
      canonical_url: "https://example.com/watch/compost-analogy",
      title: "Compost piles, queues, and why not every input becomes a meal",
      summary:
        "A playful analogy for intake systems: some material should decompose into broader context instead of being pushed straight into an execution queue.",
      creator: "Backyard Systems",
      kind: "video",
      status: "fresh",
      score: { overall: 0.73, novelty: 0.84, relevance: 0.68, signal: 0.64, recency: 0.75, serendipity: 0.92 },
      signals: ["intake policy", "analogy", "composting"],
      tags: ["food", "systems", "brain dump"],
      scope_ids: ["global", "personal"],
      available_actions: commonActions,
      cover_color: "#84cc16",
      metadata: { duration: "11m", media: "video" },
      discovered_at: isoAt(-22),
      published_at: isoAt(-26),
      inserted_at: isoAt(-22),
      updated_at: isoAt(-22),
      last_action_at: null,
    },
    {
      id: "feed_item_promptable_algo",
      source_id: "feed_source_signal_essays",
      canonical_url: "https://example.com/read/promptable-algo",
      title: "Promptable algorithms need guardrails, not vibes",
      summary:
        "A short piece on letting users steer ranking language while still keeping deterministic rails, bounded scopes, and visible failure modes.",
      creator: "Signal Essays",
      kind: "article",
      status: "fresh",
      score: { overall: 0.92, novelty: 0.68, relevance: 0.98, signal: 0.89, recency: 0.85, serendipity: 0.51 },
      signals: ["prompt tuning", "guardrails", "ranking"],
      tags: ["algorithm", "controls", "ema"],
      scope_ids: ["personal", "space:studio", "org:ema"],
      available_actions: commonActions,
      cover_color: "#3b82f6",
      metadata: { reading_time: "7 min", media: "article" },
      discovered_at: isoAt(-2),
      published_at: isoAt(-12),
      inserted_at: isoAt(-2),
      updated_at: isoAt(-2),
      last_action_at: null,
    },
    {
      id: "feed_item_hidden_junk",
      source_id: "feed_source_social_patterns",
      canonical_url: "https://example.com/thread/noisy-hack",
      title: "Viral posting hack thread with no durable signal",
      summary:
        "Included on purpose so the app has a hidden state and a bad example to demote.",
      creator: "Noise Factory",
      kind: "thread",
      status: "hidden",
      score: { overall: 0.19, novelty: 0.22, relevance: 0.18, signal: 0.08, recency: 0.74, serendipity: 0.11 },
      signals: ["retention bait"],
      tags: ["bad pattern", "noise"],
      scope_ids: ["global", "personal"],
      available_actions: commonActions,
      cover_color: "#64748b",
      metadata: { media: "thread" },
      discovered_at: isoAt(-1),
      published_at: isoAt(-1),
      inserted_at: isoAt(-1),
      updated_at: isoAt(-1),
      last_action_at: isoAt(-1),
    },
  ];

  const actionSeed: FeedAction = {
    id: "feed_action_seed_saved",
    item_id: "feed_item_certainty_trap",
    action: "save",
    actor: "user:trajan",
    note: "Core principle for the first feed slice.",
    target_scope_id: null,
    inserted_at: isoAt(-8),
  };

  const conversationSeed: FeedConversation = {
    id: "feed_conversation_seed_1",
    item_id: "feed_item_operator_thread",
    title: "Research session: save behavior and promotion thresholds",
    suggested_mode: "research",
    opener:
      "Collect patterns from the thread and turn them into concrete save/promote heuristics for EMA Feeds.",
    status: "queued",
    inserted_at: isoAt(-3),
    updated_at: isoAt(-3),
  };

  const insertSource = db.prepare(
    `
      INSERT INTO feed_sources (id, name, kind, url, description, default_weight, active, inserted_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  );
  for (const source of sources) {
    insertSource.run(
      source.id,
      source.name,
      source.kind,
      source.url ?? null,
      source.description ?? null,
      String(source.default_weight),
      source.active ? "1" : "0",
      source.inserted_at,
      source.updated_at,
    );
  }

  const insertView = db.prepare(
    `
      INSERT INTO feed_views (id, title, surface, scope_id, scope_kind, prompt, filters, share_targets, inserted_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  );
  for (const view of views) {
    insertView.run(
      view.id,
      view.title,
      view.surface,
      view.scope_id,
      view.scope_kind,
      view.prompt,
      encode(view.filters),
      encode(view.share_targets),
      view.inserted_at,
      view.updated_at,
    );
  }

  const insertItem = db.prepare(
    `
      INSERT INTO feed_items (
        id, source_id, canonical_url, title, summary, creator, kind, status, score, signals, tags,
        scope_ids, available_actions, cover_color, metadata, discovered_at, published_at, inserted_at, updated_at, last_action_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  );
  for (const item of items) {
    insertItem.run(
      item.id,
      item.source_id,
      item.canonical_url ?? null,
      item.title,
      item.summary,
      item.creator ?? null,
      item.kind,
      item.status,
      encode(item.score),
      encode(item.signals),
      encode(item.tags),
      encode(item.scope_ids),
      encode(item.available_actions),
      item.cover_color ?? null,
      encode(item.metadata),
      item.discovered_at,
      item.published_at ?? null,
      item.inserted_at,
      item.updated_at,
      item.last_action_at ?? null,
    );
  }

  db.prepare(
    `
      INSERT INTO feed_item_actions (id, item_id, action, actor, note, target_scope_id, inserted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    actionSeed.id,
    actionSeed.item_id,
    actionSeed.action,
    actionSeed.actor,
    actionSeed.note,
    actionSeed.target_scope_id,
    actionSeed.inserted_at,
  );

  db.prepare(
    `
      INSERT INTO feed_conversations (id, item_id, title, suggested_mode, opener, status, inserted_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    conversationSeed.id,
    conversationSeed.item_id,
    conversationSeed.title,
    conversationSeed.suggested_mode,
    conversationSeed.opener,
    conversationSeed.status,
    conversationSeed.inserted_at,
    conversationSeed.updated_at,
  );
}
