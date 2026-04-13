/**
 * Proposal triggers — ported from `Ema.Pipes.Registry` stock_triggers/0.
 *
 * Mirrors the proposal pipeline seed→generated→refined→debated→queued and
 * the user verdict transitions approved/redirected/killed/decomposed.
 */

import { z } from "zod";
import type { TriggerDef } from "../types.js";

const proposalSchema = z
  .object({
    proposal_id: z.string().optional(),
    seed_id: z.string().optional(),
    project_id: z.string().optional(),
  })
  .passthrough();

export const proposalTriggers: readonly TriggerDef[] = [
  {
    name: "proposals:seed_fired",
    context: "proposals",
    eventType: "seed_fired",
    label: "Seed Fired",
    description: "A seed was triggered",
    payloadSchema: proposalSchema,
  },
  {
    name: "proposals:generated",
    context: "proposals",
    eventType: "generated",
    label: "Proposal Generated",
    description: "Raw proposal created by generator",
    payloadSchema: proposalSchema,
  },
  {
    name: "proposals:refined",
    context: "proposals",
    eventType: "refined",
    label: "Proposal Refined",
    description: "Proposal passed through refiner",
    payloadSchema: proposalSchema,
  },
  {
    name: "proposals:debated",
    context: "proposals",
    eventType: "debated",
    label: "Proposal Debated",
    description: "Proposal passed through debater",
    payloadSchema: proposalSchema,
  },
  {
    name: "proposals:queued",
    context: "proposals",
    eventType: "queued",
    label: "Proposal Queued",
    description: "Proposal arrived in queue",
    payloadSchema: proposalSchema,
  },
  {
    name: "proposals:approved",
    context: "proposals",
    eventType: "approved",
    label: "Proposal Approved",
    description: "User green-lit a proposal",
    payloadSchema: proposalSchema,
  },
  {
    name: "proposals:redirected",
    context: "proposals",
    eventType: "redirected",
    label: "Proposal Redirected",
    description: "User yellow-lit a proposal",
    payloadSchema: proposalSchema,
  },
  {
    name: "proposals:killed",
    context: "proposals",
    eventType: "killed",
    label: "Proposal Killed",
    description: "User red-lit a proposal",
    payloadSchema: proposalSchema,
  },
  {
    name: "proposals:decomposed",
    context: "proposals",
    eventType: "decomposed",
    label: "Proposal Decomposed",
    description: "Approved proposal broken into tasks with dependencies",
    payloadSchema: proposalSchema,
  },
];
