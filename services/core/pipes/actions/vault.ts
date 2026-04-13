/**
 * Vault actions — contract stubs.
 * TODO(stream-4): integrate with `services/core/vault/` (SecondBrain).
 */

import { z } from "zod";
import type { ActionDef } from "../types.js";
import { emitPipeActionEvent, pipeLog } from "../voice.js";

const createSpaceInput = z.object({ project_id: z.string().min(1) });
const createSpaceOutput = z.object({
  ok: z.literal(true),
  project_id: z.string(),
  vault_path: z.string(),
  dirs_created: z.number().int(),
  stub: z.literal(true),
});

const createNoteInput = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  space: z.string().optional(),
});
const createNoteOutput = z.object({
  ok: z.literal(true),
  note_id: z.string(),
  stub: z.literal(true),
});

const searchInput = z.object({
  query_template: z.string().default("{{content}}"),
  query: z.string().optional(),
  limit: z.number().int().positive().default(10),
  space: z.string().optional(),
});
const searchOutput = z.object({
  ok: z.literal(true),
  hits: z.array(z.unknown()),
  stub: z.literal(true),
});

export const vaultActions: readonly ActionDef[] = [
  {
    name: "vault:create_project_space",
    context: "vault",
    label: "Create Project Vault Space",
    description: "Bootstrap vault directory for new project",
    inputSchema: createSpaceInput,
    outputSchema: createSpaceOutput,
    handler: async (raw, ctx) => {
      const input = createSpaceInput.parse(raw);
      emitPipeActionEvent(ctx, "vault:create_project_space", input);
      pipeLog(
        `action vault:create_project_space stub bootstrapped ${input.project_id}`,
      );
      return {
        ok: true as const,
        project_id: input.project_id,
        vault_path: `/stub/vault/projects/${input.project_id}`,
        dirs_created: 5,
        stub: true as const,
      };
    },
  },
  {
    name: "vault:create_note",
    context: "vault",
    label: "Create Vault Note",
    description: "Create a note in the vault",
    inputSchema: createNoteInput,
    outputSchema: createNoteOutput,
    handler: async (raw, ctx) => {
      const input = createNoteInput.parse(raw);
      const note_id = `note-stub-${ctx.runId.slice(-8)}`;
      emitPipeActionEvent(ctx, "vault:create_note", {
        note_id,
        title: input.title,
      });
      pipeLog(`action vault:create_note stub minted ${note_id}`);
      return { ok: true as const, note_id, stub: true as const };
    },
  },
  {
    name: "vault:search",
    context: "vault",
    label: "Search Vault",
    description: "Full-text search the second brain / vault",
    inputSchema: searchInput,
    outputSchema: searchOutput,
    handler: async (raw, ctx) => {
      const input = searchInput.parse(raw);
      emitPipeActionEvent(ctx, "vault:search", input);
      pipeLog(`action vault:search stub queried limit=${input.limit}`);
      return { ok: true as const, hits: [], stub: true as const };
    },
  },
];
