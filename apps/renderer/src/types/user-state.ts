export type UserStateMode =
  | "focused"
  | "scattered"
  | "resting"
  | "crisis"
  | "unknown";

export type UserStateUpdatedBy = "self" | "agent" | "heuristic";

export interface UserStateSnapshot {
  readonly mode: UserStateMode;
  readonly focus_score?: number;
  readonly energy_score?: number;
  readonly distress_flag: boolean;
  readonly drift_score?: number;
  readonly current_intent_slug: string | null;
  readonly updated_at: string;
  readonly updated_by: UserStateUpdatedBy;
}

export interface UserStateHistoryEntry extends UserStateSnapshot {
  readonly reason: string;
}

export type UserStateSignalKind =
  | "agent_blocked"
  | "agent_recovered"
  | "self_report_overwhelm"
  | "self_report_flow"
  | "drift_detected"
  | "idle_timeout"
  | "task_completed";
