import { create } from "zustand";
import { api } from "@/lib/api";

interface RoutineStep {
  readonly action: string;
  readonly duration_min: number;
  readonly app_link: string | null;
}

interface Routine {
  readonly id: string;
  readonly name: string;
  readonly type: "morning" | "evening" | "work" | "custom";
  readonly steps: readonly RoutineStep[];
  readonly enabled: boolean;
  readonly created_at: string;
}

interface RoutineState {
  routines: readonly Routine[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  loadRoutines: () => Promise<void>;
  selectRoutine: (id: string | null) => void;
  createRoutine: (attrs: {
    name: string;
    type: Routine["type"];
    steps: RoutineStep[];
  }) => Promise<void>;
  updateRoutine: (
    id: string,
    attrs: Partial<{ name: string; type: Routine["type"]; steps: RoutineStep[]; enabled: boolean }>
  ) => Promise<void>;
  deleteRoutine: (id: string) => Promise<void>;
}

export const useRoutineStore = create<RoutineState>((set) => ({
  routines: [],
  selectedId: null,
  loading: false,
  error: null,

  async loadRoutines() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ routines: Routine[] }>("/routines");
      set({ routines: data.routines, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load routines",
      });
    }
  },

  selectRoutine(id) {
    set({ selectedId: id });
  },

  async createRoutine(attrs) {
    const created = await api.post<Routine>("/routines", attrs);
    set((s) => ({ routines: [...s.routines, created], selectedId: created.id }));
  },

  async updateRoutine(id, attrs) {
    const updated = await api.put<Routine>(`/routines/${id}`, attrs);
    set((s) => ({
      routines: s.routines.map((r) => (r.id === updated.id ? updated : r)),
    }));
  },

  async deleteRoutine(id) {
    await api.delete(`/routines/${id}`);
    set((s) => ({
      routines: s.routines.filter((r) => r.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }));
  },
}));
