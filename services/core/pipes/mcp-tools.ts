/**
 * MCP tool registrations for the Pipes subservice.
 *
 * Mirrors the blueprint pattern: a placeholder array + factory until the
 * MCP host registry lands. Tool names use `pipes_<verb>` snake-case to
 * match `gac_<verb>`.
 */

import { z } from "zod";

import { executePipe } from "./executor.js";
import { registry } from "./registry.js";
import {
  createPipe,
  getPipe,
  listPipeRuns,
  listPipes,
  togglePipe,
} from "./service.js";

export interface PipesMcpTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (input: unknown) => Promise<unknown> | unknown;
}

const listInput = z.object({
  trigger: z.string().optional(),
  enabled: z.boolean().optional(),
});

const showInput = z.object({ id: z.string().min(1) });

const createInput = z.object({
  name: z.string().min(1),
  trigger: z.string().min(1),
  action: z.string().min(1),
  transforms: z
    .array(
      z.object({
        name: z.enum(["filter", "map", "delay", "claude", "conditional"]),
        config: z.unknown().optional(),
      }),
    )
    .optional(),
  enabled: z.boolean().optional(),
});

const toggleInput = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
});

const runInput = z.object({
  id: z.string().min(1),
  payload: z.unknown().optional(),
});

const historyInput = z.object({
  pipe_id: z.string().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export const pipesMcpTools: readonly PipesMcpTool[] = [
  {
    name: "pipes_list",
    description:
      "List pipes in the registry. Optional filters: trigger, enabled.",
    inputSchema: listInput,
    handler: (raw) => {
      const input = listInput.parse(raw ?? {});
      const filter: { trigger?: `${string}:${string}`; enabled?: boolean } =
        {};
      if (input.trigger !== undefined) {
        filter.trigger = input.trigger as `${string}:${string}`;
      }
      if (input.enabled !== undefined) filter.enabled = input.enabled;
      return { pipes: listPipes(filter) };
    },
  },
  {
    name: "pipes_show",
    description:
      "Fetch a single pipe by id, plus its most recent runs from the history log.",
    inputSchema: showInput,
    handler: (raw) => {
      const { id } = showInput.parse(raw);
      const pipe = getPipe(id);
      if (!pipe) return { error: "pipe_not_found", id };
      return { pipe, runs: listPipeRuns({ pipeId: id, limit: 20 }) };
    },
  },
  {
    name: "pipes_create",
    description:
      "Create a new pipe. Validates trigger/action/transform names against the registry.",
    inputSchema: createInput,
    handler: (raw) => {
      const input = createInput.parse(raw);
      const pipe = createPipe({
        name: input.name,
        trigger: input.trigger as `${string}:${string}`,
        action: input.action,
        ...(input.transforms
          ? {
              transforms: input.transforms.map((t) => ({
                name: t.name,
                config: t.config ?? {},
              })),
            }
          : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      });
      return { pipe };
    },
  },
  {
    name: "pipes_toggle",
    description: "Enable or disable a pipe by id.",
    inputSchema: toggleInput,
    handler: (raw) => {
      const input = toggleInput.parse(raw);
      const pipe = togglePipe(input.id, input.enabled);
      return { pipe };
    },
  },
  {
    name: "pipes_run",
    description:
      "Manually fire a pipe with a payload, bypassing the bus. Returns the resulting pipe_run row.",
    inputSchema: runInput,
    handler: async (raw) => {
      const input = runInput.parse(raw);
      const pipe = getPipe(input.id);
      if (!pipe) return { error: "pipe_not_found", id: input.id };
      const run = await executePipe(pipe, input.payload ?? {});
      return { run };
    },
  },
  {
    name: "pipes_history",
    description:
      "List recent pipe runs. Optional filter by pipe_id; default limit 100.",
    inputSchema: historyInput,
    handler: (raw) => {
      const input = historyInput.parse(raw ?? {});
      const filter: { pipeId?: string; limit?: number } = {};
      if (input.pipe_id !== undefined) filter.pipeId = input.pipe_id;
      if (input.limit !== undefined) filter.limit = input.limit;
      return { runs: listPipeRuns(filter), counts: registry.counts };
    },
  },
];

export function registerPipesMcpTools(): readonly PipesMcpTool[] {
  return pipesMcpTools;
}
