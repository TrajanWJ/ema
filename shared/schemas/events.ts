import { z } from "zod";

import { timestampSchema } from "./common.js";

export const emaEventTypeSchema = z.enum([
  "intent.created",
  "intent.status_updated",
  "intent.indexed",
  "proposal.generated",
  "proposal.approved",
  "proposal.rejected",
  "proposal.revised",
  "execution.started",
  "execution.artifact_recorded",
  "execution.completed",
  "execution.failed",
  "loop.completed",
]);

export const emaEventSchema = z.object({
  id: z.string().min(1),
  type: emaEventTypeSchema,
  entity_id: z.string().min(1),
  entity_type: z.enum(["intent", "proposal", "execution", "artifact", "loop"]),
  occurred_at: timestampSchema,
  payload: z.record(z.unknown()),
});

export type LoopEventType = z.infer<typeof emaEventTypeSchema>;
export type LoopEvent = z.infer<typeof emaEventSchema>;

function mintId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEventFixture(overrides: Partial<LoopEvent> = {}): LoopEvent {
  return emaEventSchema.parse({
    id: overrides.id ?? mintId("event"),
    type: overrides.type ?? "intent.created",
    entity_id: overrides.entity_id ?? "intent_fixture",
    entity_type: overrides.entity_type ?? "intent",
    occurred_at: overrides.occurred_at ?? new Date().toISOString(),
    payload: overrides.payload ?? { source: "fixture" },
  });
}

export const eventExamples = [
  createEventFixture(),
  createEventFixture({
    type: "loop.completed",
    entity_id: "execution_fixture",
    entity_type: "loop",
    payload: { intent_id: "intent_fixture", proposal_id: "proposal_fixture" },
  }),
];
