import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { Habit, HabitLog } from "@/types/habits";

interface HabitsState {
  habits: readonly Habit[];
  todayLogs: readonly HabitLog[];
  streaks: Record<string, number>;
  connected: boolean;
  channel: Channel | null;
  connect: () => Promise<void>;
  addHabit: (name: string, frequency?: Habit["frequency"], target?: string | null) => Promise<void>;
  archiveHabit: (id: string) => Promise<void>;
  toggleToday: (id: string) => Promise<void>;
}

export const useHabitsStore = create<HabitsState>((set) => ({
  habits: [],
  todayLogs: [],
  streaks: {},
  connected: false,
  channel: null,

  async connect() {
    const { channel, response } = await joinChannel("habits:tracker");
    const data = response as {
      habits: Habit[];
      today_logs: HabitLog[];
      streaks: Record<string, number>;
    };
    set({
      channel,
      connected: true,
      habits: data.habits,
      todayLogs: data.today_logs,
      streaks: data.streaks,
    });

    channel.on("habit_created", (habit: Habit) => {
      set((state) => ({ habits: [...state.habits, habit] }));
    });

    channel.on("habit_toggled", (payload: { log: HabitLog; streak: number }) => {
      set((state) => {
        const existing = state.todayLogs.find((l) => l.id === payload.log.id);
        const todayLogs = existing
          ? state.todayLogs.map((l) => (l.id === payload.log.id ? payload.log : l))
          : [...state.todayLogs, payload.log];
        return {
          todayLogs,
          streaks: { ...state.streaks, [payload.log.habit_id]: payload.streak },
        };
      });
    });

    channel.on("habit_archived", (payload: { id: string }) => {
      set((state) => ({
        habits: state.habits.filter((h) => h.id !== payload.id),
      }));
    });
  },

  async addHabit(name, frequency = "daily", target = null) {
    await api.post("/habits", { name, frequency, target });
  },

  async archiveHabit(id) {
    await api.post(`/habits/${id}/archive`, {});
  },

  async toggleToday(id) {
    const result = await api.post<{ log: HabitLog; streak: number }>(`/habits/${id}/toggle`, {});
    set((state) => {
      const existing = state.todayLogs.find((l) => l.habit_id === id);
      const todayLogs = existing
        ? state.todayLogs.map((l) => (l.habit_id === id ? result.log : l))
        : [...state.todayLogs, result.log];
      return {
        todayLogs,
        streaks: { ...state.streaks, [id]: result.streak },
      };
    });
  },
}));
