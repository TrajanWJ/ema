/**
 * MCP tool registrations for the Executions subservice.
 *
 * Mirrors the placeholder pattern in `services/core/blueprint/mcp-tools.ts` —
 * exports a typed tool array that the host MCP registry will consume once
 * it lands. Until then `registerExecutionsMcpTools` returns the tool list
 * so callers can wire it up manually.
 *
 * Tools:
 *   - executions_list              — filterable list
 *   - executions_show              — single record + phase log + steps
 *   - executions_create            — create a new execution
 *   - executions_transition_phase  — append-only phase log entry
 *   - executions_append_step       — append a step-journal checkpoint
 *   - executions_reflexion         — get last N executions for an intent
 */

import { z } from "zod";

import {
  actorPhaseSchema,
  executionStatusSchema,
} from "@ema/shared/schemas";

import { getDb } from "../../persistence/db.js";
import {
  appendStep,
  createExecution,
  getExecution,
  listExecutions,
  listPhaseTransitions,
  transitionPhase,
} from "./executions.service.js";
import { buildReflexionPrefix, getReflexionContext } from "./reflexion.js";

export interface ExecutionsMcpTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (input: unknown) => Promise<unknown> | unknown;
}

const listInput = z.object({
  status: executionStatusSchema.optional(),
  mode: z.string().min(1).optional(),
  intent_slug: z.string().min(1).optional(),
  project_slug: z.string().min(1).optional(),
  include_archived: z.boolean().optional(),
});

const showInput = z.object({ id: z.string().min(1) });

const createInput = z.object({
  title: z.string().min(1),
  objective: z.string().optional(),
  mode: z.string().min(1).optional(),
  status: executionStatusSchema.optional(),
  requires_approval: z.boolean().optional(),
  project_slug: z.string().optional(),
  intent_slug: z.string().optional(),
  intent_path: z.string().optional(),
  proposal_id: z.string().optional(),
  space_id: z.string().optional(),
});

const phaseInput = z.object({
  id: z.string().min(1),
  to: actorPhaseSchema,
  reason: z.string().min(1),
  summary: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const stepInput = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  note: z.string().optional(),
  at: z.string().datetime().optional(),
});

const reflexionInput = z.object({
  intent_slug: z.string().min(1),
  limit: z.number().int().positive().max(20).optional(),
  exclude_id: z.string().optional(),
});

export const executionsMcpTools: readonly ExecutionsMcpTool[] = [
  {
    name: "executions_list",
    description:
      "List executions in the queue. Filters: status, mode, intent_slug, project_slug. Archived rows excluded unless include_archived is true.",
    inputSchema: listInput,
    handler: (raw) => {
      const input = listInput.parse(raw ?? {});
      return {
        executions: listExecutions({
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.mode !== undefined ? { mode: input.mode } : {}),
          ...(input.intent_slug !== undefined
            ? { intent_slug: input.intent_slug }
            : {}),
          ...(input.project_slug !== undefined
            ? { project_slug: input.project_slug }
            : {}),
          ...(input.include_archived !== undefined
            ? { includeArchived: input.include_archived }
            : {}),
        }),
      };
    },
  },
  {
    name: "executions_show",
    description:
      "Fetch a single execution, its phase transition log, and its step journal.",
    inputSchema: showInput,
    handler: (raw) => {
      const { id } = showInput.parse(raw);
      const execution = getExecution(id);
      if (!execution) return { error: "execution_not_found", id };
      return {
        execution,
        transitions: listPhaseTransitions(id),
        step_journal: execution.step_journal,
      };
    },
  },
  {
    name: "executions_create",
    description:
      "Create a new execution record. Use when dispatching a new run against an intent or brain-dump item.",
    inputSchema: createInput,
    handler: (raw) => {
      const input = createInput.parse(raw);
      const execution = createExecution({
        title: input.title,
        objective: input.objective ?? null,
        mode: input.mode ?? null,
        status: input.status ?? null,
        requires_approval: input.requires_approval ?? null,
        project_slug: input.project_slug ?? null,
        intent_slug: input.intent_slug ?? null,
        intent_path: input.intent_path ?? null,
        proposal_id: input.proposal_id ?? null,
        space_id: input.space_id ?? null,
      });
      return { execution };
    },
  },
  {
    name: "executions_transition_phase",
    description:
      "Append-only phase transition. Allowed phases: idle, plan, execute, review, retro. Enforces the DEC-005 allowed-forward map; rejects disallowed transitions.",
    inputSchema: phaseInput,
    handler: (raw) => {
      const input = phaseInput.parse(raw);
      return transitionPhase(input.id, {
        to: input.to,
        reason: input.reason,
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      });
    },
  },
  {
    name: "executions_append_step",
    description:
      "Append a checkpoint to an execution's step journal. Read-mostly — mutations go only through this tool.",
    inputSchema: stepInput,
    handler: (raw) => {
      const input = stepInput.parse(raw);
      const execution = appendStep(input.id, {
        label: input.label,
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.at !== undefined ? { at: input.at } : {}),
      });
      return { execution };
    },
  },
  {
    name: "executions_reflexion",
    description:
      "Fetch the last N executions for an intent slug. Use to prepend reflexion lessons to a new prompt. Exclude_id omits the current execution from its own history.",
    inputSchema: reflexionInput,
    handler: (raw) => {
      const input = reflexionInput.parse(raw);
      const history = getReflexionContext(getDb(), input.intent_slug, {
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.exclude_id !== undefined
          ? { excludeId: input.exclude_id }
          : {}),
      });
      return { history, prefix: buildReflexionPrefix(history) };
    },
  },
];

export function registerExecutionsMcpTools(): readonly ExecutionsMcpTool[] {
  return executionsMcpTools;
}
