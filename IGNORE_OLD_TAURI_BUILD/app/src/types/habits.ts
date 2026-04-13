export interface Habit {
  readonly id: string;
  readonly name: string;
  readonly frequency: "daily" | "weekly";
  readonly target: string | null;
  readonly active: boolean;
  readonly sort_order: number;
  readonly color: string;
  readonly created_at: string;
}

export interface HabitLog {
  readonly id: string;
  readonly habit_id: string;
  readonly date: string;
  readonly completed: boolean;
  readonly notes: string | null;
}

export const HABIT_COLORS = [
  "#5b9cf5", "#38c97a", "#e8a84c", "#ef6b6b", "#a78bfa", "#f472b6", "#34d399",
] as const;
