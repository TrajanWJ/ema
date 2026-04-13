/**
 * Memory subservice — public surface.
 *
 * Today this ships cross-pollination (ported from the old Elixir
 * `Ema.Memory.CrossPollination`). Future subservices (user-level facts,
 * Honcho-style hooks) will re-export from here.
 */

export {
  CrossPollinationNotFoundError,
  CrossPollinationService,
  crossPollinationEvents,
  crossPollinationService,
  initCrossPollination,
  _resetCrossPollinationForTests,
  type CrossPollinationEvent,
  type ListCrossPollinationFilter,
  type RecordCrossPollinationInput,
} from "./cross-pollination.js";

export {
  CROSS_POLLINATION_DDL,
  applyCrossPollinationDdl,
  crossPollinationEntries,
} from "./cross-pollination.schema.js";

export { registerCrossPollinationRoutes } from "./cross-pollination.routes.js";
