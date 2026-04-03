import { create } from "zustand";
import { api } from "@/lib/api";
import type { Execution } from "@/types/executions";

interface DashboardToday {
  readonly greeting_name: string;
  readonly one_thing: string | null;
  readonly inbox_count: number;
  readonly tasks_due: number;
  readonly upcoming: readonly { id: string; title: string; time: string }[];
  readonly quote: string | null;
}

interface DashboardHabit {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly completed: boolean;
  readonly streak: number;
}

interface DashboardJournal {
  readonly id: string;
  readonly date: string;
  readonly one_thing: string | null;
  readonly mood: number | null;
  readonly content: string | null;
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
  dashboardHabits: readonly DashboardHabit[];
  dashboardJournal: DashboardJournal | null;
  executions: readonly Execution[];
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
  toggleHabit: (id: string) => Promise<void>;
  approveExecution: (id: string) => Promise<void>;
}

export type {
  DashboardToday,
  DashboardHabit,
  DashboardJournal,
  HabitLog,
  JournalToday,
  FocusToday,
  TaskSummary,
};

export const useLifeDashboardStore = create<LifeDashboardState>((set, get) => ({
  dashboard: null,
  briefing: null,
  habits: [],
  dashboardHabits: [],
  dashboardJournal: null,
  executions: [],
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
      const [dashboardRes, habitsRes, journal, focus, tasksRes, execRes] =
        await Promise.all([
          api.get<{
            date: string;
            inbox_count: number;
            recent_inbox: unknown[];
            habits: DashboardHabit[];
            journal: DashboardJournal;
          }>("/dashboard/today"),
          api.get<{ logs: HabitLog[] }>("/habits/today"),
          api
            .get<JournalToday>(
              `/journal/${new Date().toISOString().slice(0, 10)}`,
            )
            .catch(() => null),
          api.get<FocusToday>("/focus/today").catch(() => null),
          api.get<{ tasks: TaskSummary[] }>("/tasks").catch(() => ({ tasks: [] })),
          api.get<{ executions: Execution[] }>("/executions").catch(() => ({ executions: [] })),
        ]);

      const logs = habitsRes.logs ?? [];
      const dashboard: DashboardToday = {
        greeting_name: "Trajan",
        one_thing: dashboardRes.journal?.one_thing ?? null,
        inbox_count: dashboardRes.inbox_count,
        tasks_due: (tasksRes.tasks ?? []).filter((t) => t.status === "in_progress" || t.status === "todo").length,
        upcoming: [],
        quote: null,
      };
      const briefing: Briefing = {
        ...dashboard,
        habits_done: (dashboardRes.habits ?? []).filter((h) => h.completed).length,
        habits_total: (dashboardRes.habits ?? []).length,
      };

      set({
        dashboard,
        briefing,
        habits: logs,
        dashboardHabits: dashboardRes.habits ?? [],
        dashboardJournal: dashboardRes.journal ?? null,
        executions: execRes.executions ?? [],
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
    await useLifeDashboardStore.getState().loadViaRest();
  },

  async loadStreaks(): Promise<void> {
    // Streaks are derived from habits in loadViaRest
  },

  async loadMoodHistory(): Promise<void> {
    try {
      const entries = await api.get<{ entries: MoodPoint[] }>("/journal").catch(() => ({ entries: [] }));
      set({ moodHistory: (entries.entries ?? []).slice(-7) });
    } catch {
      // Non-critical
    }
  },

  async toggleHabit(id) {
    await api.post(`/habits/${id}/toggle`, {});
    await get().loadViaRest();
  },

  async approveExecution(id) {
    await api.post(`/executions/${id}/approve`, {});
    await get().loadViaRest();
  },
}));
