/**
 * Action registry aggregator. Order matches `Ema.Pipes.Registry` stock_actions
 * for parity with the old catalog UI.
 */

import type { ActionDef } from "../types.js";
import { brainDumpActions } from "./brain_dump.js";
import { taskActions } from "./tasks.js";
import { proposalActions } from "./proposals.js";
import { projectActions } from "./projects.js";
import { responsibilityActions } from "./responsibilities.js";
import { vaultActions } from "./vault.js";
import { notifyActions } from "./notify.js";
import { claudeActions } from "./claude.js";
import { httpActions } from "./http.js";
import { transformActions } from "./transform.js";
import { branchActions } from "./branch.js";

export const allActions: readonly ActionDef[] = [
  ...brainDumpActions,
  ...taskActions,
  ...proposalActions,
  ...projectActions,
  ...responsibilityActions,
  ...vaultActions,
  ...notifyActions,
  ...claudeActions,
  ...httpActions,
  ...transformActions,
  ...branchActions,
];
