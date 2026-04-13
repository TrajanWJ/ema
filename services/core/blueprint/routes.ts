/**
 * Fastify routes for the Blueprint subservice.
 *
 * Per DEC-004 §5:
 *   GET  /gac                  — list (with optional status/category/priority filters)
 *   GET  /gac/:id              — fetch one card
 *   POST /gac                  — create a new card
 *   POST /gac/:id/answer       — answer a pending card
 *   POST /gac/:id/defer        — defer a pending card
 *   POST /gac/:id/promote      — promote a pending card to a blocker
 *
 * Inputs validated via Zod. Error envelopes follow EMA-VOICE: directive,
 * no apologies, `{ error: "<condition>" }`.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  gacCategorySchema,
  gacConnectionSchema,
  gacContextSchema,
  gacOptionSchema,
  gacPrioritySchema,
  gacResultActionSchema,
  gacStatusSchema,
} from "@ema/shared/schemas";
import {
  answerGacCard,
  createGacCard,
  deferGacCard,
  GacNotFoundError,
  getGacCard,
  listGacCards,
  listGacTransitions,
  promoteGacCard,
} from "./service.js";
import { InvalidTransitionError } from "./state-machine.js";

const listQuerySchema = z.object({
  status: gacStatusSchema.optional(),
  category: gacCategorySchema.optional(),
  priority: gacPrioritySchema.optional(),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

const createBodySchema = z.object({
  id: z.string().regex(/^GAC-\d{3,}$/u).optional(),
  title: z.string().min(1),
  question: z.string().min(1),
  options: z.array(gacOptionSchema).min(1),
  category: gacCategorySchema,
  priority: gacPrioritySchema,
  author: z.string().min(1),
  tags: z.array(z.string()).optional(),
  connections: z.array(gacConnectionSchema).optional(),
  context: gacContextSchema.optional(),
});

const answerBodySchema = z.object({
  selected: z.string().nullable(),
  freeform: z.string().optional(),
  answered_by: z.string().min(1),
  reason: z.string().optional(),
  result_action: gacResultActionSchema.optional(),
});

const deferBodySchema = z.object({
  actor: z.string().min(1),
  reason: z.string().min(1),
  blocker_id: z.string().optional(),
});

const promoteBodySchema = z.object({
  actor: z.string().min(1),
  reason: z.string().min(1),
  blocker_id: z.string().min(1),
});

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof GacNotFoundError) {
    return reply.code(404).send({ error: "gac_not_found", id: err.id });
  }
  if (err instanceof InvalidTransitionError) {
    return reply.code(409).send({
      error: "invalid_transition",
      from: err.from,
      to: err.to,
    });
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

export function registerBlueprintRoutes(app: FastifyInstance): void {
  app.get(
    "/gac",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const filter = listQuerySchema.parse(request.query ?? {});
        return { cards: listGacCards(filter) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/gac/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params);
        const card = getGacCard(id);
        if (!card) {
          return reply.code(404).send({ error: "gac_not_found", id });
        }
        const transitions = listGacTransitions(id);
        return { card, transitions };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/gac",
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const body = createBodySchema.parse(request.body);
        const card = createGacCard(body);
        return reply.code(201).send({ card });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/gac/:id/answer",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params);
        const body = answerBodySchema.parse(request.body);
        const card = answerGacCard(id, body);
        return { card };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/gac/:id/defer",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params);
        const body = deferBodySchema.parse(request.body);
        const card = deferGacCard(id, body);
        return { card };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/gac/:id/promote",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params);
        const body = promoteBodySchema.parse(request.body);
        const card = promoteGacCard(id, body);
        return { card };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
