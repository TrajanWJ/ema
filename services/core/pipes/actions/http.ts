/**
 * HTTP request action — contract stub.
 * TODO(stream-4): swap the stub fetch for the real outbound HTTP client
 * with retry + circuit breaker.
 */

import { z } from "zod";
import type { ActionDef } from "../types.js";
import { emitPipeActionEvent, pipeLog } from "../voice.js";

const input = z.object({
  url: z.string().url(),
  method: z
    .enum(["get", "post", "put", "patch", "delete", "head", "options"])
    .default("get"),
  headers: z.record(z.string()).default({}),
  body_template: z.string().optional(),
  response_key: z.string().default("http_response"),
});

const output = z.object({
  ok: z.literal(true),
  url: z.string(),
  method: z.string(),
  status: z.number().int(),
  stub: z.literal(true),
});

export const httpActions: readonly ActionDef[] = [
  {
    name: "http:request",
    context: "http",
    label: "HTTP Request",
    description: "Make an outbound HTTP request",
    inputSchema: input,
    outputSchema: output,
    handler: async (raw, ctx) => {
      const parsed = input.parse(raw);
      emitPipeActionEvent(ctx, "http:request", {
        url: parsed.url,
        method: parsed.method,
      });
      pipeLog(`http:request stub ${parsed.method.toUpperCase()} ${parsed.url}`);
      return {
        ok: true as const,
        url: parsed.url,
        method: parsed.method,
        status: 200,
        stub: true as const,
      };
    },
  },
];
