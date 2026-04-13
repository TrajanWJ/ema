import { z } from "zod";

export const ingestionAgentConfigSchema = z.object({
  agent: z.string(),
  path: z.string(),
  sessions: z.number().int().nonnegative(),
  projects: z.array(z.string()),
  first_activity: z.string().nullable(),
  last_activity: z.string().nullable(),
});

export const ingestionTimelineEntrySchema = z.object({
  timestamp: z.string().nullable(),
  agent: z.string(),
  session_path: z.string(),
  project: z.string().nullable(),
  message_count: z.number().int().nonnegative(),
  opening_prompt: z.string(),
});

export const ingestionBackfeedProposalSchema = z.object({
  title: z.string(),
  summary: z.string(),
  source_session: z.string(),
  source: z.literal("agent_session_import"),
});

export type IngestionAgentConfig = z.infer<typeof ingestionAgentConfigSchema>;
export type IngestionTimelineEntry = z.infer<typeof ingestionTimelineEntrySchema>;
export type IngestionBackfeedProposal = z.infer<typeof ingestionBackfeedProposalSchema>;
