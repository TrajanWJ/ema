/**
 * `claude` transform — run Claude as a mid-pipe reshape step.
 *
 * Wraps Composer the same way `claude:run` does, but the response is
 * injected back into the payload under a configurable key so downstream
 * actions can consume it. Uses the same provider function as the claude
 * action so tests can share a stub.
 */

import { z } from "zod";
import { Composer } from "../../composer/index.js";
import type { TransformDef, TransformResult } from "../types.js";

export type ClaudeTransformProvider = (args: {
  prompt: string;
  context: Record<string, unknown>;
  model?: string;
}) => Promise<string>;

const defaultProvider: ClaudeTransformProvider = async ({ prompt }) =>
  `stub-transform-response: ${prompt.slice(0, 80)}`;

let activeProvider: ClaudeTransformProvider = defaultProvider;
let activeComposer: Composer | null = null;

export function setClaudeTransformProvider(
  provider: ClaudeTransformProvider | null,
): void {
  activeProvider = provider ?? defaultProvider;
}

export function setClaudeTransformComposer(composer: Composer | null): void {
  activeComposer = composer;
}

function getComposer(): Composer {
  if (!activeComposer) activeComposer = new Composer();
  return activeComposer;
}

const configSchema = z.object({
  prompt_template: z.string().default("{{content}}"),
  response_key: z.string().default("claude_response"),
  model: z.string().optional(),
});

function renderTemplate(
  template: string,
  payload: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/gu, (_m, key: string) => {
    const v = payload[key];
    if (v === undefined || v === null) return "";
    return typeof v === "string" ? v : JSON.stringify(v);
  });
}

export const claudeTransform: TransformDef = {
  name: "claude",
  label: "Claude",
  description: "Run Claude as a transform",
  apply: async (payload, rawConfig): Promise<TransformResult> => {
    const config = configSchema.parse(rawConfig ?? {});
    const map =
      payload && typeof payload === "object"
        ? { ...(payload as Record<string, unknown>) }
        : {};
    const prompt = renderTemplate(config.prompt_template, map);

    const composer = getComposer();
    const contextObject: Record<string, unknown> = { payload: map };
    if (config.model !== undefined) contextObject.model = config.model;

    const compile = await composer.compile({
      prompt,
      context: contextObject,
      metadata: { actorId: "pipes:claude-transform" },
    });

    const response = await activeProvider(
      config.model !== undefined
        ? { prompt, context: contextObject, model: config.model }
        : { prompt, context: contextObject },
    );

    await composer.recordResponse(compile.artifact.runId, response);

    map[config.response_key] = response;
    map.claude_run_id = compile.artifact.runId;

    return { payload: map, halted: false };
  },
};
