/**
 * MCP tool registrations for the UserState subservice.
 *
 * Mirrors `services/core/blueprint/mcp-tools.ts`: exports a tool array and a
 * placeholder `register*McpTools` hook. When the host MCP registry lands, the
 * placeholder is swapped for a real registration call and consumers don't
 * have to change imports.
 *
 * Tools:
 *   - user_state_current  — read the singleton snapshot
 *   - user_state_update   — self/agent mutation
 *   - user_state_signal   — submit a heuristic signal
 *   - user_state_history  — ring-buffer read
 */

import { z } from "zod";

import {
  userStateModeSchema,
  userStateSignalSchema,
  userStateUpdatedBySchema,
} from "@ema/shared/schemas";

import {
  getCurrentUserState,
  getUserStateHistory,
  recordSignal,
  updateUserState,
} from "./service.js";

export interface UserStateMcpTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (input: unknown) => Promise<unknown> | unknown;
}

const currentInput = z.object({}).optional();

const updateInput = z.object({
  mode: userStateModeSchema.optional(),
  focus_score: z.number().min(0).max(1).optional(),
  energy_score: z.number().min(0).max(1).optional(),
  distress_flag: z.boolean().optional(),
  drift_score: z.number().min(0).max(1).optional(),
  current_intent_slug: z.string().min(1).nullable().optional(),
  updated_by: userStateUpdatedBySchema.default("agent"),
  reason: z.string().optional(),
});

const historyInput = z.object({
  limit: z.number().int().positive().max(500).optional(),
});

export const userStateMcpTools: readonly UserStateMcpTool[] = [
  {
    name: "user_state_current",
    description:
      "Read the operator's current state snapshot (mode, distress_flag, focus/energy/drift scores, current_intent_slug).",
    inputSchema: currentInput,
    handler: () => ({ state: getCurrentUserState() }),
  },
  {
    name: "user_state_update",
    description:
      "Update the operator's state. Use when the user self-reports or an agent has direct evidence (e.g. 'user said they're overwhelmed'). Prefer user_state_signal for passive observations.",
    inputSchema: updateInput,
    handler: (raw) => {
      const input = updateInput.parse(raw);
      const state = updateUserState(input);
      return { state };
    },
  },
  {
    name: "user_state_signal",
    description:
      "Submit a heuristic signal (e.g. agent_blocked, drift_detected, self_report_overwhelm). The service aggregates signals into mode/distress_flag transitions.",
    inputSchema: userStateSignalSchema,
    handler: (raw) => {
      const input = userStateSignalSchema.parse(raw);
      const state = recordSignal(input);
      return { state };
    },
  },
  {
    name: "user_state_history",
    description:
      "Read the ring buffer of recent state mutations for debugging, research, or ADHD pattern analysis. Newest first.",
    inputSchema: historyInput,
    handler: (raw) => {
      const input = historyInput.parse(raw ?? {});
      const entries = getUserStateHistory(
        input.limit !== undefined ? { limit: input.limit } : {},
      );
      return { entries };
    },
  },
];

/**
 * Placeholder registration hook. When the host MCP registry lands, this
 * function will call into it. For now it returns the tool array so callers
 * can wire it up manually.
 */
export function registerUserStateMcpTools(): readonly UserStateMcpTool[] {
  return userStateMcpTools;
}
