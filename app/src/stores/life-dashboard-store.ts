import { create } from "zustand";
import { api } from "@/lib/api";

interface DashboardToday {
  readonly greeting_name: string;
  readonly one_thing: string | null;
  readonly inbox_count: number;
  readonly tasks_due: number;
  readonly upcoming: readonly { id: string; title: string; time: string }[];
  readonly quote: string | null;
}

interface HabitLog {
  readonly habit_id: string;
  readonly name: string;
  readonly done: boolean;
  readonly streak: number;
}

interface JournalToday {
  readonly date: string;
  readonly body: string | null;
  readonly mood: number | null;
  readonly energy: number | null;
}

interface FocusToday {
  readonly total_minutes: number;
  readonly sessions_count: number;
  readonly current_session: Record<string, unknown> | null;
}

interface TaskSummary {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly priority: string | null;
}

interface Streak {
  readonly id: string;
  readonly name: string;
  readonly current: number;
  readonly best: number;
  readonly color?: string;
}

interface MoodPoint {
  readonly date: string;
  readonly mood: number;
  readonly energy: number;
}

interface Briefing extends DashboardToday {
  readonly habits_done: number;
  readonly habits_total: number;
}

interface LifeDashboardState {
  dashboard: DashboardToday | null;
  briefing: Briefing | null;
  habits: readonly HabitLog[];
  streaks: readonly Streak[];
  moodHistory: readonly MoodPoint[];
  journal: JournalToday | null;
  focus: FocusToday | null;
  todayTasks: readonly TaskSummary[];
  loading: boolean;
  error: string | null;
  loadViaRest: () => Promise<void>;
  loadBriefing: () => Promise<void>;
  loadStreaks: () => Promise<void>;
  loadMoodHistory: () => Promise<void>;
}

export type {
  DashboardToday,
  HabitLog,
  JournalToday,
  FocusToday,
  TaskSummary,
};

export const useLifeDashboardStore = create<LifeDashboardState>((set) => ({
  dashboard: null,
  briefing: null,
  habits: [],
  streaks: [],
  moodHistory: [],
  journal: null,
  focus: null,
  todayTasks: [],
  loading: false,
  error: null,

  async loadViaRest(): Promise<void> {
    set({ loading: true, error: null });
    try {
      const [dashboard, habitsRes, journal, focus, tasksRes] =
        await Promise.all([
          api.get<DashboardToday>("/dashboard/today"),
          api.get<{ logs: HabitLog[] }>("/habits/today"),
          api
            .get<JournalToday>(
              `/journal/${new Date().toISOString().slice(0, 10)}`,
            )
            .catch(() => null),
          api.get<FocusToday>("/focus/today"),
          api.get<{ tasks: TaskSummary[] }>("/tasks"),
        ]);

      const logs = habitsRes.logs ?? [];
      const briefing: Briefing = {
        ...dashboard,
        habits_done: logs.filter((h) => h.done).length,
        habits_total: logs.length,
      };

      set({
        dashboard,
        briefing,
        habits: logs,
        streaks: logs
          .filter((h) => h.streak > 0)
          .map((h) => ({ id: h.habit_id, name: h.name, current: h.streak, best: h.streak })),
        journal,
        focus,
        todayTasks: tasksRes.tasks ?? [],
        loading: false,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async loadBriefing(): Promise<void> {
    // Delegates to loadViaRest which populates briefing
    await useLifeDashboardStore.getState().loadViaRest();
  },

  async loadStreaks(): Promise<void> {
    // Streaks are derived from habits in loadViaRest — no-op if already loaded
  },

  async loadMoodHistory(): Promise<void> {
    try {
      const entries = await api.get<{ entries: MoodPoint[] }>("/journal").catch(() => ({ entries: [] }));
      set({ moodHistory: (entries.entries ?? []).slice(-7) });
    } catch {
      // Non-critical — mood history is optional
    }
  },
}));
