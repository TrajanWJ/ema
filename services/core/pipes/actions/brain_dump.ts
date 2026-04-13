/**
 * Brain Dump actions.
 *
 * v1 is a contract-only stub — the real BrainDump service integration lands
 * in Stream 4+. The handler validates input, emits a visibility event, logs
 * with EMA-VOICE, and returns a typed ack.
 */

import { z } from "zod";
import type { ActionDef } from "../types.js";
import { emitPipeActionEvent, pipeLog } from "../voice.js";

const createItemInput = z.object({
  content: z.string().min(1),
  source: z.string().default("pipe"),
});

const createItemOutput = z.object({
  ok: z.literal(true),
  content: z.string(),
  source: z.string(),
  stub: z.literal(true),
});

export const brainDumpActions: readonly ActionDef[] = [
  {
    name: "brain_dump:create_item",
    context: "brain_dump",
    label: "Create Brain Dump Item",
    description: "Add a capture",
    inputSchema: createItemInput,
    outputSchema: createItemOutput,
    // TODO(stream-4): integrate with BrainDump service (`services/core/brain-dump/`).
    handler: async (raw, ctx) => {
      const input = createItemInput.parse(raw);
      emitPipeActionEvent(ctx, "brain_dump:create_item", input);
      pipeLog(
        `action brain_dump:create_item stub captured ${input.content.length} chars`,
      );
      return {
        ok: true as const,
        content: input.content,
        source: input.source,
        stub: true as const,
      };
    },
  },
];
