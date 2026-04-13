import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { Goal, GoalTimeframe, GoalStatus } from "@/types/goals";

interface GoalsState {
  goals: readonly Goal[];
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  createGoal: (attrs: {
    title: string;
    description?: string;
    timeframe: GoalTimeframe;
    parent_id?: string;
    project_id?: string;
  }) => Promise<void>;
  updateGoal: (id: string, attrs: Partial<{
    title: string;
    description: string;
    timeframe: GoalTimeframe;
    status: GoalStatus;
    parent_id: string | null;
    project_id: string | null;
  }>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  completeGoal: (id: string) => Promise<void>;
}

export const useGoalsStore = create<GoalsState>((set) => ({
  goals: [],
  connected: false,
  channel: null,

  async loadViaRest() {
    const data = await api.get<{ goals: Goal[] }>("/goals");
    set({ goals: data.goals });
  },

  async connect() {
    const { channel, response } = await joinChannel("goals:lobby");
    const data = response as { goals: Goal[] };
    set({
      channel,
      connected: true,
      goals: data.goals,
    });

    channel.on("goal_created", (goal: Goal) => {
      set((state) => ({ goals: [...state.goals, goal] }));
    });

    channel.on("goal_updated", (updated: Goal) => {
      set((state) => ({
        goals: state.goals.map((g) => (g.id === updated.id ? updated : g)),
      }));
    });

    channel.on("goal_deleted", (payload: { id: string }) => {
      set((state) => ({
        goals: state.goals.filter((g) => g.id !== payload.id),
      }));
    });
  },

  async createGoal(attrs) {
    const created = await api.post<Goal>("/goals", attrs);
    set((state) => ({ goals: [...state.goals, created] }));
  },

  async updateGoal(id, attrs) {
    const updated = await api.put<Goal>(`/goals/${id}`, attrs);
    set((state) => ({
      goals: state.goals.map((g) => (g.id === updated.id ? updated : g)),
    }));
  },

  async deleteGoal(id) {
    await api.delete(`/goals/${id}`);
    set((state) => ({
      goals: state.goals.filter((g) => g.id !== id),
    }));
  },

  async completeGoal(id) {
    const updated = await api.put<Goal>(`/goals/${id}`, { status: "completed" });
    set((state) => ({
      goals: state.goals.map((g) => (g.id === updated.id ? updated : g)),
    }));
  },
}));
