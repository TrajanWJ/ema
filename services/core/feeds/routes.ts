import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { feedActionTypeSchema, feedSurfaceSchema } from "@ema/shared/schemas";
import {
  actOnFeedItem,
  FeedItemNotFoundError,
  FeedViewNotFoundError,
  getFeedWorkspace,
  updateFeedViewPrompt,
} from "./service.js";

const workspaceQuerySchema = z.object({
  surface: feedSurfaceSchema.optional(),
  scope_id: z.string().min(1).optional(),
  view_id: z.string().min(1).optional(),
  query: z.string().optional(),
  include_hidden: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) => value === true || value === "true"),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

const updatePromptBodySchema = z.object({
  prompt: z.string(),
});

const itemActionBodySchema = z.object({
  action: feedActionTypeSchema,
  actor: z.string().min(1),
  note: z.string().nullable().optional(),
  target_scope_id: z.string().nullable().optional(),
});

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof FeedItemNotFoundError) {
    return reply.code(404).send({
      error: "feed_item_not_found",
      item_id: err.itemId,
    });
  }
  if (err instanceof FeedViewNotFoundError) {
    return reply.code(404).send({
      error: "feed_view_not_found",
      view_id: err.viewId,
    });
  }
  if (err instanceof z.ZodError) {
    return reply.code(422).send({ error: "invalid_input", issues: err.issues });
  }
  const message = err instanceof Error ? err.message : "internal_error";
  return reply.code(500).send({ error: "internal_error", detail: message });
}

export function registerFeedsRoutes(app: FastifyInstance): void {
  app.get(
    "/",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const query = workspaceQuerySchema.parse(request.query ?? {});
        return {
          workspace: getFeedWorkspace({
            ...(query.surface !== undefined ? { surface: query.surface } : {}),
            ...(query.scope_id !== undefined ? { scope_id: query.scope_id } : {}),
            ...(query.view_id !== undefined ? { view_id: query.view_id } : {}),
            ...(query.query !== undefined ? { query: query.query } : {}),
            include_hidden: query.include_hidden,
          }),
        };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.put(
    "/views/:id/prompt",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params);
        const body = updatePromptBodySchema.parse(request.body);
        return { view: updateFeedViewPrompt(id, body.prompt) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/items/:id/actions",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = idParamsSchema.parse(request.params);
        const body = itemActionBodySchema.parse(request.body);
        return actOnFeedItem(id, {
          action: body.action,
          actor: body.actor,
          ...(body.note !== undefined ? { note: body.note } : {}),
          ...(body.target_scope_id !== undefined
            ? { target_scope_id: body.target_scope_id }
            : {}),
        });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
