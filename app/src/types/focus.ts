export interface FocusSession {
  readonly id: string;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly target_ms: number;
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

export const PRESET_DURATIONS = [
  { label: "25 min", ms: 25 * 60 * 1000 },
  { label: "45 min", ms: 45 * 60 * 1000 },
  { label: "60 min", ms: 60 * 60 * 1000 },
  { label: "90 min", ms: 90 * 60 * 1000 },
] as const;
