import { create } from "zustand";
import { api } from "@/lib/api";

interface KeyResult {
  readonly id: string;
  readonly title: string;
  readonly target: number;
  readonly current: number;
  readonly unit: string;
}

interface PlannerGoal {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: "active" | "completed" | "paused" | "abandoned";
  readonly deadline: string | null;
  readonly key_results: readonly KeyResult[];
  readonly created_at: string;
}

interface CheckIn {
  readonly id: string;
  readonly goal_id: string;
  readonly note: string;
  readonly date: string;
}

interface GoalPlannerState {
  goals: readonly PlannerGoal[];
  checkIns: readonly CheckIn[];
  loading: boolean;
  error: string | null;
  loadGoals: () => Promise<void>;
  loadCheckIns: (goalId: string) => Promise<void>;
  createGoal: (attrs: {
    title: string;
    description?: string;
    deadline?: string;
    key_results?: { title: string; target: number; unit: string }[];
  }) => Promise<void>;
  updateGoal: (
    id: string,
    attrs: Partial<{ title: string; description: string; status: PlannerGoal["status"]; deadline: string }>
  ) => Promise<void>;
  updateKeyResult: (goalId: string, krId: string, current: number) => Promise<void>;
  addCheckIn: (goalId: string, note: string) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
}

export const useGoalPlannerStore = create<GoalPlannerState>((set) => ({
  goals: [],
  checkIns: [],
  loading: false,
  error: null,

  async loadGoals() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ goals: PlannerGoal[] }>("/goal-planner/goals");
      set({ goals: data.goals, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load goals",
      });
    }
  },

  async loadCheckIns(goalId) {
    try {
      const data = await api.get<{ check_ins: CheckIn[] }>(
        `/goal-planner/goals/${goalId}/check-ins`
      );
      set({ checkIns: data.check_ins });
    } catch (e) {
      console.warn("Failed to load check-ins:", e);
    }
  },

  async createGoal(attrs) {
    const created = await api.post<PlannerGoal>("/goal-planner/goals", attrs);
    set((s) => ({ goals: [...s.goals, created] }));
  },

  async updateGoal(id, attrs) {
    const updated = await api.put<PlannerGoal>(`/goal-planner/goals/${id}`, attrs);
    set((s) => ({
      goals: s.goals.map((g) => (g.id === updated.id ? updated : g)),
    }));
  },

  async updateKeyResult(goalId, krId, current) {
    const updated = await api.put<PlannerGoal>(
      `/goal-planner/goals/${goalId}/key-results/${krId}`,
      { current }
    );
    set((s) => ({
      goals: s.goals.map((g) => (g.id === updated.id ? updated : g)),
    }));
  },

  async addCheckIn(goalId, note) {
    const created = await api.post<CheckIn>(
      `/goal-planner/goals/${goalId}/check-ins`,
      { note, date: new Date().toISOString().slice(0, 10) }
    );
    set((s) => ({ checkIns: [...s.checkIns, created] }));
  },

  async deleteGoal(id) {
    await api.delete(`/goal-planner/goals/${id}`);
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
  },
}));
