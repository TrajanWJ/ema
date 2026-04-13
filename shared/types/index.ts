import type { z } from "zod";
import type { settingSchema } from "../schemas/settings.js";
import type {
  taskSchema,
  taskStatusSchema,
  taskPrioritySchema,
  taskEffortSchema,
} from "../schemas/tasks.js";
import type { projectSchema, projectStatusSchema } from "../schemas/projects.js";
import type {
  inboxItemSchema,
  brainDumpSourceSchema,
  brainDumpStatusSchema,
} from "../schemas/brain-dump.js";
import type {
  habitSchema,
  habitLogSchema,
  habitCadenceSchema,
} from "../schemas/habits.js";
import type {
  proposalSchema,
  proposalStatusSchema,
} from "../schemas/proposals.js";
import type {
  intentSchema,
  intentLevelSchema,
  intentStatusSchema,
} from "../schemas/intents.js";
import type {
  agentSchema,
  agentStatusSchema,
} from "../schemas/agents.js";
import type {
  goalSchema,
  goalOwnerKindSchema,
  goalStatusSchema,
  goalTimeframeSchema,
} from "../schemas/goals.js";
import type {
  humanOpsDateSchema,
  humanOpsDaySchema,
  humanOpsDayUpdateSchema,
} from "../schemas/human-ops.js";
import type {
  calendarEntryKindSchema,
  calendarEntrySchema,
  calendarEntryStatusSchema,
} from "../schemas/calendar.js";
import type {
  feedActionSchema,
  feedConversationSchema,
  feedConversationStatusSchema,
  feedItemSchema,
  feedItemKindSchema,
  feedItemStatusSchema,
  feedScopeKindSchema,
  feedSourceKindSchema,
  feedSourceSchema,
  feedSuggestedModeSchema,
  feedSurfaceSchema,
  feedViewSchema,
  feedWorkspaceSchema,
  feedWorkspaceStatsSchema,
} from "../schemas/feeds.js";
import type {
  chronicleArtifactKindSchema,
  chronicleArtifactSchema,
  chronicleEntryKindSchema,
  chronicleEntryRoleSchema,
  chronicleEntrySchema,
  chronicleSessionDetailSchema,
  chronicleSessionSchema,
  chronicleSessionStatusSchema,
  chronicleSessionSummarySchema,
  chronicleSourceKindSchema,
  chronicleSourceSchema,
  createChronicleImportInputSchema,
} from "../schemas/chronicle.js";
import type {
  chronicleExtractionKindSchema,
  chronicleExtractionRunSchema,
  chronicleExtractionSchema,
  chronicleExtractionStatusSchema,
  listReviewItemsFilterSchema,
  promoteReviewItemInputSchema,
  promotionModeSchema,
  promotionReceiptSchema,
  promotionTargetKindSchema,
  reviewChronicleArtifactSchema,
  reviewChronicleEntrySchema,
  reviewChronicleSessionSchema,
  reviewDecisionInputSchema,
  reviewItemDetailSchema,
  reviewItemSchema,
  reviewItemStatusSchema,
  reviewTargetKindSchema,
  reviewItemSummarySchema,
  reviewSourceKindSchema,
  reviewSourceLinkSchema,
} from "../schemas/review.js";
import type { paginationSchema } from "../schemas/common.js";

export type Setting = z.infer<typeof settingSchema>;

export type Task = z.infer<typeof taskSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskEffort = z.infer<typeof taskEffortSchema>;

export type Project = z.infer<typeof projectSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export type InboxItem = z.infer<typeof inboxItemSchema>;
export type BrainDumpSource = z.infer<typeof brainDumpSourceSchema>;
export type BrainDumpStatus = z.infer<typeof brainDumpStatusSchema>;

export type Habit = z.infer<typeof habitSchema>;
export type HabitLog = z.infer<typeof habitLogSchema>;
export type HabitCadence = z.infer<typeof habitCadenceSchema>;

export type Proposal = z.infer<typeof proposalSchema>;
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;

export type Intent = z.infer<typeof intentSchema>;
export type IntentLevel = z.infer<typeof intentLevelSchema>;
export type IntentStatus = z.infer<typeof intentStatusSchema>;

export type Agent = z.infer<typeof agentSchema>;
export type AgentStatus = z.infer<typeof agentStatusSchema>;

export type Goal = z.infer<typeof goalSchema>;
export type GoalTimeframe = z.infer<typeof goalTimeframeSchema>;
export type GoalStatus = z.infer<typeof goalStatusSchema>;
export type GoalOwnerKind = z.infer<typeof goalOwnerKindSchema>;

export type HumanOpsDate = z.infer<typeof humanOpsDateSchema>;
export type HumanOpsDay = z.infer<typeof humanOpsDaySchema>;
export type HumanOpsDayUpdate = z.infer<typeof humanOpsDayUpdateSchema>;

export type CalendarEntry = z.infer<typeof calendarEntrySchema>;
export type CalendarEntryKind = z.infer<typeof calendarEntryKindSchema>;
export type CalendarEntryStatus = z.infer<typeof calendarEntryStatusSchema>;

export type FeedSourceKind = z.infer<typeof feedSourceKindSchema>;
export type FeedSurface = z.infer<typeof feedSurfaceSchema>;
export type FeedScopeKind = z.infer<typeof feedScopeKindSchema>;
export type FeedItemKind = z.infer<typeof feedItemKindSchema>;
export type FeedItemStatus = z.infer<typeof feedItemStatusSchema>;
export type FeedConversationStatus = z.infer<typeof feedConversationStatusSchema>;
export type FeedSuggestedMode = z.infer<typeof feedSuggestedModeSchema>;
export type FeedSource = z.infer<typeof feedSourceSchema>;
export type FeedView = z.infer<typeof feedViewSchema>;
export type FeedItem = z.infer<typeof feedItemSchema>;
export type FeedAction = z.infer<typeof feedActionSchema>;
export type FeedConversation = z.infer<typeof feedConversationSchema>;
export type FeedWorkspaceStats = z.infer<typeof feedWorkspaceStatsSchema>;
export type FeedWorkspace = z.infer<typeof feedWorkspaceSchema>;

export type ChronicleSourceKind = z.infer<typeof chronicleSourceKindSchema>;
export type ChronicleSessionStatus = z.infer<typeof chronicleSessionStatusSchema>;
export type ChronicleEntryRole = z.infer<typeof chronicleEntryRoleSchema>;
export type ChronicleEntryKind = z.infer<typeof chronicleEntryKindSchema>;
export type ChronicleArtifactKind = z.infer<typeof chronicleArtifactKindSchema>;
export type ChronicleSource = z.infer<typeof chronicleSourceSchema>;
export type ChronicleSession = z.infer<typeof chronicleSessionSchema>;
export type ChronicleEntry = z.infer<typeof chronicleEntrySchema>;
export type ChronicleArtifact = z.infer<typeof chronicleArtifactSchema>;
export type ChronicleSessionSummary = z.infer<typeof chronicleSessionSummarySchema>;
export type ChronicleSessionDetail = z.infer<typeof chronicleSessionDetailSchema>;
export type CreateChronicleImportInput = z.infer<typeof createChronicleImportInputSchema>;
export type ReviewSourceKind = z.infer<typeof reviewSourceKindSchema>;
export type ChronicleExtractionKind = z.infer<typeof chronicleExtractionKindSchema>;
export type ChronicleExtractionStatus = z.infer<typeof chronicleExtractionStatusSchema>;
export type ReviewItemStatus = z.infer<typeof reviewItemStatusSchema>;
export type ReviewTargetKind = z.infer<typeof reviewTargetKindSchema>;
export type PromotionTargetKind = z.infer<typeof promotionTargetKindSchema>;
export type PromotionMode = z.infer<typeof promotionModeSchema>;
export type ChronicleExtraction = z.infer<typeof chronicleExtractionSchema>;
export type ReviewItem = z.infer<typeof reviewItemSchema>;
export type PromotionReceipt = z.infer<typeof promotionReceiptSchema>;
export type ReviewItemSummary = z.infer<typeof reviewItemSummarySchema>;
export type ReviewChronicleSession = z.infer<typeof reviewChronicleSessionSchema>;
export type ReviewChronicleEntry = z.infer<typeof reviewChronicleEntrySchema>;
export type ReviewChronicleArtifact = z.infer<typeof reviewChronicleArtifactSchema>;
export type ReviewSourceLink = z.infer<typeof reviewSourceLinkSchema>;
export type ReviewItemDetail = z.infer<typeof reviewItemDetailSchema>;
export type ListReviewItemsFilter = z.input<typeof listReviewItemsFilterSchema>;
export type ReviewDecisionInput = z.input<typeof reviewDecisionInputSchema>;
export type PromoteReviewItemInput = z.input<typeof promoteReviewItemInputSchema>;
export type ChronicleExtractionRun = z.infer<typeof chronicleExtractionRunSchema>;

export type PaginationOpts = z.infer<typeof paginationSchema>;

// Re-export event types
export type {
  EmaEvent,
  TaskEvent,
  ProjectEvent,
  ProposalEvent,
  IntentEvent,
  AgentEvent,
  DomainEvent,
} from "../events/index.js";

// Re-export service contract
export type { ServiceContract } from "../contracts/service.js";
