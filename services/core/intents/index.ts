/**
 * Intents subservice — public surface.
 *
 * Ports `Ema.Intents` (old Elixir build) to TypeScript. Owns the intent
 * engine: schema, state machine, filesystem mirror, routes, MCP tools.
 *
 * Source of truth: .superman/intents/<slug>/intent.md + status.json
 * and ema-genesis/intents/INT-<SLUG>/README.md. SQLite is the queryable index.
 */

export {
  appendIntentEvent,
  attachActor,
  attachExecution,
  attachLink,
  attachSession,
  createIntent,
  getIntent,
  getIntentPhase,
  getIntentTree,
  getRuntimeBundle,
  initIntents,
  intentsEvents,
  IntentNotFoundError,
  IntentValidationError,
  isValidSlug,
  listIntentEvents,
  listIntentLinks,
  listIntentPhaseTransitions,
  listIntents,
  slugify,
  softDeleteBySourcePath,
  transitionPhase,
  updateIntentStatus,
  upsertIntentFromSource,
  _resetInitForTest,
  type AttachLinkInput,
  type CreateIntentInput,
  type IntentEvent,
  type IntentEventRecord,
  type IntentLinkRecord,
  type IntentLinkTargetType,
  type IntentRuntimeBundle,
  type IntentTreeNode,
  type ListIntentsFilter,
  type TransitionPhaseInput,
  type UpdateStatusInput,
  type UpsertFromSourceInput,
} from "./service.js";

export {
  defaultIntentSources,
  intentsFilesystemEvents,
  loadAllIntents,
  parseIntentFile,
  startIntentWatcher,
  type LoadReport,
  type ParsedIntent,
  type WatcherHandle,
} from "./filesystem.js";

export { registerIntentsRoutes } from "./routes.js";

export {
  intentsMcpTools,
  registerIntentsMcpTools,
  type IntentsMcpTool,
} from "./mcp-tools.js";

export {
  applyIntentsDdl,
  INTENTS_DDL,
  intentEvents,
  intentLinks,
  intentPhaseTransitions,
  intents,
} from "./schema.js";

export {
  assertTransition,
  canTransition,
  intentPhaseSchema,
  InvalidIntentPhaseTransitionError,
  type IntentPhase,
  type IntentPhaseTransitionRecord,
} from "./state-machine.js";
