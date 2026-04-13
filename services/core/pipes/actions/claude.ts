/**
 * Claude action — THE ONE NON-STUB ACTION.
 *
 * Routes a pipe payload through the Composer so every LLM call produces an
 * inspectable artifact directory (`prompt.md`, `context.json`, `response.md`)
 * on disk. The LLM invocation itself is injected via a provider function so
 * tests can stub it without touching the network.
 *
 * v1 default provider is an echo — it returns the compiled prompt as the
 * response so the full compile → invoke → recordResponse cycle runs end to
 * end. Stream 5 replaces the default provider with the real Claude HTTP
 * bridge.
 */

import { z } from "zod";
import { Composer } from "../../composer/index.js";
import type { ActionDef } from "../types.js";
import { emitPipeActionEvent, pipeLog } from "../voice.js";

/**
 * Provider function — given a compiled prompt + context, returns the LLM
 * response text. Injected at module level so tests can swap in a fake.
 */
export type ClaudeProvider = (args: {
  prompt: string;
  context: Record<string, unknown>;
  model?: string;
}) => Promise<string>;

const defaultProvider: ClaudeProvider = async ({ prompt }) => {
  return `stub-response: ${prompt.slice(0, 80)}`;
};

let activeProvider: ClaudeProvider = defaultProvider;
let activeComposer: Composer | null = null;

export function setClaudeProvider(provider: ClaudeProvider | null): void {
  activeProvider = provider ?? defaultProvider;
}

export function setClaudeComposer(composer: Composer | null): void {
  activeComposer = composer;
}

function getComposer(): Composer {
  if (!activeComposer) activeComposer = new Composer();
  return activeComposer;
}

const input = z
  .object({
    prompt_template: z.string().default("Process this: {{content}}"),
    content: z.string().optional(),
    event_keys: z.array(z.string()).default([]),
    model: z.string().optional(),
    event_type: z.string().default("general"),
  })
  .passthrough();

const output = z.object({
  ok: z.literal(true),
  run_id: z.string(),
  artifact_dir: z.string(),
  response: z.string(),
});

/**
 * Render `{{key}}` placeholders from a flat payload map. Unknown keys
 * collapse to the empty string — matches the Elixir TemplateRenderer
 * behaviour and keeps prompt compilation total.
 */
function renderTemplate(
  template: string,
  payload: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/gu, (_match, key: string) => {
    const value = payload[key];
    if (value === undefined || value === null) return "";
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

export const claudeActions: readonly ActionDef[] = [
  {
    name: "claude:run",
    context: "claude",
    label: "Run Claude AI",
    description: "Send payload through Claude via the Composer artifact layer",
    inputSchema: input,
    outputSchema: output,
    handler: async (raw, ctx) => {
      const parsed = input.parse(raw);
      const composer = getComposer();

      const payloadMap = parsed as unknown as Record<string, unknown>;
      const prompt = renderTemplate(parsed.prompt_template, payloadMap);

      const extras: Record<string, unknown> = {};
      if (parsed.model !== undefined) extras.model = parsed.model;

      const contextObject: Record<string, unknown> = {
        event_type: parsed.event_type,
        event_keys: parsed.event_keys,
        pipe_id: ctx.pipeId,
        trigger: ctx.trigger,
        payload: payloadMap,
        ...extras,
      };

      const compile = await composer.compile({
        prompt,
        context: contextObject,
        metadata: { actorId: "pipes:claude-run", purpose: parsed.event_type },
      });

      emitPipeActionEvent(ctx, "claude:run", {
        run_id: compile.artifact.runId,
      });

      let response: string;
      try {
        const maybeModel = parsed.model;
        response = await activeProvider(
          maybeModel !== undefined
            ? { prompt, context: contextObject, model: maybeModel }
            : { prompt, context: contextObject },
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        pipeLog(`claude:run provider failed: ${message}`);
        throw err;
      }

      await composer.recordResponse(compile.artifact.runId, response);
      pipeLog(
        `claude:run recorded ${compile.artifact.runId} response=${response.length}ch`,
      );

      return {
        ok: true as const,
        run_id: compile.artifact.runId,
        artifact_dir: compile.artifact.artifactDir,
        response,
      };
    },
  },
];
