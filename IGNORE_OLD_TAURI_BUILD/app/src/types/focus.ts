export interface FocusSession {
  readonly id: string;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly target_ms: number;
  readonly task_id: string | null;
  readonly summary: string | null;
  readonly blocks: readonly FocusBlock[];
  readonly created_at: string;
  readonly updated_at: string;
}

export interface FocusBlock {
  readonly id: string;
  readonly session_id: string;
  readonly block_type: "work" | "break";
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly elapsed_ms: number | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface FocusTodayStats {
  readonly sessions_count: number;
  readonly completed_count: number;
  readonly total_work_ms: number;
}

export interface FocusWeeklyStats {
  readonly sessions_count: number;
  readonly total_work_ms: number;
  readonly streak_days: number;
}

export type FocusPhase = "idle" | "focusing" | "break" | "paused";

export interface FocusTimerState {
  readonly phase: FocusPhase;
  readonly session_id: string | null;
  readonly task_id: string | null;
  readonly work_ms: number;
  readonly break_ms: number;
  readonly elapsed_ms: number;
  readonly block_elapsed_ms: number;
}

export const PRESET_DURATIONS = [
  { label: "25 min", ms: 25 * 60 * 1000 },
  { label: "45 min", ms: 45 * 60 * 1000 },
  { label: "60 min", ms: 60 * 60 * 1000 },
  { label: "90 min", ms: 90 * 60 * 1000 },
] as const;
