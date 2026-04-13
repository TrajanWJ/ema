/**
 * Pipes subservice public API.
 *
 * Consumers typically want:
 *   - `pipeBus` to fire trigger events
 *   - `createPipe` / `listPipes` / `togglePipe` for CRUD
 *   - `executePipe` to manually run a pipe
 *   - `registry` to enumerate the stock 21/21/5 catalog
 */

export { registry } from "./registry.js";
export type { PipesRegistry } from "./registry.js";

export { pipeBus, PipeBus } from "./bus.js";

export {
  createPipe,
  deletePipe,
  finishPipeRun,
  getPipe,
  getPipeRun,
  initPipes,
  InvalidPipeError,
  listPipes,
  listPipeRuns,
  PipeNotFoundError,
  resetPipesInitFlag,
  startPipeRun,
  togglePipe,
} from "./service.js";

export type {
  CreatePipeInput,
  FinishRunInput,
  ListPipesFilter,
  ListRunsFilter,
  StartRunInput,
} from "./service.js";

export { attachPipeBusExecutor, executePipe } from "./executor.js";

export type {
  ActionContext,
  ActionDef,
  ActionName,
  Pipe,
  PipeBusEvent,
  PipeBusHandler,
  PipeRun,
  PipeRunStatus,
  PipeTransformStep,
  TransformDef,
  TransformName,
  TransformResult,
  TriggerDef,
  TriggerName,
} from "./types.js";

export {
  setClaudeComposer,
  setClaudeProvider,
} from "./actions/claude.js";
export type { ClaudeProvider } from "./actions/claude.js";

export {
  setClaudeTransformComposer,
  setClaudeTransformProvider,
} from "./transforms/claude.js";
export type { ClaudeTransformProvider } from "./transforms/claude.js";

export { registerPipesRoutes } from "./routes.js";
export { registerPipesMcpTools, pipesMcpTools } from "./mcp-tools.js";
export type { PipesMcpTool } from "./mcp-tools.js";
