import { z } from "zod";

/**
 * Actor work lifecycle phases.
 *
 * Canonical source: `ema-genesis/canon/decisions/DEC-005-actor-phases.md`.
 * Ported verbatim from the old Elixir `Ema.Actors.Actor` module
 * (`@phases ~w(idle plan execute review retro)`).
 *
 * Orthogonal to the agent runtime-state axis defined by
 * `ema-genesis/intents/GAC-003/README.md` — runtime state describes whether
 * the Claude subprocess is alive; actor phase describes what kind of work
 * it is doing. Both must be observable simultaneously.
 *
 * Phase transitions are append-only. Actors may skip phases forward
 * (e.g. `idle → execute`) but may not rewind. A "back to plan" is a NEW
 * transition, not an undo. The `phase_transitions` table is the durable log.
 */
export const actorPhaseSchema = z.enum([
  "idle",
  "plan",
  "execute",
  "review",
  "retro",
]);
export type ActorPhase = z.infer<typeof actorPhaseSchema>;

/**
 * Agent runtime process-state (GAC-003 resolution [D]).
 *
 * Classified by the heartbeat poller from observed terminal output.
 * Orthogonal to `actorPhaseSchema`.
 */
export const agentRuntimeStateSchema = z.enum([
  "working",
  "idle",
  "blocked",
  "error",
  "context-full",
  "paused",
  "crashed",
]);
export type AgentRuntimeState = z.infer<typeof agentRuntimeStateSchema>;

/**
 * A single row in the append-only `phase_transitions` table.
 *
 * `from_phase` is null for the initial transition into `idle`, which is
 * how an actor first enters the log.
 */
export const phaseTransitionSchema = z.object({
  id: z.string(),
  actor_id: z.string(),
  from_phase: actorPhaseSchema.nullable(),
  to_phase: actorPhaseSchema,
  reason: z.string(),
  summary: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  transitioned_at: z.string().datetime(),
});
export type PhaseTransition = z.infer<typeof phaseTransitionSchema>;

/**
 * Raw SQL DDL for the `phase_transitions` table. Services that own a
 * SQLite/Drizzle connection mount this during migration bootstrap.
 *
 * Kept as raw DDL (not a Drizzle `sqliteTable` call) so `@ema/shared` stays
 * free of a Drizzle dependency — consumers import this string and execute it
 * through their own driver.
 */
export const PHASE_TRANSITION_DDL = `
CREATE TABLE IF NOT EXISTS phase_transitions (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  from_phase TEXT,
  to_phase TEXT NOT NULL,
  reason TEXT NOT NULL,
  summary TEXT,
  metadata TEXT,
  transitioned_at TEXT NOT NULL,
  CHECK (to_phase IN ('idle','plan','execute','review','retro'))
);
CREATE INDEX IF NOT EXISTS idx_phase_transitions_actor ON phase_transitions(actor_id, transitioned_at);
`;

/**
 * Allowed forward transitions, for documentation and eventual runtime
 * enforcement in `services/core/actors/`. DEC-005 permits skipping phases
 * forward but forbids rewinding as an undo — going "back" to an earlier
 * phase is itself a new forward transition recorded in the log.
 */
export const PHASE_TRANSITIONS: Record<ActorPhase, readonly ActorPhase[]> = {
  idle: ["plan", "execute"],
  plan: ["execute", "review", "retro", "idle"],
  execute: ["review", "retro", "idle", "plan"],
  review: ["retro", "execute", "plan", "idle"],
  retro: ["idle", "plan"],
} as const;
