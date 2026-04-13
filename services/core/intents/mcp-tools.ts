/**
 * MCP tool registrations for the Intents subservice.
 *
 * Mirrors the pattern established by Blueprint: the host MCP registry does
 * not yet live in `services/`, so this file exports a tool-definition array
 * plus a placeholder `registerIntentsMcpTools` hook. When the host registry
 * lands, consumers swap the implementation without changing their imports.
 */

import { z } from "zod";

import {
  actorPhaseSchema,
  intentKindSchema,
  intentLevelSchema,
  intentStatusSchema,
} from "@ema/shared/schemas";
import {
  attachActor,
  attachExecution,
  attachSession,
  createIntent,
  getIntent,
  getIntentTree,
  getRuntimeBundle,
  listIntentPhaseTransitions,
  listIntents,
  transitionPhase,
  updateIntentStatus,
} from "./service.js";

export interface IntentsMcpTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (input: unknown) => Promise<unknown> | unknown;
}

const listInput = z.object({
  status: intentStatusSchema.optional(),
  level: intentLevelSchema.optional(),
  kind: intentKindSchema.optional(),
  phase: actorPhaseSchema.optional(),
  project_id: z.string().optional(),
  parent_id: z.string().optional(),
});

const showInput = z.object({ slug: z.string().min(1) });

const createInput = z.object({
  slug: z.string().min(3).max(128).optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  level: intentLevelSchema,
  status: intentStatusSchema.optional(),
  kind: intentKindSchema.optional(),
  phase: actorPhaseSchema.optional(),
  exit_condition: z.string().optional(),
  scope: z.array(z.string()).optional(),
});

const transitionInput = z.object({
  slug: z.string().min(1),
  to: actorPhaseSchema,
  reason: z.string().min(1),
  summary: z.string().optional(),
});

const statusInput = z.object({
  slug: z.string().min(1),
  status: intentStatusSchema,
  reason: z.string().optional(),
});

const treeInput = z.object({
  root: z.string().min(1).optional(),
});

const runtimeInput = z.object({
  slug: z.string().min(1),
});

const attachExecutionInput = z.object({
  slug: z.string().min(1),
  execution_id: z.string().min(1),
  provenance: z.string().optional(),
});

const attachActorInput = z.object({
  slug: z.string().min(1),
  actor_id: z.string().min(1),
  relation: z.string().optional(),
});

const attachSessionInput = z.object({
  slug: z.string().min(1),
  session_id: z.string().min(1),
  relation: z.string().optional(),
});

export const intentsMcpTools: readonly IntentsMcpTool[] = [
  {
    name: "intents_list",
    description:
      "List intents in the Intent Engine. Filters: status, level, kind, phase, project_id, parent_id.",
    inputSchema: listInput,
    handler: (raw) => {
      const input = listInput.parse(raw ?? {});
      return { intents: listIntents(input) };
    },
  },
  {
    name: "intents_show",
    description:
      "Fetch a single intent by kebab-slug, including its phase transition history.",
    inputSchema: showInput,
    handler: (raw) => {
      const { slug } = showInput.parse(raw);
      const intent = getIntent(slug);
      if (!intent) return { error: "intent_not_found", slug };
      return { intent, transitions: listIntentPhaseTransitions(slug) };
    },
  },
  {
    name: "intents_create",
    description:
      "Create a new intent. If `kind` is `implement` or `port`, `exit_condition` and `scope` are mandatory (GAC-004).",
    inputSchema: createInput,
    handler: (raw) => {
      const input = createInput.parse(raw);
      const intent = createIntent({
        title: input.title,
        level: input.level,
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.phase !== undefined ? { phase: input.phase } : {}),
        ...(input.exit_condition !== undefined
          ? { exit_condition: input.exit_condition }
          : {}),
        ...(input.scope !== undefined ? { scope: input.scope } : {}),
      });
      return { intent };
    },
  },
  {
    name: "intents_transition_phase",
    description:
      "Transition an intent to a new work phase. Allowed transitions follow DEC-005 (idle→plan→execute→review→retro, forward skips allowed).",
    inputSchema: transitionInput,
    handler: (raw) => {
      const input = transitionInput.parse(raw);
      const intent = transitionPhase(input.slug, {
        to: input.to,
        reason: input.reason,
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
      });
      return { intent };
    },
  },
  {
    name: "intents_update_status",
    description:
      "Update an intent's status (draft/active/paused/completed/abandoned).",
    inputSchema: statusInput,
    handler: (raw) => {
      const input = statusInput.parse(raw);
      const intent = updateIntentStatus(input.slug, {
        status: input.status,
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
      });
      return { intent };
    },
  },
  {
    name: "get_intent_tree",
    description:
      "Return the intent hierarchy rooted at `root` (or every top-level intent if `root` is omitted). Walks `parent_id` to assemble children.",
    inputSchema: treeInput,
    handler: (raw) => {
      const input = treeInput.parse(raw ?? {});
      return { tree: getIntentTree(input.root ?? null) };
    },
  },
  {
    name: "get_intent_runtime",
    description:
      "Assemble the full runtime bundle for an intent: intent record, current phase, phase transitions, recent events, and all attached executions/proposals/actors/sessions/tasks/canon links.",
    inputSchema: runtimeInput,
    handler: (raw) => {
      const { slug } = runtimeInput.parse(raw);
      const bundle = getRuntimeBundle(slug);
      if (!bundle) return { error: "intent_not_found", slug };
      return { bundle };
    },
  },
  {
    name: "attach_intent_execution",
    description:
      "Attach an execution record to an intent via the `runtime` relation. Creates an `intent_links` row and appends to the intent event log.",
    inputSchema: attachExecutionInput,
    handler: (raw) => {
      const input = attachExecutionInput.parse(raw);
      const link = attachExecution(
        input.slug,
        input.execution_id,
        input.provenance,
      );
      return { link };
    },
  },
  {
    name: "attach_intent_actor",
    description:
      "Attach an actor (agent/worker) to an intent. Default relation is `owner`; pass `relation: 'assignee'` for delegated work.",
    inputSchema: attachActorInput,
    handler: (raw) => {
      const input = attachActorInput.parse(raw);
      const link = attachActor(input.slug, input.actor_id, input.relation);
      return { link };
    },
  },
  {
    name: "attach_intent_session",
    description:
      "Attach a session record (Claude/Codex/Cursor) to an intent. Default relation is `runtime`.",
    inputSchema: attachSessionInput,
    handler: (raw) => {
      const input = attachSessionInput.parse(raw);
      const link = attachSession(input.slug, input.session_id, input.relation);
      return { link };
    },
  },
];

/**
 * Placeholder registration hook. When the host MCP registry lands, this
 * function will call into it. For now it returns the tool array so callers
 * can wire it up manually.
 */
export function registerIntentsMcpTools(): readonly IntentsMcpTool[] {
  return intentsMcpTools;
}
