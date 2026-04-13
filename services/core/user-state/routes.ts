/**
 * Fastify routes for the UserState subservice.
 *
 * Mounted under `/api/user-state` by the router shim:
 *   GET  /current       — read the singleton snapshot
 *   POST /update        — self/agent mutation
 *   POST /signal        — submit a heuristic signal
 *   GET  /history       — ring-buffer read
 *
 * Error envelopes follow EMA-VOICE: directive, no apology, `{ error }`.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  userStateModeSchema,
  userStateSignalSchema,
  userStateUpdatedBySchema,
} from "@ema/shared/schemas";

import {
  getCurrentUserState,
  getUserStateHistory,
  recordSignal,
  updateUserState,
} from "./service.js";

const updateBodySchema = z.object({
  mode: userStateModeSchema.optional(),
  focus_score: z.number().min(0).max(1).optional(),
  energy_score: z.number().min(0).max(1).optional(),
  distress_flag: z.boolean().optional(),
  drift_score: z.number().min(0).max(1).optional(),
  current_intent_slug: z.string().min(1).nullable().optional(),
  updated_by: userStateUpdatedBySchema.optional(),
  reason: z.string().optional(),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
});

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof z.ZodError) {
    return reply
      .code(422)
      .send({ error: "invalid_input", issues: err.issues });
  }
  const message = err instanceof Error ? err.message : "internal_error";
  return reply.code(500).send({ error: "internal_error", detail: message });
}

export function registerUserStateRoutes(app: FastifyInstance): void {
  app.get("/current", async (_request, reply) => {
    try {
      return { state: getCurrentUserState() };
    } catch (err) {
      return handleError(reply, err);
    }
  });

  app.post(
    "/update",
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const body = updateBodySchema.parse(request.body);
        const state = updateUserState(body);
        return { state };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/signal",
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const body = userStateSignalSchema.parse(request.body);
        const state = recordSignal(body);
        return { state };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/history",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const query = historyQuerySchema.parse(request.query ?? {});
        const entries = getUserStateHistory(
          query.limit !== undefined ? { limit: query.limit } : {},
        );
        return { entries };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
