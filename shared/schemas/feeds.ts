import { z } from "zod";

import { idSchema, timestampSchema } from "./common.js";

export const feedSourceKindSchema = z.enum([
  "rss",
  "youtube",
  "github",
  "reddit",
  "hacker_news",
  "manual",
  "web",
]);

export const feedSurfaceSchema = z.enum([
  "reader",
  "triage",
  "agent",
]);

export const feedScopeKindSchema = z.enum([
  "global",
  "personal",
  "space",
  "organization",
  "shared",
]);

export const feedItemKindSchema = z.enum([
  "video",
  "article",
  "thread",
  "repo",
  "brief",
  "note",
]);

export const feedItemStatusSchema = z.enum([
  "fresh",
  "saved",
  "promoted",
  "hidden",
  "acted_on",
]);

export const feedActionTypeSchema = z.enum([
  "save",
  "promote",
  "hide",
  "dismiss",
  "queue_research",
  "queue_build",
  "start_chat",
  "share",
]);

export const feedConversationStatusSchema = z.enum([
  "open",
  "queued",
  "resolved",
]);

export const feedSuggestedModeSchema = z.enum([
  "chat",
  "research",
  "build",
  "brief",
]);

export const feedScoreSchema = z.object({
  overall: z.number().min(0).max(1),
  novelty: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
  signal: z.number().min(0).max(1),
  recency: z.number().min(0).max(1),
  serendipity: z.number().min(0).max(1),
});

export const feedSourceSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  kind: feedSourceKindSchema,
  url: z.string().url().nullable().optional(),
  description: z.string().nullable().optional(),
  default_weight: z.number().min(0).max(1),
  active: z.boolean(),
  inserted_at: timestampSchema,
  updated_at: timestampSchema,
});

export const feedViewSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  surface: feedSurfaceSchema,
  scope_id: z.string().min(1),
  scope_kind: feedScopeKindSchema,
  prompt: z.string(),
  filters: z.record(z.unknown()),
  share_targets: z.array(z.string()),
  inserted_at: timestampSchema,
  updated_at: timestampSchema,
});

export const feedItemSchema = z.object({
  id: idSchema,
  source_id: z.string().min(1),
  canonical_url: z.string().url().nullable().optional(),
  title: z.string().min(1),
  summary: z.string().min(1),
  creator: z.string().nullable().optional(),
  kind: feedItemKindSchema,
  status: feedItemStatusSchema,
  score: feedScoreSchema,
  signals: z.array(z.string()),
  tags: z.array(z.string()),
  scope_ids: z.array(z.string()),
  available_actions: z.array(feedActionTypeSchema),
  cover_color: z.string().nullable().optional(),
  metadata: z.record(z.unknown()),
  discovered_at: timestampSchema,
  published_at: timestampSchema.nullable().optional(),
  inserted_at: timestampSchema,
  updated_at: timestampSchema,
  last_action_at: timestampSchema.nullable().optional(),
  ranked_score: z.number().nullable().optional(),
  rank_reasons: z.array(z.string()).optional(),
});

export const feedActionSchema = z.object({
  id: idSchema,
  item_id: z.string().min(1),
  action: feedActionTypeSchema,
  actor: z.string().min(1),
  note: z.string().nullable().optional(),
  target_scope_id: z.string().nullable().optional(),
  inserted_at: timestampSchema,
});

export const feedConversationSchema = z.object({
  id: idSchema,
  item_id: z.string().min(1),
  title: z.string().min(1),
  suggested_mode: feedSuggestedModeSchema,
  opener: z.string().min(1),
  status: feedConversationStatusSchema,
  inserted_at: timestampSchema,
  updated_at: timestampSchema,
});

export const feedWorkspaceStatsSchema = z.object({
  total_items: z.number().int().nonnegative(),
  visible_items: z.number().int().nonnegative(),
  saved_items: z.number().int().nonnegative(),
  promoted_items: z.number().int().nonnegative(),
  hidden_items: z.number().int().nonnegative(),
  sources: z.number().int().nonnegative(),
  open_conversations: z.number().int().nonnegative(),
});

export const feedWorkspaceSchema = z.object({
  surface: feedSurfaceSchema,
  scope_id: z.string().min(1),
  active_view_id: z.string().min(1),
  query: z.string(),
  sources: z.array(feedSourceSchema),
  views: z.array(feedViewSchema),
  items: z.array(feedItemSchema),
  recent_actions: z.array(feedActionSchema),
  conversations: z.array(feedConversationSchema),
  stats: feedWorkspaceStatsSchema,
});

export type FeedSourceKind = z.infer<typeof feedSourceKindSchema>;
export type FeedSurface = z.infer<typeof feedSurfaceSchema>;
export type FeedScopeKind = z.infer<typeof feedScopeKindSchema>;
export type FeedItemKind = z.infer<typeof feedItemKindSchema>;
export type FeedItemStatus = z.infer<typeof feedItemStatusSchema>;
export type FeedActionType = z.infer<typeof feedActionTypeSchema>;
export type FeedConversationStatus = z.infer<typeof feedConversationStatusSchema>;
export type FeedSuggestedMode = z.infer<typeof feedSuggestedModeSchema>;
export type FeedScore = z.infer<typeof feedScoreSchema>;
export type FeedSource = z.infer<typeof feedSourceSchema>;
export type FeedView = z.infer<typeof feedViewSchema>;
export type FeedItem = z.infer<typeof feedItemSchema>;
export type FeedAction = z.infer<typeof feedActionSchema>;
export type FeedConversation = z.infer<typeof feedConversationSchema>;
export type FeedWorkspaceStats = z.infer<typeof feedWorkspaceStatsSchema>;
export type FeedWorkspace = z.infer<typeof feedWorkspaceSchema>;
