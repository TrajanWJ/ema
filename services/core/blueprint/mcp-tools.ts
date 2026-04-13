/**
 * MCP tool registrations for the Blueprint subservice.
 *
 * Per DEC-004 §6. No existing MCP tool registry lives in
 * `services/` yet, so this file exports:
 *
 *   1. A `BlueprintMcpTool` interface — the shape the registry will consume
 *      when it lands (mirrors Anthropic's MCP SDK tool definition).
 *   2. A `blueprintMcpTools` array of tool definitions with JSONSchema inputs
 *      and handler functions.
 *   3. A `registerBlueprintMcpTools` placeholder so the caller has a single
 *      import whether or not the host registry is wired up yet.
 *
 * When the MCP host lands, the placeholder is replaced by a real call into
 * whatever `Ema.MCP` registry interface is settled — consumers won't have to
 * change their imports.
 */

import { z } from "zod";

import {
  gacCategorySchema,
  gacOptionSchema,
  gacPrioritySchema,
} from "@ema/shared/schemas";
import {
  answerGacCard,
  createGacCard,
  deferGacCard,
  getGacCard,
  listGacCards,
  listGacTransitions,
  promoteGacCard,
} from "./service.js";

export interface BlueprintMcpTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (input: unknown) => Promise<unknown> | unknown;
}

const listInput = z.object({
  status: z.enum(["pending", "answered", "deferred", "promoted"]).optional(),
  category: gacCategorySchema.optional(),
  priority: gacPrioritySchema.optional(),
});

const showInput = z.object({ id: z.string().regex(/^GAC-\d{3,}$/u) });

const createInput = z.object({
  title: z.string().min(1),
  question: z.string().min(1),
  options: z.array(gacOptionSchema).min(1),
  category: gacCategorySchema,
  priority: gacPrioritySchema,
  author: z.string().default("agent"),
});

const answerInput = z.object({
  id: z.string().regex(/^GAC-\d{3,}$/u),
  selected: z.string().nullable(),
  freeform: z.string().optional(),
  answered_by: z.string().default("agent"),
  reason: z.string().optional(),
});

const deferInput = z.object({
  id: z.string().regex(/^GAC-\d{3,}$/u),
  actor: z.string().default("agent"),
  reason: z.string().min(1),
  blocker_id: z.string().optional(),
});

const promoteInput = z.object({
  id: z.string().regex(/^GAC-\d{3,}$/u),
  actor: z.string().default("agent"),
  reason: z.string().min(1),
  blocker_id: z.string().min(1),
});

export const blueprintMcpTools: readonly BlueprintMcpTool[] = [
  {
    name: "gac_list",
    description:
      "List GAC cards in the Blueprint queue. Optional filters: status, category, priority.",
    inputSchema: listInput,
    handler: (raw) => {
      const input = listInput.parse(raw ?? {});
      return { cards: listGacCards(input) };
    },
  },
  {
    name: "gac_show",
    description: "Fetch a single GAC card by id, with its transition history.",
    inputSchema: showInput,
    handler: (raw) => {
      const { id } = showInput.parse(raw);
      const card = getGacCard(id);
      if (!card) return { error: "gac_not_found", id };
      return { card, transitions: listGacTransitions(id) };
    },
  },
  {
    name: "gac_create",
    description:
      "Create a new pending GAC card. Use when an agent identifies a design gap, assumption, or clarification during research.",
    inputSchema: createInput,
    handler: (raw) => {
      const input = createInput.parse(raw);
      const card = createGacCard(input);
      return { card };
    },
  },
  {
    name: "gac_answer",
    description:
      "Answer a pending GAC card. Transitions the card from `pending` to `answered`.",
    inputSchema: answerInput,
    handler: (raw) => {
      const input = answerInput.parse(raw);
      const card = answerGacCard(input.id, {
        selected: input.selected,
        ...(input.freeform !== undefined ? { freeform: input.freeform } : {}),
        answered_by: input.answered_by,
        ...(input.reason !== undefined ? { reason: input.reason } : {}),
      });
      return { card };
    },
  },
  {
    name: "gac_defer",
    description:
      "Defer a pending GAC card. Transitions `pending` to `deferred`. Supply a blocker id if one exists.",
    inputSchema: deferInput,
    handler: (raw) => {
      const input = deferInput.parse(raw);
      const card = deferGacCard(input.id, {
        actor: input.actor,
        reason: input.reason,
        ...(input.blocker_id !== undefined
          ? { blocker_id: input.blocker_id }
          : {}),
      });
      return { card };
    },
  },
  {
    name: "gac_promote",
    description:
      "Promote a pending GAC card to a blocker. Transitions `pending` to `promoted`.",
    inputSchema: promoteInput,
    handler: (raw) => {
      const input = promoteInput.parse(raw);
      const card = promoteGacCard(input.id, {
        actor: input.actor,
        reason: input.reason,
        blocker_id: input.blocker_id,
      });
      return { card };
    },
  },
];

/**
 * Placeholder registration hook. When the host MCP registry lands, this
 * function will call into it. For now it returns the tool array so callers
 * can wire it up manually.
 */
export function registerBlueprintMcpTools(): readonly BlueprintMcpTool[] {
  return blueprintMcpTools;
}
