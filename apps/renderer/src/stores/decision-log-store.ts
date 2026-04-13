import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";

interface DecisionOption {
  readonly label: string;
  readonly pros: readonly string[];
  readonly cons: readonly string[];
}

interface Decision {
  readonly id: number;
  readonly title: string;
  readonly context: string;
  readonly options: readonly DecisionOption[];
  readonly chosen_option: string | null;
  readonly decided_by: string;
  readonly reasoning: string | null;
  readonly outcome: string | null;
  readonly outcome_score: number | null;
  readonly tags: readonly string[];
  readonly inserted_at: string;
  readonly reviewed_at: string | null;
}

interface DecisionLogState {
  decisions: readonly Decision[];
  selected: Decision | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  selectDecision: (d: Decision | null) => void;
  createDecision: (attrs: Record<string, unknown>) => Promise<void>;
  updateDecision: (id: number, attrs: Record<string, unknown>) => Promise<void>;
  deleteDecision: (id: number) => Promise<void>;
}

export type { Decision, DecisionOption };

export const useDecisionLogStore = create<DecisionLogState>((set, _get) => ({
  decisions: [],
  selected: null,
  loading: false,
  error: null,
  connected: false,
  channel: null,

  async loadViaRest(): Promise<void> {
    set({ loading: true, error: null });
    try {
      const res = await api.get<{ data: Decision[] }>("/decisions");
      set({ decisions: res.data ?? [], loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async connect(): Promise<void> {
    try {
      const { channel, response } = await joinChannel("decisions:lobby");
      const data = response as { data: Decision[] };
      if (data.data) {
        set({ decisions: data.data });
      }
      set({ channel, connected: true });

      channel.on("decision_created", (decision: Decision) => {
        set((state) => ({ decisions: [decision, ...state.decisions] }));
      });

      channel.on("decision_updated", (updated: Decision) => {
        set((state) => ({
          decisions: state.decisions.map((d) =>
            d.id === updated.id ? updated : d,
          ),
          selected: state.selected?.id === updated.id ? updated : state.selected,
        }));
      });

      channel.on("decision_deleted", (payload: { id: number }) => {
        set((state) => ({
          decisions: state.decisions.filter((d) => d.id !== payload.id),
          selected: state.selected?.id === payload.id ? null : state.selected,
        }));
      });
    } catch (e) {
      console.warn("Channel join failed:", e);
    }
  },

  selectDecision(d: Decision | null): void {
    set({ selected: d });
  },

  async createDecision(attrs: Record<string, unknown>): Promise<void> {
    await api.post("/decisions", { decision: attrs });
  },

  async updateDecision(id: number, attrs: Record<string, unknown>): Promise<void> {
    await api.put(`/decisions/${id}`, { decision: attrs });
  },

  async deleteDecision(id: number): Promise<void> {
    await api.delete(`/decisions/${id}`);
    set((state) => ({
      selected: state.selected?.id === id ? null : state.selected,
    }));
  },
}));
