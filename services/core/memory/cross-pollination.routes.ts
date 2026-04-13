/**
 * Fastify routes for the cross-pollination subservice.
 *
 *   GET  /cross-pollination                  — list (filterable by source/target)
 *   GET  /cross-pollination/:id              — fetch one entry
 *   POST /cross-pollination                  — record a new entry
 *   GET  /cross-pollination/applicable/:project — findApplicableFor
 *   GET  /cross-pollination/history/:project    — getHistory
 *
 * Inputs validated via Zod. Error envelopes follow EMA-VOICE: directive,
 * no apologies, `{ error: "<condition>" }`.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  CrossPollinationNotFoundError,
  crossPollinationService,
} from "./cross-pollination.js";

const listQuerySchema = z.object({
  source_project: z.string().min(1).optional(),
  target_project: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });
const projectParamsSchema = z.object({ project: z.string().min(1) });

const projectQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
});

const recordBodySchema = z.object({
  fact: z.string().min(1),
  source_project: z.string().min(1),
  target_project: z.string().min(1),
  rationale: z.string().min(1),
  actor_id: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  tags: z.array(z.string()).optional(),
});

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof CrossPollinationNotFoundError) {
    return reply
      .code(404)
      .send({ error: "cross_pollination_not_found", id: err.id });
  }
  if (err instanceof z.ZodError) {
    return reply.code(422).send({
      error: "invalid_input",
      issues: err.issues,
    });
  }
  const message = err instanceof Error ? err.message : "internal_error";
  return reply.code(500).send({ error: "internal_error", detail: message });
}

export function registerCrossPollinationRoutes(app: FastifyInstance): void {
  app.get(
    "/",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const filter = listQuerySchema.parse(request.query ?? {});
        const entries = await crossPollinationService.list(filter);
        return { entries };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/applicable/:project",
    async (
      request: FastifyRequest<{
        Params: { project: string };
        Querystring: Record<string, unknown>;
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { project } = projectParamsSchema.parse(request.params);
        const { limit } = projectQuerySchema.parse(request.query ?? {});
        const entries = await crossPollinationService.findApplicableFor(
          project,
          limit ?? 50,
        );
        return { entries };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/history/:project",
    async (
      request: FastifyRequest<{ Params: { project: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { project } = projectParamsSchema.parse(request.params);
        const entries = await crossPollinationService.getHistory(project);
        return { entries };
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
        const entry = await crossPollinationService.get(id);
        if (!entry) {
          return reply
            .code(404)
            .send({ error: "cross_pollination_not_found", id });
        }
        return { entry };
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
        const body = recordBodySchema.parse(request.body);
        const entry = await crossPollinationService.record(body);
        return reply.code(201).send({ entry });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
