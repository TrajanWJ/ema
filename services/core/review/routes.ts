import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  listReviewItemsFilterSchema,
  promoteReviewItemInputSchema,
  reviewDecisionInputSchema,
} from "@ema/shared/schemas";

import {
  approveReviewItem,
  ChronicleExtractionNotFoundError,
  deferReviewItem,
  getReviewItemDetail,
  listReviewItems,
  promoteReviewItem,
  rejectReviewItem,
  ReviewItemNotFoundError,
  ReviewStateError,
} from "./service.js";

const idParamsSchema = z.object({
  id: z.string().min(1),
});

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof ReviewItemNotFoundError) {
    return reply.code(404).send({ error: err.code, id: err.reviewItemId });
  }
  if (err instanceof ChronicleExtractionNotFoundError) {
    return reply.code(404).send({ error: err.code, id: err.extractionId });
  }
  if (err instanceof ReviewStateError) {
    return reply.code(409).send({ error: err.code, detail: err.message });
  }
  if (err instanceof z.ZodError) {
    return reply.code(422).send({ error: "invalid_input", issues: err.issues });
  }
  const detail = err instanceof Error ? err.message : "internal_error";
  return reply.code(500).send({ error: "internal_error", detail });
}

export function registerReviewRoutes(app: FastifyInstance): void {
  app.get(
    "/items",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const filter = listReviewItemsFilterSchema.parse(request.query ?? {});
        return { items: listReviewItems(filter) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/items/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params ?? {});
        return { detail: getReviewItemDetail(id) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/items/:id/approve",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params ?? {});
        const body = reviewDecisionInputSchema.parse(request.body ?? {});
        return { item: approveReviewItem(id, body) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/items/:id/reject",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params ?? {});
        const body = reviewDecisionInputSchema.parse(request.body ?? {});
        return { item: rejectReviewItem(id, body) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/items/:id/defer",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params ?? {});
        const body = reviewDecisionInputSchema.parse(request.body ?? {});
        return { item: deferReviewItem(id, body) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/items/:id/promote",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params ?? {});
        const body = promoteReviewItemInputSchema.parse(request.body ?? {});
        return { detail: promoteReviewItem(id, body) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
