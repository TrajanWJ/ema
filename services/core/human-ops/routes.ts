import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  humanOpsDateSchema,
  humanOpsDayUpdateSchema,
} from "@ema/shared/schemas";

import {
  ensureHumanOpsDay,
  getHumanOpsAgenda,
  getHumanOpsDailyBrief,
  upsertHumanOpsDay,
} from "./service.js";

interface HumanOpsDayParams {
  date: string;
}

interface HumanOpsBriefQuery {
  owner_id?: string;
}

interface HumanOpsAgendaQuery extends HumanOpsBriefQuery {
  days?: string;
}

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  const detail = err instanceof Error ? err.message : "internal_error";
  if (err instanceof Error && err.message === "human_ops_invalid_date") {
    return reply.code(422).send({ error: "invalid_input", detail });
  }
  if (err instanceof z.ZodError) {
    return reply.code(422).send({ error: "invalid_input", detail });
  }
  return reply.code(500).send({ error: "internal_error", detail });
}

export function registerHumanOpsRoutes(app: FastifyInstance): void {
  app.get(
    "/day/:date",
    async (
      request: FastifyRequest<{ Params: HumanOpsDayParams }>,
      reply: FastifyReply,
    ) => {
      try {
        const date = humanOpsDateSchema.parse(request.params.date);
        return ensureHumanOpsDay(date);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(422).send({ error: "invalid_input" });
        }
        return handleError(reply, err);
      }
    },
  );

  app.put(
    "/day/:date",
    async (
      request: FastifyRequest<{ Params: HumanOpsDayParams; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const date = humanOpsDateSchema.parse(request.params.date);
        const body = humanOpsDayUpdateSchema.parse(request.body ?? {});
        return upsertHumanOpsDay(date, body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(422).send({ error: "invalid_input" });
        }
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/brief/:date",
    async (
      request: FastifyRequest<{ Params: HumanOpsDayParams; Querystring: HumanOpsBriefQuery }>,
      reply: FastifyReply,
    ) => {
      try {
        const date = humanOpsDateSchema.parse(request.params.date);
        return getHumanOpsDailyBrief(date, request.query.owner_id ?? "self");
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(422).send({ error: "invalid_input" });
        }
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/agenda/:date",
    async (
      request: FastifyRequest<{ Params: HumanOpsDayParams; Querystring: HumanOpsAgendaQuery }>,
      reply: FastifyReply,
    ) => {
      try {
        const date = humanOpsDateSchema.parse(request.params.date);
        const days =
          typeof request.query.days === "string"
            ? Number.parseInt(request.query.days, 10)
            : 7;
        return getHumanOpsAgenda(date, Number.isFinite(days) ? days : 7, request.query.owner_id ?? "self");
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.code(422).send({ error: "invalid_input" });
        }
        return handleError(reply, err);
      }
    },
  );
}
