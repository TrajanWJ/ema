/**
 * HTTP + WebSocket surface for the agent-runtime heartbeat — GAC-003.
 *
 * POST `/api/agents/runtime-transition`
 *   Body: { actor_id, from_state?, to_state, reason, observed_at }
 *
 * The out-of-process heartbeat worker in `@ema/workers` classifies pty
 * panes and POSTs a transition to this endpoint whenever the observed
 * state changes. This endpoint validates the payload against the canonical
 * Zod enum and broadcasts the event over the existing Phoenix-protocol
 * WebSocket bus so every subscribed vApp (AgentFleet, Dashboard, Ambient
 * Strip) sees the transition in one hop.
 *
 * The topic pattern is `agents:runtime` with event name `state_transition`.
 * Broadcast payload matches `RuntimeTransition` from `runtime-poller.ts`
 * but keyed in snake_case to match the rest of the wire protocol.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { agentRuntimeStateSchema } from "@ema/shared/schemas";

import { broadcast } from "../../realtime/server.js";

const transitionBodySchema = z.object({
  actor_id: z.string().min(1),
  from_state: agentRuntimeStateSchema.nullable().optional(),
  to_state: agentRuntimeStateSchema,
  reason: z.string().min(1),
  observed_at: z.string().datetime(),
});

export function registerRoutes(app: FastifyInstance): void {
  app.post(
    "/api/agents/runtime-transition",
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply: FastifyReply,
    ) => {
      const parsed = transitionBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "invalid_transition",
          issues: parsed.error.issues,
        });
      }

      broadcast("agents:runtime", "state_transition", parsed.data);
      return reply.code(202).send({ status: "accepted" });
    },
  );
}
