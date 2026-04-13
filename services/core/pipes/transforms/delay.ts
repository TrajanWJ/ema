/**
 * `delay` transform — debounce marker.
 *
 * v1 simply waits the configured number of milliseconds. Per the Elixir
 * original this is also the "accumulate events + fire after quiet period"
 * debounce point, but cross-run debouncing lands with the scheduler in
 * Stream 4 — for now the transform is a straight sleep.
 */

import { z } from "zod";
import type { TransformDef, TransformResult } from "../types.js";

const configSchema = z.object({
  ms: z.number().int().nonnegative().default(0),
});

export const delayTransform: TransformDef = {
  name: "delay",
  label: "Delay",
  description: "Debounce — accumulate events, fire after quiet period",
  apply: async (payload, rawConfig): Promise<TransformResult> => {
    const config = configSchema.parse(rawConfig ?? {});
    if (config.ms > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, config.ms);
      });
    }
    return { payload, halted: false };
  },
};
