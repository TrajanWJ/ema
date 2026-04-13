// Schemas (Zod — source of truth)
export * from "./schemas/index.js";

// Events
export * from "./events/index.js";

// Contracts
export * from "./contracts/index.js";

// Types (inferred from schemas)
// PaginationOpts is already exported from schemas, so exclude it here
export type {
  Setting,
  Task,
  TaskStatus,
  TaskPriority,
  TaskEffort,
  Project,
  ProjectStatus,
  InboxItem,
  BrainDumpSource,
  BrainDumpStatus,
  Habit,
  HabitLog,
  HabitCadence,
  Proposal,
  ProposalStatus,
  Intent,
  IntentLevel,
  IntentStatus,
  Agent,
  AgentStatus,
  ServiceContract,
} from "./types/index.js";

// Constants
export * from "./constants/index.js";

// `@ema/core` SDK facade (GAC-006). Re-exported here so the default package
// entrypoint surfaces it, and via the `./sdk` subpath export for vApps that
// want only the client.
export { createEmaClient } from "./sdk/index.js";
export type { EmaClient, EmaClientOptions } from "./sdk/index.js";
