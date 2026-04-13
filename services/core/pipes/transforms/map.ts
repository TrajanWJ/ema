/**
 * `map` transform — reshape payload before passing to the action.
 *
 * Config shape: { fields: Record<string, string> } where each value is a
 * dotted path into the incoming payload. A missing path resolves to
 * undefined (dropped from the output so action Zod schemas see a clean
 * object).
 */

import { z } from "zod";
import type { TransformDef, TransformResult } from "../types.js";

const configSchema = z.object({
  fields: z.record(z.string()).default({}),
  merge: z.boolean().default(true),
});

function lookup(path: string, source: Record<string, unknown>): unknown {
  const parts = path.split(".");
  let current: unknown = source;
  for (const part of parts) {
    if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export const mapTransform: TransformDef = {
  name: "map",
  label: "Map",
  description: "Reshape payload before passing to actions",
  apply: async (payload, rawConfig): Promise<TransformResult> => {
    const config = configSchema.parse(rawConfig ?? {});
    const source =
      payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : {};
    const mapped: Record<string, unknown> = {};
    for (const [outKey, path] of Object.entries(config.fields)) {
      const value = lookup(path, source);
      if (value !== undefined) mapped[outKey] = value;
    }
    const next = config.merge ? { ...source, ...mapped } : mapped;
    return { payload: next, halted: false };
  },
};
