import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  discoverAgentConfigs,
  generateBackfeed,
  getIngestionStatus,
  parseSessionTimeline,
} from "./service.js";

const sessionsQuerySchema = z.object({
  agent: z.string().optional(),
});

const backfeedBodySchema = z.object({
  agent: z.string().optional(),
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

  app.get("/status", async () => getIngestionStatus(process.cwd()));
}
