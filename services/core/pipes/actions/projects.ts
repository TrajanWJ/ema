/**
 * Project actions — contract stubs.
 * TODO(stream-4): integrate with `services/core/projects/`.
 */

import { z } from "zod";
import type { ActionDef } from "../types.js";
import { emitPipeActionEvent, pipeLog } from "../voice.js";

const createInput = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
});

const createOutput = z.object({
  ok: z.literal(true),
  project_id: z.string(),
  slug: z.string(),
  stub: z.literal(true),
});

const transitionInput = z.object({
  project_id: z.string().min(1),
  status: z.string().min(1),
});

const transitionOutput = z.object({
  ok: z.literal(true),
  project_id: z.string(),
  status: z.string(),
  stub: z.literal(true),
});

const rebuildInput = z.object({ project_id: z.string().min(1) });
const rebuildOutput = z.object({
  ok: z.literal(true),
  project_id: z.string(),
  rebuilt: z.literal(true),
  stub: z.literal(true),
});

export const projectActions: readonly ActionDef[] = [
  {
    name: "projects:create",
    context: "projects",
    label: "Create Project",
    description: "Create a new project",
    inputSchema: createInput,
    outputSchema: createOutput,
    handler: async (raw, ctx) => {
      const input = createInput.parse(raw);
      const project_id = `proj-stub-${ctx.runId.slice(-8)}`;
      emitPipeActionEvent(ctx, "projects:create", { project_id, input });
      pipeLog(`action projects:create stub minted ${project_id}`);
      return {
        ok: true as const,
        project_id,
        slug: input.slug,
        stub: true as const,
      };
    },
  },
  {
    name: "projects:transition",
    context: "projects",
    label: "Transition Project Status",
    description: "Change project status",
    inputSchema: transitionInput,
    outputSchema: transitionOutput,
    handler: async (raw, ctx) => {
      const input = transitionInput.parse(raw);
      emitPipeActionEvent(ctx, "projects:transition", input);
      pipeLog(
        `action projects:transition stub moved ${input.project_id} to ${input.status}`,
      );
      return {
        ok: true as const,
        project_id: input.project_id,
        status: input.status,
        stub: true as const,
      };
    },
  },
  {
    name: "projects:rebuild_context",
    context: "projects",
    label: "Rebuild Project Context",
    description: "Force context document rebuild",
    inputSchema: rebuildInput,
    outputSchema: rebuildOutput,
    handler: async (raw, ctx) => {
      const input = rebuildInput.parse(raw);
      emitPipeActionEvent(ctx, "projects:rebuild_context", input);
      pipeLog(
        `action projects:rebuild_context stub rebuilt ${input.project_id}`,
      );
      return {
        ok: true as const,
        project_id: input.project_id,
        rebuilt: true as const,
        stub: true as const,
      };
    },
  },
];
