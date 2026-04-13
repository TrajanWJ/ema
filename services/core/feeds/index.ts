export {
  actOnFeedItem,
  FeedItemNotFoundError,
  FeedViewNotFoundError,
  getFeedItem,
  getFeedWorkspace,
  initFeeds,
  listFeedViews,
  seedFeedWorkspace,
  updateFeedViewPrompt,
  type FeedActionInput,
  type FeedActionResult,
  type FeedWorkspaceQuery,
} from "./service.js";

export { registerFeedsRoutes } from "./routes.js";

export {
  applyFeedsDdl,
  FEEDS_DDL,
  feedConversations,
  feedItemActions,
  feedItems,
  feedSources,
  feedViews,
} from "./schema.js";
