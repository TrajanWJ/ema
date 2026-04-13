/**
 * Fastify routes for the Pipes subservice.
 *
 * Matches the old escript `ema pipe <verb>` surface (Appendix A.1):
 *   GET  /pipes                — list (optional trigger/enabled filters)
 *   GET  /pipes/catalog        — trigger + action + transform registry
 *   GET  /pipes/history        — pipe_runs (optional pipe_id filter)
 *   GET  /pipes/:id            — show a single pipe
 *   POST /pipes                — create
 *   POST /pipes/:id/toggle     — enable/disable
 *
 * Errors follow EMA-VOICE: `{ error: "<condition>" }`, no apologies.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { registry } from "./registry.js";
import {
  createPipe,
  getPipe,
  InvalidPipeError,
  listPipeRuns,
  listPipes,
  PipeNotFoundError,
  togglePipe,
} from "./service.js";

const listQuerySchema = z.object({
  trigger: z.string().optional(),
  enabled: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

const createBodySchema = z.object({
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

const toggleBodySchema = z.object({ enabled: z.boolean() });

const historyQuerySchema = z.object({
  pipe_id: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof PipeNotFoundError) {
    return reply.code(404).send({ error: "pipe_not_found", id: err.id });
  }
  if (err instanceof InvalidPipeError) {
    return reply.code(422).send({ error: "invalid_pipe", detail: err.message });
  }
  if (err instanceof z.ZodError) {
    return reply
      .code(422)
      .send({ error: "invalid_input", issues: err.issues });
  }
  const message = err instanceof Error ? err.message : "internal_error";
  return reply.code(500).send({ error: "internal_error", detail: message });
}

function serialisedCatalog(): unknown {
  return {
    triggers: registry.triggers.map((t) => ({
      name: t.name,
      context: t.context,
      event_type: t.eventType,
      label: t.label,
      description: t.description,
    })),
    actions: registry.actions.map((a) => ({
      name: a.name,
      context: a.context,
      label: a.label,
      description: a.description,
    })),
    transforms: registry.transforms.map((x) => ({
      name: x.name,
      label: x.label,
      description: x.description,
    })),
    counts: registry.counts,
  };
}

export function registerPipesRoutes(app: FastifyInstance): void {
  app.get(
    "/catalog",
    async (_request: FastifyRequest, _reply: FastifyReply) =>
      serialisedCatalog(),
  );

  app.get(
    "/history",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const query = historyQuerySchema.parse(request.query ?? {});
        const filter: { pipeId?: string; limit?: number } = {};
        if (query.pipe_id !== undefined) filter.pipeId = query.pipe_id;
        if (query.limit !== undefined) filter.limit = query.limit;
        return { runs: listPipeRuns(filter) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const filter = listQuerySchema.parse(request.query ?? {});
        const input: {
          trigger?: `${string}:${string}`;
          enabled?: boolean;
        } = {};
        if (filter.trigger !== undefined) {
          input.trigger = filter.trigger as `${string}:${string}`;
        }
        if (filter.enabled !== undefined) input.enabled = filter.enabled;
        return { pipes: listPipes(input) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params);
        const pipe = getPipe(id);
        if (!pipe) return reply.code(404).send({ error: "pipe_not_found", id });
        return { pipe };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/",
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const body = createBodySchema.parse(request.body);
        const pipe = createPipe({
          name: body.name,
          trigger: body.trigger as `${string}:${string}`,
          action: body.action,
          ...(body.transforms
            ? {
                transforms: body.transforms.map((t) => ({
                  name: t.name,
                  config: t.config ?? {},
                })),
              }
            : {}),
          ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        });
        return reply.code(201).send({ pipe });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/:id/toggle",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params);
        const body = toggleBodySchema.parse(request.body);
        const pipe = togglePipe(id, body.enabled);
        return { pipe };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
