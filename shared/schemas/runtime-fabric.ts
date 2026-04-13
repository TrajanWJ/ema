import { z } from "zod";

import { agentRuntimeStateSchema } from "./actor-phase.js";

export const runtimeToolKindSchema = z.enum([
  "shell",
  "claude",
  "codex",
  "gemini",
  "aider",
  "cursor",
  "unknown",
]);

export const runtimeToolAuthStateSchema = z.enum([
  "configured",
  "detected",
  "unknown",
]);

export const runtimeToolSourceSchema = z.enum([
  "builtin",
  "path",
]);

export const runtimeSessionSourceSchema = z.enum([
  "managed",
  "external",
]);

export const runtimeSessionStatusSchema = z.enum([
  "detected",
  "starting",
  "running",
  "idle",
  "stopped",
  "failed",
]);

export const runtimeInputModeSchema = z.enum([
  "paste",
  "type",
  "key",
]);

export const runtimeSessionEventKindSchema = z.enum([
  "session_started",
  "prompt_dispatched",
  "input_sent",
  "key_sent",
  "state_changed",
  "session_stopped",
]);

export const runtimeToolSchema = z.object({
  id: z.string().min(1),
  kind: runtimeToolKindSchema,
  name: z.string().min(1),
  binary_path: z.string().min(1).nullable(),
  version: z.string().nullable(),
  config_dir: z.string().nullable(),
  auth_state: runtimeToolAuthStateSchema,
  available: z.boolean(),
  launch_command: z.string().min(1),
  source: runtimeToolSourceSchema,
  detected_at: z.string().datetime(),
});

export const runtimeSessionSchema = z.object({
  id: z.string().min(1),
  session_name: z.string().min(1),
  source: runtimeSessionSourceSchema,
  tool_kind: runtimeToolKindSchema,
  tool_name: z.string().min(1),
  status: runtimeSessionStatusSchema,
  runtime_state: agentRuntimeStateSchema.nullable(),
  cwd: z.string().nullable(),
  command: z.string().min(1),
  pane_id: z.string().nullable(),
  pid: z.number().int().nullable(),
  started_at: z.string().datetime(),
  last_seen_at: z.string().datetime(),
  last_output_at: z.string().datetime().nullable(),
  last_transition_at: z.string().datetime().nullable(),
  tail_preview: z.string().nullable(),
  summary: z.string().nullable(),
});

export const runtimeSessionScreenSchema = z.object({
  session_id: z.string().min(1),
  session_name: z.string().min(1),
  pane_id: z.string().nullable(),
  captured_at: z.string().datetime(),
  line_count: z.number().int().nonnegative(),
  tail: z.string(),
});

export const runtimeSessionEventSchema = z.object({
  id: z.string().min(1),
  session_id: z.string().min(1),
  event_kind: runtimeSessionEventKindSchema,
  summary: z.string().min(1),
  payload_json: z.string().nullable(),
  inserted_at: z.string().datetime(),
});

export type RuntimeToolKind = z.infer<typeof runtimeToolKindSchema>;
export type RuntimeToolAuthState = z.infer<typeof runtimeToolAuthStateSchema>;
export type RuntimeToolSource = z.infer<typeof runtimeToolSourceSchema>;
export type RuntimeSessionSource = z.infer<typeof runtimeSessionSourceSchema>;
export type RuntimeSessionStatus = z.infer<typeof runtimeSessionStatusSchema>;
export type RuntimeInputMode = z.infer<typeof runtimeInputModeSchema>;
export type RuntimeSessionEventKind = z.infer<typeof runtimeSessionEventKindSchema>;
export type RuntimeTool = z.infer<typeof runtimeToolSchema>;
export type RuntimeSession = z.infer<typeof runtimeSessionSchema>;
export type RuntimeSessionScreen = z.infer<typeof runtimeSessionScreenSchema>;
export type RuntimeSessionEvent = z.infer<typeof runtimeSessionEventSchema>;
