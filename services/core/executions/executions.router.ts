/**
 * Executions router — Fastify route shim.
 *
 * Registered by the HTTP auto-loader in `services/http/server.ts`, which
 * looks for `<domain>/<domain>.router.ts` and calls `registerRoutes(app)`.
 *
 * Routes (mounted at `/api/executions` to match the pre-existing surface):
 *   GET    /api/executions                   — list with filters
 *   GET    /api/executions/:id                — fetch one, with transitions + steps
 *   POST   /api/executions                    — create
 *   POST   /api/executions/:id/approve        — legacy status shortcut
 *   POST   /api/executions/:id/cancel         — legacy status shortcut
 *   POST   /api/executions/:id/complete       — legacy status shortcut
 *   POST   /api/executions/:id/archive        — soft-archive
 *   POST   /api/executions/:id/phase          — append a phase transition
 *   POST   /api/executions/:id/steps          — append a step journal entry
 *   GET    /api/executions/:id/reflexion      — lookup reflexion context
 *
 * Error envelopes follow EMA-VOICE: `{ error: "<condition>" }`, no apologies.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  actorPhaseSchema,
  executionStatusSchema,
} from "@ema/shared/schemas";

import { broadcast } from "../../realtime/server.js";
import { getDb } from "../../persistence/db.js";
import {
  appendStep,
  approveExecution,
  archiveExecution,
  cancelExecution,
  completeExecution,
  createExecution,
  ExecutionNotFoundError,
  getExecution,
  initExecutions,
  listExecutions,
  listPhaseTransitions,
  transitionPhase,
} from "./executions.service.js";
import {
  buildReflexionPrefix,
  getReflexionContext,
} from "./reflexion.js";
import { InvalidPhaseTransitionError } from "./state-machine.js";

interface ExecutionParams {
  id: string;
}

const listQuerySchema = z.object({
  status: executionStatusSchema.optional(),
  mode: z.string().min(1).optional(),
  intent_slug: z.string().min(1).optional(),
  project_slug: z.string().min(1).optional(),
  include_archived: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional(),
});

const createBodySchema = z.object({
  title: z.string().min(1),
  objective: z.string().nullable().optional(),
  mode: z.string().min(1).optional(),
  status: executionStatusSchema.optional(),
  requires_approval: z.boolean().optional(),
  brain_dump_item_id: z.string().nullable().optional(),
  project_slug: z.string().nullable().optional(),
  intent_slug: z.string().nullable().optional(),
  intent_path: z.string().nullable().optional(),
  proposal_id: z.string().nullable().optional(),
  space_id: z.string().nullable().optional(),
});

const phaseBodySchema = z.object({
  to: actorPhaseSchema,
  reason: z.string().min(1),
  summary: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const stepBodySchema = z.object({
  label: z.string().min(1),
  note: z.string().optional(),
  at: z.string().datetime().optional(),
});

const reflexionQuerySchema = z.object({
  intent_slug: z.string().min(1),
  limit: z.coerce.number().int().positive().max(20).optional(),
});

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof ExecutionNotFoundError) {
    return reply.code(404).send({ error: "execution_not_found", id: err.id });
  }
  if (err instanceof InvalidPhaseTransitionError) {
    return reply.code(422).send({
      error: "invalid_phase_transition",
      from: err.from,
      to: err.to,
    });
  }
  if (err instanceof z.ZodError) {
    return reply.code(422).send({ error: "invalid_input", issues: err.issues });
  }
  const detail = err instanceof Error ? err.message : "internal_error";
  return reply.code(500).send({ error: "internal_error", detail });
}

let bootstrapped = false;

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  try {
    initExecutions();
  } catch {
    // Bootstrap is best-effort — hermetic tests may stub the DB mid-boot.
  }
}

export function registerRoutes(app: FastifyInstance): void {
  bootstrap();

  app.get(
    "/api/executions",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const raw = request.query ?? {};
        const parsed = listQuerySchema.parse(raw);
        const includeArchived =
          parsed.include_archived === true ||
          parsed.include_archived === "true";
        return {
          executions: listExecutions({
            ...(parsed.status !== undefined ? { status: parsed.status } : {}),
            ...(parsed.mode !== undefined ? { mode: parsed.mode } : {}),
            ...(parsed.intent_slug !== undefined
              ? { intent_slug: parsed.intent_slug }
              : {}),
            ...(parsed.project_slug !== undefined
              ? { project_slug: parsed.project_slug }
              : {}),
            includeArchived,
          }),
        };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/api/executions/:id",
    async (
      request: FastifyRequest<{ Params: ExecutionParams }>,
      reply: FastifyReply,
    ) => {
      try {
        const execution = getExecution(request.params.id);
        if (!execution) {
          return reply
            .code(404)
            .send({ error: "execution_not_found", id: request.params.id });
        }
        const transitions = listPhaseTransitions(execution.id);
        return { execution, transitions };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/api/executions",
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const body = createBodySchema.parse(request.body ?? {});
        const execution = createExecution({
          title: body.title,
          objective: body.objective ?? null,
          mode: body.mode ?? null,
          status: body.status ?? null,
          requires_approval: body.requires_approval ?? null,
          brain_dump_item_id: body.brain_dump_item_id ?? null,
          project_slug: body.project_slug ?? null,
          intent_slug: body.intent_slug ?? null,
          intent_path: body.intent_path ?? null,
          proposal_id: body.proposal_id ?? null,
          space_id: body.space_id ?? null,
        });
        broadcast("executions:all", "execution_created", execution);
        return reply.code(201).send({ execution });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/api/executions/:id/approve",
    async (
      request: FastifyRequest<{ Params: ExecutionParams }>,
      reply: FastifyReply,
    ) => {
      const execution = approveExecution(request.params.id);
      if (!execution) {
        return reply.code(404).send({ error: "execution_not_found" });
      }
      broadcast("executions:all", "execution_updated", { execution });
      return { execution };
    },
  );

  app.post(
    "/api/executions/:id/cancel",
    async (
      request: FastifyRequest<{ Params: ExecutionParams }>,
      reply: FastifyReply,
    ) => {
      const execution = cancelExecution(request.params.id);
      if (!execution) {
        return reply.code(404).send({ error: "execution_not_found" });
      }
      broadcast("executions:all", "execution_updated", { execution });
      return { execution };
    },
  );

  app.post(
    "/api/executions/:id/complete",
    async (
      request: FastifyRequest<{
        Params: ExecutionParams;
        Body: { result_summary?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const execution = completeExecution(
        request.params.id,
        typeof request.body?.result_summary === "string"
          ? request.body.result_summary
          : null,
      );
      if (!execution) {
        return reply.code(404).send({ error: "execution_not_found" });
      }
      broadcast("executions:all", "execution_completed", { execution });
      return { execution };
    },
  );

  app.post(
    "/api/executions/:id/archive",
    async (
      request: FastifyRequest<{ Params: ExecutionParams }>,
      reply: FastifyReply,
    ) => {
      try {
        const execution = archiveExecution(request.params.id);
        broadcast("executions:all", "execution_updated", { execution });
        return { execution };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/api/executions/:id/phase",
    async (
      request: FastifyRequest<{ Params: ExecutionParams; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const body = phaseBodySchema.parse(request.body ?? {});
        const result = transitionPhase(request.params.id, {
          to: body.to,
          reason: body.reason,
          ...(body.summary !== undefined ? { summary: body.summary } : {}),
          ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
        });
        broadcast("executions:all", "execution_phase_transitioned", result);
        return result;
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/api/executions/:id/steps",
    async (
      request: FastifyRequest<{ Params: ExecutionParams; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const body = stepBodySchema.parse(request.body ?? {});
        const execution = appendStep(request.params.id, {
          label: body.label,
          ...(body.note !== undefined ? { note: body.note } : {}),
          ...(body.at !== undefined ? { at: body.at } : {}),
        });
        broadcast("executions:all", "execution_updated", { execution });
        return { execution };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/api/executions/reflexion",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const parsed = reflexionQuerySchema.parse(request.query ?? {});
        const history = getReflexionContext(getDb(), parsed.intent_slug, {
          ...(parsed.limit !== undefined ? { limit: parsed.limit } : {}),
        });
        return { history, prefix: buildReflexionPrefix(history) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
