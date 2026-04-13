/**
 * UserState subservice — public surface.
 *
 * Answers GAC-010 (user state awareness — distress/focus/energy) with a
 * singleton runtime snapshot + append-only ring buffer. See
 * `ema-genesis/intents/GAC-010/README.md` for the open question and
 * `heuristics.ts` for the documented signal-aggregation rules.
 */

export {
  getCurrentUserState,
  getUserStateHistory,
  initUserState,
  recordSignal,
  resetUserState,
  updateUserState,
  userStateEvents,
  type UpdateUserStateInput,
  type UserStateEvent,
  type UserStateHistoryEntry,
  type UserStateHistoryFilter,
} from "./service.js";

export {
  applySignal,
  DISTRESS_BLOCK_THRESHOLD,
  DISTRESS_WINDOW_MS,
  DRIFT_SATURATION_THRESHOLD,
  type HeuristicInput,
  type HeuristicResult,
} from "./heuristics.js";

export { registerUserStateRoutes } from "./routes.js";

export {
  registerUserStateMcpTools,
  userStateMcpTools,
  type UserStateMcpTool,
} from "./mcp-tools.js";

export {
  applyUserStateDdl,
  SNAPSHOT_RING_SIZE,
  USER_STATE_DDL,
  userStateCurrent,
  userStateSnapshots,
} from "./schema.js";
