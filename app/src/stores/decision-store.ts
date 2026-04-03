import { create } from "zustand";
import { api } from "@/lib/api";

interface DecisionOption {
  label: string;
  pros: readonly string[];
  cons: readonly string[];
}

interface Decision {
  id: number;
  title: string;
  context: string;
  options: readonly DecisionOption[];
  chosen_option: string | null;
  decided_by: string;
  reasoning: string | null;
  outcome: string | null;
  outcome_score: number | null;
  tags: readonly string[];
  inserted_at: string;
  reviewed_at: string | null;
}

interface DecisionState {
  decisions: readonly Decision[];
  selected: Decision | null;
  loading: boolean;
  creating: boolean;

  loadDecisions: () => Promise<void>;
  selectDecision: (d: Decision | null) => void;
  createDecision: (attrs: Record<string, unknown>) => Promise<void>;
  updateDecision: (id: number, attrs: Record<string, unknown>) => Promise<void>;
  deleteDecision: (id: number) => Promise<void>;
  setCreating: (creating: boolean) => void;
}

export type { Decision, DecisionOption };

export const useDecisionStore = create<DecisionState>((set, get) => ({
  decisions: [],
  selected: null,
  loading: false,
  creating: false,

  async loadDecisions() {
    set({ loading: true });
    try {
      const res = await api.get<{ data: Decision[] }>("/decisions");
      set({ decisions: res.data ?? [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  selectDecision(d) {
    set({ selected: d, creating: false });
  },

  async createDecision(attrs) {
    try {
      await api.post("/decisions", { decision: attrs });
      set({ creating: false });
      get().loadDecisions();
    } catch {
      /* swallow — store consumers handle UX */
    }
  },

  async updateDecision(id, attrs) {
    try {
      await api.put(`/decisions/${id}`, { decision: attrs });
      get().loadDecisions();
    } catch {
      /* swallow */
    }
  },

  async deleteDecision(id) {
    try {
      await api.delete(`/decisions/${id}`);
      set({ selected: null });
      get().loadDecisions();
    } catch {
      /* swallow */
    }
  },

  setCreating(creating) {
    set({ creating, selected: null });
  },
}));
