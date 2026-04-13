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
