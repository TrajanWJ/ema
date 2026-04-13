/**
 * Transform registry aggregator. Order is fixed at filter/map/delay/claude/
 * conditional to match `Ema.Pipes.Registry` stock_transforms.
 */

import type { TransformDef } from "../types.js";
import { filterTransform } from "./filter.js";
import { mapTransform } from "./map.js";
import { delayTransform } from "./delay.js";
import { claudeTransform } from "./claude.js";
import { conditionalTransform } from "./conditional.js";

export const allTransforms: readonly TransformDef[] = [
  filterTransform,
  mapTransform,
  delayTransform,
  claudeTransform,
  conditionalTransform,
];
