import { z } from "zod";

import {
  captureMachineSnapshot,
  discoverAgentConfigs,
  discoverSessionCandidates,
  generateBackfeed,
  importDiscoveredSessions,
  parseSessionTimeline,
} from "./service.js";
import { getIngestionRuntimeStatus, runIngestionBootstrap } from "./bootstrap.js";

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
    name: "ingestion_bootstrap",
    description:
      "Run the default ingestion bootstrap pass: machine snapshot, installed tool discovery, and a paged Chronicle backfill batch.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(5000).optional(),
      force: z.boolean().optional(),
    }),
    handler: (raw) => {
      const input = z.object({
        limit: z.number().int().min(1).max(5000).optional(),
        force: z.boolean().optional(),
      }).parse(raw ?? {});
      return runIngestionBootstrap({
        repoRoot: process.cwd(),
        ...(input.limit !== undefined ? { backfillLimit: input.limit } : {}),
        ...(input.force !== undefined ? { force: input.force } : {}),
      });
    },
  },
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
    name: "ingestion_discover",
    description: "List local session files that can be imported into Chronicle.",
    inputSchema: agentInput,
    handler: (raw) => {
      const input = agentInput.parse(raw ?? {});
      return {
        sessions: discoverSessionCandidates({
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
    name: "ingestion_machine_snapshot",
    description: "Capture a repeatable host-machine snapshot into Chronicle as a system source.",
    inputSchema: z.object({}),
    handler: () => captureMachineSnapshot(process.cwd()),
  },
  {
    name: "ingestion_import_discovered",
    description: "Import discovered local agent session files into Chronicle.",
    inputSchema: agentInput.extend({
      limit: z.number().int().min(1).max(5000).optional(),
      offset: z.number().int().min(0).optional(),
    }),
    handler: (raw) => {
      const input = agentInput.extend({
        limit: z.number().int().min(1).max(5000).optional(),
        offset: z.number().int().min(0).optional(),
      }).parse(raw ?? {});
      return importDiscoveredSessions({
        ...(input.agent !== undefined ? { agent: input.agent } : {}),
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.offset !== undefined ? { offset: input.offset } : {}),
        repoRoot: process.cwd(),
      });
    },
  },
  {
    name: "ingestion_status",
    description: "Read ingestion coverage status and most recent imported session.",
    inputSchema: z.object({}),
    handler: () => getIngestionRuntimeStatus(process.cwd()),
  },
];

export function registerIngestionMcpTools(): readonly IngestionMcpTool[] {
  return ingestionMcpTools;
}
