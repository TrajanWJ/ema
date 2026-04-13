/**
 * Trigger registry aggregator. The order here defines the public listing
 * order in the `/pipes/catalog` endpoint.
 */

import type { TriggerDef } from "../types.js";
import { brainDumpTriggers } from "./brain_dump.js";
import { taskTriggers } from "./tasks.js";
import { proposalTriggers } from "./proposals.js";
import { projectTriggers } from "./projects.js";
import { habitTriggers } from "./habits.js";
import { systemTriggers } from "./system.js";

export const allTriggers: readonly TriggerDef[] = [
  ...brainDumpTriggers,
  ...taskTriggers,
  ...proposalTriggers,
  ...projectTriggers,
  ...habitTriggers,
  ...systemTriggers,
];
