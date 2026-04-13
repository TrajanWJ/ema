import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { Goal, GoalContext, GoalTimeframe, GoalStatus, GoalOwnerKind } from "@/types/goals";

interface GoalsState {
  goals: readonly Goal[];
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  getContext: (id: string) => Promise<GoalContext>;
  connect: () => Promise<void>;
  createGoal: (attrs: {
    title: string;
    description?: string;
    timeframe: GoalTimeframe;
    owner_kind?: GoalOwnerKind;
    owner_id?: string;
    parent_id?: string;
    project_id?: string;
    space_id?: string;
    intent_slug?: string;
    target_date?: string;
    success_criteria?: string;
  }) => Promise<void>;
  updateGoal: (id: string, attrs: Partial<{
    title: string;
    description: string;
    timeframe: GoalTimeframe;
    status: GoalStatus;
    owner_kind: GoalOwnerKind;
    owner_id: string;
    parent_id: string | null;
    project_id: string | null;
    space_id: string | null;
    intent_slug: string | null;
    target_date: string | null;
    success_criteria: string | null;
  }>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  completeGoal: (id: string) => Promise<void>;
  proposeGoal: (id: string) => Promise<{ proposal: { id: string } }>;
  buildoutGoal: (id: string, attrs: {
    start_at: string;
    owner_id?: string;
    plan_minutes?: number;
    execute_minutes?: number;
    review_minutes?: number;
    retro_minutes?: number;
  }) => Promise<{ buildout_id: string }>;
  executeGoal: (id: string, attrs?: {
    buildout_id?: string;
    proposal_id?: string;
    title?: string;
    objective?: string;
    mode?: string;
  }) => Promise<{ execution: { id: string } }>;
}

export const useGoalsStore = create<GoalsState>((set) => ({
  goals: [],
  connected: false,
  channel: null,

  async loadViaRest() {
    const data = await api.get<{ goals: Goal[] }>("/goals");
    set({ goals: data.goals });
  },

  async getContext(id) {
    return api.get<GoalContext>(`/goals/${id}/context`);
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

  async proposeGoal(id) {
    return api.post<{ proposal: { id: string } }>(`/goals/${id}/proposals`, {});
  },

  async buildoutGoal(id, attrs) {
    return api.post<{ buildout_id: string }>(`/goals/${id}/buildouts`, attrs);
  },

  async executeGoal(id, attrs = {}) {
    return api.post<{ execution: { id: string } }>(`/goals/${id}/executions`, attrs);
  },
}));
