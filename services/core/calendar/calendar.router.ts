import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { broadcast } from "../../realtime/server.js";
import {
  CalendarEntryNotFoundError,
  createAgentBuildout,
  createCalendarEntry,
  deleteCalendarEntry,
  getCalendarEntry,
  listCalendarEntries,
  updateCalendarEntry,
} from "./calendar.service.js";

const calendarBodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  entry_kind: z.enum([
    "human_commitment",
    "human_focus_block",
    "agent_virtual_block",
    "milestone",
  ]).optional(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
  owner_kind: z.enum(["human", "agent"]).optional(),
  owner_id: z.string().min(1).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  phase: z.enum(["idle", "plan", "execute", "review", "retro"]).nullable().optional(),
  goal_id: z.string().nullable().optional(),
  task_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  space_id: z.string().nullable().optional(),
  intent_slug: z.string().nullable().optional(),
  execution_id: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
});

const buildoutBodySchema = z.object({
  goal_id: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  owner_id: z.string().min(1),
  start_at: z.string().datetime(),
  plan_minutes: z.number().int().positive().optional(),
  execute_minutes: z.number().int().positive().optional(),
  review_minutes: z.number().int().positive().optional(),
  retro_minutes: z.number().int().positive().optional(),
  project_id: z.string().nullable().optional(),
  space_id: z.string().nullable().optional(),
  intent_slug: z.string().nullable().optional(),
});

interface CalendarParams {
  id: string;
}

interface CalendarQuery {
  owner_kind?: "human" | "agent";
  owner_id?: string;
  status?: "scheduled" | "in_progress" | "completed" | "cancelled";
  entry_kind?: "human_commitment" | "human_focus_block" | "agent_virtual_block" | "milestone";
  goal_id?: string;
  intent_slug?: string;
  from?: string;
  to?: string;
  buildout_id?: string;
}

function invalid(reply: FastifyReply, error: z.ZodError) {
  return reply.code(422).send({ error: "invalid_calendar_payload", issues: error.issues });
}

export function registerRoutes(app: FastifyInstance): void {
  app.get(
    "/api/calendar",
    async (request: FastifyRequest<{ Querystring: CalendarQuery }>) => ({
      entries: listCalendarEntries({
        owner_kind: request.query.owner_kind,
        owner_id: request.query.owner_id,
        status: request.query.status,
        entry_kind: request.query.entry_kind,
        goal_id: request.query.goal_id,
        intent_slug: request.query.intent_slug,
        from: request.query.from,
        to: request.query.to,
        buildout_id: request.query.buildout_id,
      }),
    }),
  );

  app.get(
    "/api/calendar/:id",
    async (
      request: FastifyRequest<{ Params: CalendarParams }>,
      reply: FastifyReply,
    ) => {
      const entry = getCalendarEntry(request.params.id);
      if (!entry) {
        return reply.code(404).send({ error: "calendar_entry_not_found" });
      }
      return entry;
    },
  );

  app.post(
    "/api/calendar",
    async (
      request: FastifyRequest<{ Body: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      const parsed = calendarBodySchema.extend({
        title: z.string().min(1),
        entry_kind: z.enum([
          "human_commitment",
          "human_focus_block",
          "agent_virtual_block",
          "milestone",
        ]),
        starts_at: z.string().datetime(),
      }).safeParse(request.body ?? {});

      if (!parsed.success) return invalid(reply, parsed.error);

      const entry = createCalendarEntry(parsed.data);
      broadcast("calendar:lobby", "calendar_entry_created", entry);
      if (entry.owner_kind === "agent") {
        broadcast(`calendar:agent:${entry.owner_id}`, "calendar_entry_created", entry);
      }
      return entry;
    },
  );

  app.post(
    "/api/calendar/buildouts",
    async (
      request: FastifyRequest<{ Body: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      const parsed = buildoutBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) return invalid(reply, parsed.error);

      const buildout = createAgentBuildout(parsed.data);
      broadcast("calendar:lobby", "calendar_buildout_created", buildout);
      broadcast(`calendar:agent:${parsed.data.owner_id}`, "calendar_buildout_created", buildout);
      return buildout;
    },
  );

  app.put(
    "/api/calendar/:id",
    async (
      request: FastifyRequest<{ Params: CalendarParams; Body: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      const parsed = calendarBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) return invalid(reply, parsed.error);

      try {
        const entry = updateCalendarEntry(request.params.id, parsed.data);
        broadcast("calendar:lobby", "calendar_entry_updated", entry);
        if (entry.owner_kind === "agent") {
          broadcast(`calendar:agent:${entry.owner_id}`, "calendar_entry_updated", entry);
        }
        return entry;
      } catch (error) {
        if (error instanceof CalendarEntryNotFoundError) {
          return reply.code(404).send({ error: error.code });
        }
        throw error;
      }
    },
  );

  app.delete(
    "/api/calendar/:id",
    async (
      request: FastifyRequest<{ Params: CalendarParams }>,
      reply: FastifyReply,
    ) => {
      const existing = getCalendarEntry(request.params.id);
      if (!existing) {
        return reply.code(404).send({ error: "calendar_entry_not_found" });
      }

      const deleted = deleteCalendarEntry(request.params.id);
      if (!deleted) {
        return reply.code(404).send({ error: "calendar_entry_not_found" });
      }

      broadcast("calendar:lobby", "calendar_entry_deleted", { id: request.params.id });
      if (existing.owner_kind === "agent") {
        broadcast(`calendar:agent:${existing.owner_id}`, "calendar_entry_deleted", { id: request.params.id });
      }
      return { ok: true };
    },
  );
}
