import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { createChronicleImportInputSchema, chronicleSourceKindSchema } from "@ema/shared/schemas";
import { buildChronicleImportFromFile } from "../ingestion/service.js";
import { getChronicleReviewState } from "../review/service.js";
import {
  ChronicleImportError,
  ChronicleSessionNotFoundError,
  getChronicleSessionDetail,
  importChronicleSession,
  listChronicleSessions,
} from "./service.js";

const listQuerySchema = z.object({
  source_kind: chronicleSourceKindSchema.optional(),
  source_id: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const importFileBodySchema = z.object({
  path: z.string().min(1),
  agent: z.string().optional(),
  source_kind: chronicleSourceKindSchema.optional(),
  source_label: z.string().min(1).optional(),
});

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof ChronicleSessionNotFoundError) {
    return reply.code(404).send({ error: err.code, session_id: err.sessionId });
  }
  if (err instanceof ChronicleImportError) {
    return reply.code(400).send({ error: err.code, detail: err.message });
  }
  if (err instanceof z.ZodError) {
    return reply.code(422).send({ error: "invalid_input", issues: err.issues });
  }
  const detail = err instanceof Error ? err.message : "internal_error";
  return reply.code(500).send({ error: "internal_error", detail });
}

export function registerChronicleRoutes(app: FastifyInstance): void {
  app.get(
    "/sessions",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const query = listQuerySchema.parse(request.query ?? {});
        return { sessions: listChronicleSessions(query) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/sessions/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params ?? {});
        const detail = getChronicleSessionDetail(id);
        return {
          detail: {
            ...detail,
            ...getChronicleReviewState(id),
          },
        };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/import",
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const input = createChronicleImportInputSchema.parse(request.body ?? {});
        return { detail: importChronicleSession(input) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/import-file",
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const body = importFileBodySchema.parse(request.body ?? {});
        const input = buildChronicleImportFromFile({
          path: body.path,
          ...(body.agent !== undefined ? { agent: body.agent } : {}),
          ...(body.source_kind !== undefined ? { source_kind: body.source_kind } : {}),
          ...(body.source_label !== undefined ? { source_label: body.source_label } : {}),
        });
        return { detail: importChronicleSession(input) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
