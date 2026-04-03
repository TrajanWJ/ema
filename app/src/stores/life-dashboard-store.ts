import { create } from "zustand";
import { api } from "@/lib/api";

interface StreakData {
  readonly id: string;
  readonly name: string;
  readonly current: number;
  readonly best: number;
  readonly color: string;
}

interface MoodPoint {
  readonly date: string;
  readonly mood: number;
  readonly energy: number;
}

interface BriefingData {
  readonly greeting_name: string;
  readonly one_thing: string | null;
  readonly inbox_count: number;
  readonly tasks_due: number;
  readonly habits_done: number;
  readonly habits_total: number;
  readonly upcoming: readonly { id: string; title: string; time: string }[];
  readonly quote: string | null;
}

interface LifeDashboardState {
  briefing: BriefingData | null;
  streaks: readonly StreakData[];
  moodHistory: readonly MoodPoint[];
  loading: boolean;
  error: string | null;
  loadBriefing: () => Promise<void>;
  loadStreaks: () => Promise<void>;
  loadMoodHistory: () => Promise<void>;
}

export const useLifeDashboardStore = create<LifeDashboardState>((set) => ({
  briefing: null,
  streaks: [],
  moodHistory: [],
  loading: false,
  error: null,

  async loadBriefing() {
    set({ loading: true, error: null });
    try {
      const briefing = await api.get<BriefingData>("/life-dashboard/briefing");
      set({ briefing, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load briefing",
      });
    }
  },

  async loadStreaks() {
    try {
      const data = await api.get<{ streaks: StreakData[] }>("/life-dashboard/streaks");
      set({ streaks: data.streaks });
    } catch (e) {
      console.warn("Failed to load streaks:", e);
    }
  },

  async loadMoodHistory() {
    try {
      const data = await api.get<{ points: MoodPoint[] }>("/life-dashboard/mood-history");
      set({ moodHistory: data.points });
    } catch (e) {
      console.warn("Failed to load mood history:", e);
    }
  },
}));
