import { create } from "zustand";
import { api } from "@/lib/api";

export interface RoutineStep {
  readonly title: string;
  readonly action: string;
  readonly duration_min: number;
  readonly type: string;
  readonly app_link: string | null;
}

export type RoutineType = "morning" | "evening" | "work" | "custom";

export interface Routine {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly type: RoutineType;
  readonly enabled: boolean;
  readonly steps: readonly RoutineStep[];
  readonly cadence: "daily" | "weekly";
  readonly active: boolean;
  readonly last_run_at: string | null;
  readonly inserted_at: string;
}

interface RoutineState {
  routines: readonly Routine[];
  loading: boolean;
  error: string | null;
  loadViaRest: () => Promise<void>;
  createRoutine: (attrs: {
    name: string;
    description?: string;
    type?: RoutineType;
    cadence?: "daily" | "weekly";
    steps: { action: string; duration_min: number; app_link?: string | null }[];
  }) => Promise<void>;
  updateRoutine: (
    id: string,
    attrs: Partial<Omit<Routine, "id" | "inserted_at">>,
  ) => Promise<void>;
  deleteRoutine: (id: string) => Promise<void>;
  toggleRoutine: (id: string) => Promise<void>;
  runRoutine: (id: string) => Promise<void>;
}

export const useRoutineStore = create<RoutineState>((set) => ({
  routines: [],
  loading: false,
  error: null,

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ routines: Routine[] }>("/routines");
      set({ routines: data.routines, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async createRoutine(attrs) {
    await api.post<{ routine: Routine }>("/routines", { routine: attrs });
    await useRoutineStore.getState().loadViaRest();
  },

  async updateRoutine(id, attrs) {
    await api.put<{ routine: Routine }>(`/routines/${id}`, {
      routine: attrs,
    });
    await useRoutineStore.getState().loadViaRest();
  },

  async deleteRoutine(id) {
    await api.delete(`/routines/${id}`);
    set((s) => ({
      routines: s.routines.filter((r) => r.id !== id),
    }));
  },

  async toggleRoutine(id) {
    await api.post(`/routines/${id}/toggle`, {});
    set((s) => ({
      routines: s.routines.map((r) =>
        r.id === id ? { ...r, active: !r.active } : r,
      ),
    }));
  },

  async runRoutine(id) {
    await api.post(`/routines/${id}/run`, {});
    await useRoutineStore.getState().loadViaRest();
  },
}));
