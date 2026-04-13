export interface Rhythm {
  readonly id: string;
  readonly day_of_week: number;
  readonly hour: number;
  readonly energy_level: number;
  readonly focus_quality: number;
  readonly preferred_task_types: readonly string[];
  readonly sample_count: number;
  readonly updated_at: string;
}

export interface EnergyLog {
  readonly id: string;
  readonly energy_level: number;
  readonly focus_quality: number | null;
  readonly activity_type: string | null;
  readonly source: string;
  readonly logged_at: string;
  readonly created_at: string;
}

export interface TemporalContext {
  readonly time_of_day: string;
  readonly day_of_week: number;
  readonly hour: number;
  readonly estimated_energy: number;
  readonly estimated_focus: number;
  readonly preferred_task_types: readonly string[];
  readonly suggested_mode: string;
  readonly confidence: number;
  readonly timestamp?: string;
}

export interface TimeSlot {
  readonly day_of_week: number;
  readonly day_name: string;
  readonly hour: number;
  readonly energy: number;
  readonly focus: number;
  readonly label: string;
}

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const MODE_LABELS: Record<string, string> = {
  deep_work: "Deep Work",
  shallow_work: "Shallow Work",
  creative: "Creative",
  admin: "Admin",
  rest: "Rest",
  social: "Social",
  meetings: "Meetings",
} as const;

export const MODE_COLORS: Record<string, string> = {
  deep_work: "#6b95f0",
  shallow_work: "#2dd4a8",
  creative: "#f59e0b",
  admin: "#a78bfa",
  rest: "#34d399",
  social: "#f472b6",
  meetings: "#ef6b6b",
} as const;
