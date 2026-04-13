/**
 * Fastify routes for the Spaces subservice.
 *
 *   GET  /                     — list spaces (status filter optional)
 *   GET  /:ref                 — fetch one space (by id or slug) + transitions
 *   POST /                     — create a new space
 *   POST /:ref/archive         — archive a space (draft|active → archived)
 *   POST /:ref/members         — add a member
 *   DELETE /:ref/members/:actor_id — remove a member
 *
 * Inputs validated via Zod. Error envelopes follow EMA-VOICE: directive, no
 * apologies, `{ error: "<condition>" }`.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { spaceMemberSchema } from "@ema/shared/schemas";
import {
  addMember,
  archiveSpace,
  createSpace,
  getSpace,
  InvalidSpaceMutationError,
  listSpaces,
  listTransitions,
  removeMember,
  SpaceMemberExistsError,
  SpaceMemberMissingError,
  SpaceNotFoundError,
  SpaceSlugTakenError,
} from "./service.js";
import {
  InvalidSpaceTransitionError,
  SPACE_STATUSES,
} from "./state-machine.js";

const statusEnum = z.enum(SPACE_STATUSES);

const listQuerySchema = z.object({
  status: statusEnum.optional(),
  include_archived: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => v === true || v === "true"),
});

const refParamsSchema = z.object({ ref: z.string().min(1) });
const memberParamsSchema = z.object({
  ref: z.string().min(1),
  actor_id: z.string().min(1),
});

const createBodySchema = z.object({
  id: z.string().min(1).optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/u, "slug must be kebab-case"),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  members: z.array(spaceMemberSchema).optional(),
  settings: z.record(z.unknown()).optional(),
  actor: z.string().min(1),
  activate: z.boolean().optional(),
});

const archiveBodySchema = z.object({
  actor: z.string().min(1),
  reason: z.string().optional(),
});

const addMemberBodySchema = z.object({
  actor: z.string().min(1),
  member: spaceMemberSchema,
});

const removeMemberBodySchema = z.object({
  actor: z.string().min(1),
});

function handleError(reply: FastifyReply, err: unknown): FastifyReply {
  if (err instanceof SpaceNotFoundError) {
    return reply.code(404).send({ error: "space_not_found", ref: err.ref });
  }
  if (err instanceof SpaceSlugTakenError) {
    return reply.code(409).send({ error: "space_slug_taken", slug: err.slug });
  }
  if (err instanceof SpaceMemberExistsError) {
    return reply.code(409).send({
      error: "space_member_exists",
      space_id: err.spaceId,
      actor_id: err.actorId,
    });
  }
  if (err instanceof SpaceMemberMissingError) {
    return reply.code(404).send({
      error: "space_member_missing",
      space_id: err.spaceId,
      actor_id: err.actorId,
    });
  }
  if (err instanceof InvalidSpaceTransitionError) {
    return reply.code(409).send({
      error: "invalid_transition",
      from: err.from,
      to: err.to,
    });
  }
  if (err instanceof InvalidSpaceMutationError) {
    return reply.code(409).send({
      error: err.code,
      space_id: err.spaceId,
      detail: err.message,
    });
  }
  if (err instanceof z.ZodError) {
    return reply.code(422).send({ error: "invalid_input", issues: err.issues });
  }
  const message = err instanceof Error ? err.message : "internal_error";
  return reply.code(500).send({ error: "internal_error", detail: message });
}

export function registerSpacesRoutes(app: FastifyInstance): void {
  app.get(
    "/",
    async (
      request: FastifyRequest<{ Querystring: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      try {
        const filter = listQuerySchema.parse(request.query ?? {});
        return { spaces: listSpaces(filter) };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.get(
    "/:ref",
    async (
      request: FastifyRequest<{ Params: { ref: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { ref } = refParamsSchema.parse(request.params);
        const space = getSpace(ref);
        if (!space) {
          return reply.code(404).send({ error: "space_not_found", ref });
        }
        return { space, transitions: listTransitions(space.id) };
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
        const space = createSpace({
          slug: body.slug,
          name: body.name,
          description: body.description ?? null,
          actor: body.actor,
          ...(body.id !== undefined ? { id: body.id } : {}),
          ...(body.members !== undefined ? { members: body.members } : {}),
          ...(body.settings !== undefined ? { settings: body.settings } : {}),
          ...(body.activate !== undefined ? { activate: body.activate } : {}),
        });
        return reply.code(201).send({ space });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/:ref/archive",
    async (
      request: FastifyRequest<{ Params: { ref: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { ref } = refParamsSchema.parse(request.params);
        const body = archiveBodySchema.parse(request.body);
        const space = archiveSpace(ref, body);
        return { space };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.post(
    "/:ref/members",
    async (
      request: FastifyRequest<{ Params: { ref: string }; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const { ref } = refParamsSchema.parse(request.params);
        const body = addMemberBodySchema.parse(request.body);
        const space = addMember(ref, body);
        return reply.code(201).send({ space });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  app.delete(
    "/:ref/members/:actor_id",
    async (
      request: FastifyRequest<{
        Params: { ref: string; actor_id: string };
        Body: unknown;
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { ref, actor_id } = memberParamsSchema.parse(request.params);
        const body = removeMemberBodySchema.parse(request.body ?? {});
        const space = removeMember(ref, {
          actor: body.actor,
          actor_id,
        });
        return { space };
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );
}
