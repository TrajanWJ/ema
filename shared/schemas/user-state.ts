import { z } from "zod";
import { baseEntitySchema, idSchema, timestampSchema } from "./common.js";

/**
 * User state schema — GAC-010 resolution [D] (passive observation + optional
 * self-report). Feeds the Blueprint Planner aspiration-detection pipeline.
 * Round 1 surfaced three independent ADHD-focused repos (ADHDo,
 * neurodivergent-visual-org, Task-Anchor-MCP) that all converged on the same
 * primitive — EMA owns this because the research registry confirmed the
 * niche is empty upstream.
 *
 * Schema lands now so v2 observers and the Blueprint vApp can attach
 * without a breaking migration. Privacy default: observation disabled until
 * the user opts in. No observer code exists yet.
 *
 * Axes are normalized to the [0, 1] interval for composability across
 * observer sources (self-report, text-classifier, calendar heuristic, etc).
 */
export const userStateSchema = baseEntitySchema.extend({
  actor_id: idSchema,
  mood: z.number().min(0).max(1),
  energy: z.number().min(0).max(1),
  focus: z.number().min(0).max(1),
  distress_score: z.number().min(0).max(1),
  source: z
    .enum(["self_report", "passive_observation", "heuristic"])
    .default("self_report"),
  last_assessed: timestampSchema,
});
export type UserState = z.infer<typeof userStateSchema>;

/**
 * ---------------------------------------------------------------------------
 * UserState service (GAC-010 implementation surface)
 * ---------------------------------------------------------------------------
 *
 * The `userStateSchema` above remains the canonical graph entity that feeds
 * Blueprint Planner long-term storage. The schemas below are the *runtime*
 * shapes used by the `services/core/user-state` service — a singleton
 * snapshot of the operator, mutated by self-report and agent heuristics.
 *
 * Why separate: the graph entity is keyed to an actor, persistable, and
 * goes through the Object Index. The runtime snapshot is a single row
 * ("there is one operator") with mode/drift/distress fields the three ADHD
 * research repos converge on. Converting between the two is the service's
 * responsibility; the schemas stay decoupled so observers can ship v2
 * without renegotiating the graph shape.
 *
 * All additions are new exports — existing `userStateSchema`/`UserState`
 * are preserved verbatim.
 */

/** Observable high-level mode the operator is in. */
export const userStateModeSchema = z.enum([
  "focused",
  "scattered",
  "resting",
  "crisis",
  "unknown",
]);
export type UserStateMode = z.infer<typeof userStateModeSchema>;

/** Who/what produced the most recent state mutation. */
export const userStateUpdatedBySchema = z.enum(["self", "agent", "heuristic"]);
export type UserStateUpdatedBy = z.infer<typeof userStateUpdatedBySchema>;

/**
 * Runtime singleton snapshot of the operator. This is what `GET /current`
 * returns. Optional numeric axes stay unset until the user self-reports or a
 * heuristic produces a score — unset is distinct from 0.
 */
export const userStateSnapshotSchema = z.object({
  mode: userStateModeSchema,
  focus_score: z.number().min(0).max(1).optional(),
  energy_score: z.number().min(0).max(1).optional(),
  distress_flag: z.boolean(),
  drift_score: z.number().min(0).max(1).optional(),
  current_intent_slug: z.string().min(1).nullable(),
  updated_at: timestampSchema,
  updated_by: userStateUpdatedBySchema,
});
export type UserStateSnapshot = z.infer<typeof userStateSnapshotSchema>;

/**
 * Signal kinds the service aggregates. Binary "something happened" events
 * rather than continuous measurements — the heuristic layer turns streams
 * of these into mode/distress_flag transitions.
 */
export const userStateSignalKindSchema = z.enum([
  "agent_blocked",
  "agent_recovered",
  "self_report_overwhelm",
  "self_report_flow",
  "drift_detected",
  "idle_timeout",
  "task_completed",
]);
export type UserStateSignalKind = z.infer<typeof userStateSignalKindSchema>;

export const userStateSignalSchema = z.object({
  kind: userStateSignalKindSchema,
  source: z.string().min(1),
  at: timestampSchema.optional(),
  note: z.string().optional(),
  intent_slug: z.string().min(1).optional(),
});
export type UserStateSignal = z.infer<typeof userStateSignalSchema>;
