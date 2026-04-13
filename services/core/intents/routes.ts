/**
 * Fastify routes for the Intents subservice.
 *
 *   GET  /                       — list intents (optional filters)
 *   GET  /:slug                  — fetch one intent + phase transitions
 *   POST /                       — create a new intent
 *   POST /:slug/phase            — transition phase
 *   POST /:slug/status           — update status
 *   POST /reindex                — manual filesystem reindex (best-effort)
 *
 * Error envelopes follow EMA-VOICE: directive, no apologies.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  actorPhaseSchema,
  intentKindSchema,
  intentLevelSchema,
  intentStatusSchema,
} from "@ema/shared/schemas";
import {
  attachActor,
  attachExecution,
  attachSession,
  createIntent,
  getIntent,
  getIntentTree,
  getRuntimeBundle,
  IntentNotFoundError,
  IntentValidationError,
  listIntentLinks,
  listIntentPhaseTransitions,
  listIntents,
  transitionPhase,
  updateIntentStatus,
} from "./service.js";
import {
  InvalidIntentPhaseTransitionError,
} from "./state-machine.js";
import {
  defaultIntentSources,
  loadAllIntents,
} from "./filesystem.js";

const listQuerySchema = z.object({
  status: intentStatusSchema.optional(),
  level: intentLevelSchema.optional(),
  kind: intentKindSchema.optional(),
  phase: actorPhaseSchema.optional(),
  project_id: z.string().min(1).optional(),
  parent_id: z.string().min(1).optional(),
});

const slugParamsSchema = z.object({ slug: z.string().min(1) });

const emaLinkSchema = z.object({
  type: z.enum([
    "fulfills",
    "blocks",
    "derived_from",
    "references",
    "supersedes",
    "aspiration_of",
  ]),
  target: z.string().min(1),
});

const createBodySchema = z.object({
  slug: z.string().min(3).max(128).optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  level: intentLevelSchema,
  status: intentStatusSchema.optional(),
  kind: intentKindSchema.optional(),
  phase: actorPhaseSchema.optional(),
  parent_id: z.string().min(1).nullable().optional(),
  project_id: z.string().min(1).nullable().optional(),
  actor_id: z.string().min(1).nullable().optional(),
  exit_condition: z.string().min(1).optional(),
  scope: z.array(z.string().min(1)).optional(),
  space_id: z.string().min(1).optional(),
  ema_links: z.array(emaLinkSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

const transitionBodySchema = z.object({
  to: actorPhaseSchema,
  reason: z.string().min(1),
  summary: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const statusBodySchema = z.object({
  status: intentStatusSchema,
  reason: z.string().optional(),
});

const attachExecutionBodySchema = z.object({
  execution_id: z.string().min(1),
  provenance: z.string().optional(),
});

const attachActorBodySchema = z.object({
  actor_id: z.string().min(1),
  relation: z.string().optional(),
});

const attachSessionBodySchema = z.object({
  session_id: z.string().min(1),
  relation: z.string().optional(),
});

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof IntentNotFoundError) {
    return reply.code(404).send({ error: "intent_not_found", slug: err.slug });
  }
  if (err instanceof IntentValidationError) {
    return reply
      .code(422)
      .send({ error: err.code, missing: err.missing });
  }
  if (err instanceof InvalidIntentPhaseTransitionError) {
    return reply.code(409).send({
      error: "invalid_phase_transition",
      from: err.from,
      to: err.to,
    });
  }
  if (err instanceof z.ZodError) {
    return reply
      .code(422)
      .send({ error: "invalid_input", issues: err.issues });
  }
  const message = err instanceof Error ? err.message : "internal_error";
  return reply.code(500).send({ error: "internal_error", detail: message });
}

export function registerIntentsRoutes(app: FastifyInstance): void {
  app.get(
    "/",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const filter = listQuerySchema.parse(request.query ?? {});
        return { intents: listIntents(filter) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/:slug",
    async (
      request: FastifyRequest<{ Params: { slug: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { slug } = slugParamsSchema.parse(request.params);
        const intent = getIntent(slug);
        if (!intent) {
          return reply
            .code(404)
            .send({ error: "intent_not_found", slug });
        }
        const transitions = listIntentPhaseTransitions(slug);
        return { intent, transitions };
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
        const intent = createIntent(body);
        return reply.code(201).send({ intent });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/:slug/phase",
    async (
      request: FastifyRequest<{ Params: { slug: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { slug } = slugParamsSchema.parse(request.params);
        const body = transitionBodySchema.parse(request.body);
        const intent = transitionPhase(slug, body);
        return { intent };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/:slug/status",
    async (
      request: FastifyRequest<{ Params: { slug: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { slug } = slugParamsSchema.parse(request.params);
        const body = statusBodySchema.parse(request.body);
        const intent = updateIntentStatus(slug, body);
        return { intent };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post("/reindex", async (_request, reply) => {
    try {
      const report = loadAllIntents(defaultIntentSources(process.cwd()));
      return { ok: true, report };
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // --- Attachment verbs (DEC-007 intent_links) ---------------------------

  app.post(
    "/:slug/attach/execution",
    async (
      request: FastifyRequest<{ Params: { slug: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { slug } = slugParamsSchema.parse(request.params);
        const body = attachExecutionBodySchema.parse(request.body);
        const link = attachExecution(slug, body.execution_id, body.provenance);
        return reply.code(201).send({ link });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/:slug/attach/actor",
    async (
      request: FastifyRequest<{ Params: { slug: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { slug } = slugParamsSchema.parse(request.params);
        const body = attachActorBodySchema.parse(request.body);
        const link = attachActor(slug, body.actor_id, body.relation);
        return reply.code(201).send({ link });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/:slug/attach/session",
    async (
      request: FastifyRequest<{ Params: { slug: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { slug } = slugParamsSchema.parse(request.params);
        const body = attachSessionBodySchema.parse(request.body);
        const link = attachSession(slug, body.session_id, body.relation);
        return reply.code(201).send({ link });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/:slug/links",
    async (
      request: FastifyRequest<{
        Params: { slug: string };
        Querystring: Record<string, unknown>;
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { slug } = slugParamsSchema.parse(request.params);
        const filter: { targetType?: string; relation?: string } = {};
        const rawType = request.query?.target_type;
        if (typeof rawType === "string") filter.targetType = rawType;
        const rawRel = request.query?.relation;
        if (typeof rawRel === "string") filter.relation = rawRel;
        const links = listIntentLinks(slug, filter as Parameters<typeof listIntentLinks>[1]);
        return { links };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // --- Runtime bundle + tree --------------------------------------------

  app.get(
    "/:slug/runtime",
    async (
      request: FastifyRequest<{ Params: { slug: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { slug } = slugParamsSchema.parse(request.params);
        const bundle = getRuntimeBundle(slug);
        if (!bundle) {
          return reply
            .code(404)
            .send({ error: "intent_not_found", slug });
        }
        return { bundle };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/tree",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const rawRoot = request.query?.root;
        const root = typeof rawRoot === "string" ? rawRoot : null;
        const tree = getIntentTree(root);
        return { tree };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
