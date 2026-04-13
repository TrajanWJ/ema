import { z } from "zod";

import {
  discoverAgentConfigs,
  generateBackfeed,
  getIngestionStatus,
  parseSessionTimeline,
} from "./service.js";

export interface IngestionMcpTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (input: unknown) => Promise<unknown> | unknown;
}

const agentInput = z.object({
  agent: z.string().optional(),
});

export const ingestionMcpTools: readonly IngestionMcpTool[] = [
  {
    name: "ingestion_scan",
    description: "Discover local agent configuration directories and summarise session coverage.",
    inputSchema: z.object({}),
    handler: () => ({ configs: discoverAgentConfigs(process.cwd()) }),
  },
  {
    name: "ingestion_sessions",
    description: "Parse recent agent session histories into a unified timeline.",
    inputSchema: agentInput,
    handler: (raw) => {
      const input = agentInput.parse(raw ?? {});
      return {
        timeline: parseSessionTimeline({
          ...(input.agent !== undefined ? { agent: input.agent } : {}),
          repoRoot: process.cwd(),
        }),
      };
    },
  },
  {
    name: "ingestion_backfeed",
    description: "Generate draft backfeed proposals from discovered session openings.",
    inputSchema: agentInput,
    handler: (raw) => {
      const input = agentInput.parse(raw ?? {});
      return generateBackfeed({
        ...(input.agent !== undefined ? { agent: input.agent } : {}),
        repoRoot: process.cwd(),
      });
    },
  },
  {
    name: "ingestion_status",
    description: "Read ingestion coverage status and most recent imported session.",
    inputSchema: z.object({}),
    handler: () => getIngestionStatus(process.cwd()),
  },
];

export function registerIngestionMcpTools(): readonly IngestionMcpTool[] {
  return ingestionMcpTools;
}
