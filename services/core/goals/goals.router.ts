import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { broadcast } from "../../realtime/server.js";
import {
  completeGoal,
  createGoal,
  createBuildoutForGoal,
  createProposalForGoal,
  deleteGoal,
  getGoal,
  getGoalContext,
  GoalBuildoutNotFoundError,
  GoalNotFoundError,
  GoalProposalNotFoundError,
  listGoals,
  startExecutionForGoal,
  updateGoal,
} from "./goals.service.js";

const goalBodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  timeframe: z.enum(["weekly", "monthly", "quarterly", "yearly", "3year"]).optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  owner_kind: z.enum(["human", "agent"]).optional(),
  owner_id: z.string().min(1).optional(),
  parent_id: z.string().nullable().optional(),
  project_id: z.string().nullable().optional(),
  space_id: z.string().nullable().optional(),
  intent_slug: z.string().nullable().optional(),
  target_date: z.string().datetime().nullable().optional(),
  success_criteria: z.string().nullable().optional(),
});

const createGoalProposalBodySchema = z.object({
  actor_id: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  rationale: z.string().min(1).optional(),
  plan_steps: z.array(z.string().min(1)).min(1).optional(),
});

const createGoalExecutionBodySchema = z.object({
  proposal_id: z.string().min(1).nullable().optional(),
  buildout_id: z.string().min(1).nullable().optional(),
  title: z.string().min(1).optional(),
  objective: z.string().nullable().optional(),
  mode: z.string().min(1).optional(),
  requires_approval: z.boolean().optional(),
  project_slug: z.string().min(1).nullable().optional(),
  space_id: z.string().min(1).nullable().optional(),
});

const createGoalBuildoutBodySchema = z.object({
  owner_id: z.string().min(1).optional(),
  start_at: z.string().datetime(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  plan_minutes: z.number().int().positive().optional(),
  execute_minutes: z.number().int().positive().optional(),
  review_minutes: z.number().int().positive().optional(),
  retro_minutes: z.number().int().positive().optional(),
});

interface GoalParams {
  id: string;
}

interface GoalQuery {
  status?: "active" | "completed" | "archived";
  timeframe?: "weekly" | "monthly" | "quarterly" | "yearly" | "3year";
  owner_kind?: "human" | "agent";
  owner_id?: string;
  project_id?: string;
  parent_id?: string;
  intent_slug?: string;
}

function invalid(reply: FastifyReply, error: z.ZodError) {
  return reply.code(422).send({ error: "invalid_goal_payload", issues: error.issues });
}

export function registerRoutes(app: FastifyInstance): void {
  app.get(
    "/api/goals",
    async (request: FastifyRequest<{ Querystring: GoalQuery }>) => ({
      goals: listGoals({
        status: request.query.status,
        timeframe: request.query.timeframe,
        owner_kind: request.query.owner_kind,
        owner_id: request.query.owner_id,
        project_id: request.query.project_id,
        parent_id: request.query.parent_id,
        intent_slug: request.query.intent_slug,
      }),
    }),
  );

  app.get(
    "/api/goals/:id",
    async (
      request: FastifyRequest<{ Params: GoalParams }>,
      reply: FastifyReply,
    ) => {
      const goal = getGoal(request.params.id);
      if (!goal) {
        return reply.code(404).send({ error: "goal_not_found" });
      }
      return goal;
    },
  );

  app.get(
    "/api/goals/:id/context",
    async (
      request: FastifyRequest<{ Params: GoalParams }>,
      reply: FastifyReply,
    ) => {
      const payload = getGoalContext(request.params.id);
      if (!payload) {
        return reply.code(404).send({ error: "goal_not_found" });
      }
      return payload;
    },
  );

  app.post(
    "/api/goals",
    async (
      request: FastifyRequest<{ Body: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      const parsed = goalBodySchema.extend({
        title: z.string().min(1),
        timeframe: z.enum(["weekly", "monthly", "quarterly", "yearly", "3year"]),
      }).safeParse(request.body ?? {});

      if (!parsed.success) return invalid(reply, parsed.error);

      const goal = createGoal(parsed.data);
      broadcast("goals:lobby", "goal_created", goal);
      return goal;
    },
  );

  app.post(
    "/api/goals/:id/proposals",
    async (
      request: FastifyRequest<{ Params: GoalParams; Body: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      const parsed = createGoalProposalBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) return invalid(reply, parsed.error);

      try {
        const proposal = createProposalForGoal(request.params.id, parsed.data);
        broadcast("goals:lobby", "goal_updated", getGoal(request.params.id));
        return reply.code(201).send({ proposal });
      } catch (error) {
        if (error instanceof GoalNotFoundError) {
          return reply.code(404).send({ error: error.code });
        }
        if (error instanceof GoalProposalNotFoundError) {
          return reply.code(404).send({
            error: error.code,
            goal_id: error.goalId,
            proposal_id: error.proposalId,
          });
        }
        if (error instanceof GoalBuildoutNotFoundError) {
          return reply.code(404).send({
            error: error.code,
            goal_id: error.goalId,
            buildout_id: error.buildoutId,
          });
        }
        if (error instanceof Error && error.message === "goal_intent_required") {
          return reply.code(409).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  app.post(
    "/api/goals/:id/buildouts",
    async (
      request: FastifyRequest<{ Params: GoalParams; Body: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      const parsed = createGoalBuildoutBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) return invalid(reply, parsed.error);

      try {
        const buildout = createBuildoutForGoal(request.params.id, parsed.data);
        broadcast("goals:lobby", "goal_updated", getGoal(request.params.id));
        broadcast("calendar:lobby", "calendar_buildout_created", buildout);
        return reply.code(201).send(buildout);
      } catch (error) {
        if (error instanceof GoalNotFoundError) {
          return reply.code(404).send({ error: error.code });
        }
        if (error instanceof Error && error.message === "goal_buildout_owner_required") {
          return reply.code(409).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  app.post(
    "/api/goals/:id/executions",
    async (
      request: FastifyRequest<{ Params: GoalParams; Body: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      const parsed = createGoalExecutionBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) return invalid(reply, parsed.error);

      try {
        const execution = startExecutionForGoal(request.params.id, parsed.data);
        broadcast("goals:lobby", "goal_updated", getGoal(request.params.id));
        broadcast("executions:all", "execution_created", execution);
        return reply.code(201).send({ execution });
      } catch (error) {
        if (error instanceof GoalNotFoundError) {
          return reply.code(404).send({ error: error.code });
        }
        if (error instanceof Error && error.message === "goal_intent_required") {
          return reply.code(409).send({ error: error.message });
        }
        throw error;
      }
    },
  );

  app.put(
    "/api/goals/:id",
    async (
      request: FastifyRequest<{ Params: GoalParams; Body: Record<string, unknown> }>,
      reply: FastifyReply,
    ) => {
      const parsed = goalBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) return invalid(reply, parsed.error);

      try {
        const goal = updateGoal(request.params.id, parsed.data);
        broadcast("goals:lobby", "goal_updated", goal);
        return goal;
      } catch (error) {
        if (error instanceof GoalNotFoundError) {
          return reply.code(404).send({ error: error.code });
        }
        throw error;
      }
    },
  );

  app.post(
    "/api/goals/:id/complete",
    async (
      request: FastifyRequest<{ Params: GoalParams }>,
      reply: FastifyReply,
    ) => {
      try {
        const goal = completeGoal(request.params.id);
        broadcast("goals:lobby", "goal_updated", goal);
        return goal;
      } catch (error) {
        if (error instanceof GoalNotFoundError) {
          return reply.code(404).send({ error: error.code });
        }
        throw error;
      }
    },
  );

  app.delete(
    "/api/goals/:id",
    async (
      request: FastifyRequest<{ Params: GoalParams }>,
      reply: FastifyReply,
    ) => {
      const deleted = deleteGoal(request.params.id);
      if (!deleted) {
        return reply.code(404).send({ error: "goal_not_found" });
      }
      broadcast("goals:lobby", "goal_deleted", { id: request.params.id });
      return { ok: true };
    },
  );
}
