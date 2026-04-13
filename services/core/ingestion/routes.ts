import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  captureMachineSnapshot,
  discoverAgentConfigs,
  discoverSessionCandidates,
  generateBackfeed,
  importDiscoveredSessions,
  parseSessionTimeline,
} from "./service.js";
import { getIngestionRuntimeStatus, runIngestionBootstrap } from "./bootstrap.js";

const sessionsQuerySchema = z.object({
  agent: z.string().optional(),
});

const backfeedBodySchema = z.object({
  agent: z.string().optional(),
});

const importBodySchema = z.object({
  agent: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const bootstrapBodySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5000).optional(),
  force: z.coerce.boolean().optional(),
});

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof z.ZodError) {
    return reply.code(422).send({ error: "invalid_input", issues: err.issues });
  }
  const detail = err instanceof Error ? err.message : "internal_error";
  return reply.code(500).send({ error: "internal_error", detail });
}

export function registerIngestionRoutes(app: FastifyInstance): void {
  app.get("/scan", async () => ({
    configs: discoverAgentConfigs(process.cwd()),
  }));

  app.post(
    "/bootstrap",
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const body = bootstrapBodySchema.parse(request.body ?? {});
        return runIngestionBootstrap({
          repoRoot: process.cwd(),
          ...(body.limit !== undefined ? { backfillLimit: body.limit } : {}),
          ...(body.force !== undefined ? { force: body.force } : {}),
        });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/discover",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const query = sessionsQuerySchema.parse(request.query ?? {});
        return {
          sessions: discoverSessionCandidates({
            ...(query.agent !== undefined ? { agent: query.agent } : {}),
            repoRoot: process.cwd(),
          }),
        };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/sessions",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const query = sessionsQuerySchema.parse(request.query ?? {});
        return {
          timeline: parseSessionTimeline({
            ...(query.agent !== undefined ? { agent: query.agent } : {}),
            repoRoot: process.cwd(),
          }),
        };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/backfeed",
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const body = backfeedBodySchema.parse(request.body ?? {});
        return generateBackfeed({
          ...(body.agent !== undefined ? { agent: body.agent } : {}),
          repoRoot: process.cwd(),
        });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/machine-snapshot",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        return captureMachineSnapshot(process.cwd());
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/import-discovered",
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const body = importBodySchema.parse(request.body ?? {});
        return importDiscoveredSessions({
          ...(body.agent !== undefined ? { agent: body.agent } : {}),
          ...(body.limit !== undefined ? { limit: body.limit } : {}),
          ...(body.offset !== undefined ? { offset: body.offset } : {}),
          repoRoot: process.cwd(),
        });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get("/status", async () => getIngestionRuntimeStatus(process.cwd()));
}
