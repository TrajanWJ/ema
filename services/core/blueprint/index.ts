/**
 * Blueprint subservice — public surface.
 *
 * Operationalises `ema-genesis/canon/decisions/DEC-004-gac-card-backend.md`.
 * Owns the GAC queue: schema, state machine, filesystem mirror, routes,
 * MCP tools.
 */

export {
  blueprintEvents,
  createGacCard,
  answerGacCard,
  deferGacCard,
  promoteGacCard,
  getGacCard,
  listGacCards,
  listGacTransitions,
  initBlueprint,
  softDeleteBySourcePath,
  upsertGacCardFromSource,
  GacNotFoundError,
  type AnswerGacCardInput,
  type BlueprintEvent,
  type CreateGacCardInput,
  type DeferGacCardInput,
  type ListGacCardsFilter,
  type PromoteGacCardInput,
} from "./service.js";

export {
  defaultGacSources,
  filesystemEvents,
  loadAllGacCards,
  parseGacCardFile,
  startGacWatcher,
  type LoadReport,
  type ParsedGacCard,
  type WatcherHandle,
} from "./filesystem.js";

export { registerBlueprintRoutes } from "./routes.js";

export {
  blueprintMcpTools,
  registerBlueprintMcpTools,
  type BlueprintMcpTool,
} from "./mcp-tools.js";

export {
  BLUEPRINT_DDL,
  applyBlueprintDdl,
  gacCards,
  gacTransitions,
} from "./schema.js";

export {
  assertTransition,
  canTransition,
  InvalidTransitionError,
  type GacTransitionRecord,
} from "./state-machine.js";
