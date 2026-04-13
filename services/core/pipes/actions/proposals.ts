/**
 * Proposal actions — contract stubs.
 * TODO(stream-4): integrate with `services/core/proposals/` (Proposal Engine).
 */

import { z } from "zod";
import type { ActionDef } from "../types.js";
import { emitPipeActionEvent, pipeLog } from "../voice.js";

const seedInput = z.object({
  content: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
  title: z.string().optional(),
  type: z.string().default("brain_dump"),
  project_id: z.string().optional(),
});

const seedOutput = z.object({
  ok: z.literal(true),
  seed_id: z.string(),
  stub: z.literal(true),
});

const idInput = z.object({ proposal_id: z.string().min(1) });
const idOutput = z.object({
  ok: z.literal(true),
  proposal_id: z.string(),
  stub: z.literal(true),
});

const redirectInput = z.object({
  proposal_id: z.string().min(1),
  note: z.string().default(""),
});

const redirectOutput = z.object({
  ok: z.literal(true),
  proposal_id: z.string(),
  note: z.string(),
  stub: z.literal(true),
});

export const proposalActions: readonly ActionDef[] = [
  {
    name: "proposals:create_seed",
    context: "proposals",
    label: "Create Proposal Seed",
    description: "Create a new seed prompt from brain dump or other trigger",
    inputSchema: seedInput,
    outputSchema: seedOutput,
    handler: async (raw, ctx) => {
      const input = seedInput.parse(raw);
      const seed_id = `seed-stub-${ctx.runId.slice(-8)}`;
      emitPipeActionEvent(ctx, "proposals:create_seed", { seed_id, input });
      pipeLog(`action proposals:create_seed stub minted ${seed_id}`);
      return { ok: true as const, seed_id, stub: true as const };
    },
  },
  {
    name: "proposals:approve",
    context: "proposals",
    label: "Approve Proposal",
    description: "Green-light a proposal",
    inputSchema: idInput,
    outputSchema: idOutput,
    handler: async (raw, ctx) => {
      const input = idInput.parse(raw);
      emitPipeActionEvent(ctx, "proposals:approve", input);
      pipeLog(`action proposals:approve stub approved ${input.proposal_id}`);
      return {
        ok: true as const,
        proposal_id: input.proposal_id,
        stub: true as const,
      };
    },
  },
  {
    name: "proposals:redirect",
    context: "proposals",
    label: "Redirect Proposal",
    description: "Yellow-light a proposal",
    inputSchema: redirectInput,
    outputSchema: redirectOutput,
    handler: async (raw, ctx) => {
      const input = redirectInput.parse(raw);
      emitPipeActionEvent(ctx, "proposals:redirect", input);
      pipeLog(
        `action proposals:redirect stub redirected ${input.proposal_id}`,
      );
      return {
        ok: true as const,
        proposal_id: input.proposal_id,
        note: input.note,
        stub: true as const,
      };
    },
  },
  {
    name: "proposals:kill",
    context: "proposals",
    label: "Kill Proposal",
    description: "Red-light a proposal",
    inputSchema: idInput,
    outputSchema: idOutput,
    handler: async (raw, ctx) => {
      const input = idInput.parse(raw);
      emitPipeActionEvent(ctx, "proposals:kill", input);
      pipeLog(`action proposals:kill stub killed ${input.proposal_id}`);
      return {
        ok: true as const,
        proposal_id: input.proposal_id,
        stub: true as const,
      };
    },
  },
];
