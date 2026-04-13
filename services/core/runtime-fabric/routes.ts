import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  runtimeInputModeSchema,
  runtimeToolKindSchema,
} from "@ema/shared/schemas";

import {
  createRuntimeSession,
  dispatchRuntimePrompt,
  forgetRuntimeSession,
  listRuntimeSessionEvents,
  listRuntimeSessions,
  listRuntimeTools,
  readRuntimeSessionScreen,
  scanRuntimeTools,
  sendRuntimeSessionInput,
  stopRuntimeSession,
} from "./service.js";

const createSessionBodySchema = z.object({
  tool_kind: runtimeToolKindSchema,
  cwd: z.string().min(1).optional(),
  session_name: z.string().min(1).optional(),
  startup_options: z.array(z.string().min(1)).optional(),
  command: z.string().min(1).optional(),
  initial_input: z.string().min(1).optional(),
  simulate_typing: z.boolean().optional(),
});

const dispatchBodySchema = createSessionBodySchema.extend({
  session_id: z.string().min(1).optional(),
  prompt: z.string().min(1),
});

const inputBodySchema = z.object({
  mode: runtimeInputModeSchema.optional(),
  text: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
  submit: z.boolean().optional(),
});

const screenQuerySchema = z.object({
  lines: z.coerce.number().int().min(1).max(1_000).optional(),
});

const eventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const sessionParamsSchema = z.object({
  id: z.string().min(1),
});

function invalid(reply: FastifyReply, err: unknown): FastifyReply {
  const detail = err instanceof Error ? err.message : "invalid_input";
  return reply.code(422).send({
    error: "invalid_input",
    detail,
  });
}

function internal(reply: FastifyReply, err: unknown): FastifyReply {
  const detail = err instanceof Error ? err.message : "internal_error";
  const code = detail.startsWith("runtime_session_not_found") ? 404 : 500;
  return reply.code(code).send({
    error: code === 404 ? "not_found" : "internal_error",
    detail,
  });
}

export function registerRoutes(app: FastifyInstance): void {
  app.get("/api/runtime-fabric/tools", async () => ({
    tools: listRuntimeTools(),
  }));

  app.post("/api/runtime-fabric/tools/scan", async () => ({
    tools: scanRuntimeTools(),
  }));

  app.get("/api/runtime-fabric/sessions", async () => ({
    sessions: listRuntimeSessions(),
  }));

  app.post(
    "/api/runtime-fabric/sessions",
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      try {
        const body = createSessionBodySchema.parse(request.body ?? {});
        const input = {
          tool_kind: body.tool_kind,
          ...(body.cwd ? { cwd: body.cwd } : {}),
          ...(body.session_name ? { session_name: body.session_name } : {}),
          ...(body.startup_options ? { startup_options: body.startup_options } : {}),
          ...(body.command ? { command: body.command } : {}),
          ...(body.initial_input ? { initial_input: body.initial_input } : {}),
          ...(body.simulate_typing !== undefined ? { simulate_typing: body.simulate_typing } : {}),
        };
        return {
          session: createRuntimeSession(input),
        };
      } catch (err) {
        if (err instanceof z.ZodError) {
          return invalid(reply, err);
        }
        return internal(reply, err);
      }
    },
  );

  app.post(
    "/api/runtime-fabric/dispatch",
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      try {
        const body = dispatchBodySchema.parse(request.body ?? {});
        const input = {
          tool_kind: body.tool_kind,
          prompt: body.prompt,
          ...(body.session_id ? { session_id: body.session_id } : {}),
          ...(body.cwd ? { cwd: body.cwd } : {}),
          ...(body.session_name ? { session_name: body.session_name } : {}),
          ...(body.startup_options ? { startup_options: body.startup_options } : {}),
          ...(body.command ? { command: body.command } : {}),
          ...(body.simulate_typing !== undefined ? { simulate_typing: body.simulate_typing } : {}),
        };
        return dispatchRuntimePrompt(input);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return invalid(reply, err);
        }
        return internal(reply, err);
      }
    },
  );

  app.get(
    "/api/runtime-fabric/sessions/:id",
    async (request: FastifyRequest<{ Params: unknown }>, reply: FastifyReply) => {
      try {
        const params = sessionParamsSchema.parse(request.params);
        const session = listRuntimeSessions().find((candidate) => candidate.id === params.id);
        if (!session) {
          return reply.code(404).send({ error: "not_found" });
        }
        return { session };
      } catch (err) {
        if (err instanceof z.ZodError) {
          return invalid(reply, err);
        }
        return internal(reply, err);
      }
    },
  );

  app.get(
    "/api/runtime-fabric/sessions/:id/screen",
    async (
      request: FastifyRequest<{ Params: unknown; Querystring: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const params = sessionParamsSchema.parse(request.params);
        const query = screenQuerySchema.parse(request.query ?? {});
        return {
          screen: readRuntimeSessionScreen(params.id, query.lines),
        };
      } catch (err) {
        if (err instanceof z.ZodError) {
          return invalid(reply, err);
        }
        return internal(reply, err);
      }
    },
  );

  app.get(
    "/api/runtime-fabric/sessions/:id/events",
    async (
      request: FastifyRequest<{ Params: unknown; Querystring: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const params = sessionParamsSchema.parse(request.params);
        const query = eventsQuerySchema.parse(request.query ?? {});
        return {
          events: listRuntimeSessionEvents(params.id, query.limit),
        };
      } catch (err) {
        if (err instanceof z.ZodError) {
          return invalid(reply, err);
        }
        return internal(reply, err);
      }
    },
  );

  app.post(
    "/api/runtime-fabric/sessions/:id/input",
    async (
      request: FastifyRequest<{ Params: unknown; Body: unknown }>,
      reply: FastifyReply,
    ) => {
      try {
        const params = sessionParamsSchema.parse(request.params);
        const body = inputBodySchema.parse(request.body ?? {});
        const input = {
          id: params.id,
          ...(body.mode ? { mode: body.mode } : {}),
          ...(body.text ? { text: body.text } : {}),
          ...(body.key ? { key: body.key } : {}),
          ...(body.submit !== undefined ? { submit: body.submit } : {}),
        };
        return {
          session: sendRuntimeSessionInput(input),
        };
      } catch (err) {
        if (err instanceof z.ZodError) {
          return invalid(reply, err);
        }
        return internal(reply, err);
      }
    },
  );

  app.post(
    "/api/runtime-fabric/sessions/:id/stop",
    async (request: FastifyRequest<{ Params: unknown }>, reply: FastifyReply) => {
      try {
        const params = sessionParamsSchema.parse(request.params);
        return {
          session: stopRuntimeSession(params.id),
        };
      } catch (err) {
        if (err instanceof z.ZodError) {
          return invalid(reply, err);
        }
        return internal(reply, err);
      }
    },
  );

  app.delete(
    "/api/runtime-fabric/sessions/:id",
    async (request: FastifyRequest<{ Params: unknown }>, reply: FastifyReply) => {
      try {
        const params = sessionParamsSchema.parse(request.params);
        forgetRuntimeSession(params.id);
        return reply.code(204).send();
      } catch (err) {
        if (err instanceof z.ZodError) {
          return invalid(reply, err);
        }
        return internal(reply, err);
      }
    },
  );
}
