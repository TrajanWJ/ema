import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { BehaviorRule, EvolutionSignal, EvolutionStats } from "@/types/evolution";

interface EvolutionState {
  rules: readonly BehaviorRule[];
  signals: readonly EvolutionSignal[];
  stats: EvolutionStats | null;
  connected: boolean;
  channel: Channel | null;
  loadRules: (opts?: { status?: string }) => Promise<void>;
  loadSignals: () => Promise<void>;
  loadStats: () => Promise<void>;
  connect: () => Promise<void>;
  createRule: (data: { content: string; source?: string }) => Promise<void>;
  updateRule: (id: string, data: Partial<BehaviorRule>) => Promise<void>;
  activateRule: (id: string) => Promise<void>;
  rollbackRule: (id: string) => Promise<void>;
  applyVersion: (id: string, content: string) => Promise<void>;
  getVersionHistory: (id: string) => Promise<readonly BehaviorRule[]>;
  triggerScan: () => Promise<void>;
  proposeEvolution: (instruction: string) => Promise<void>;
}

export const useEvolutionStore = create<EvolutionState>((set) => ({
  rules: [],
  signals: [],
  stats: null,
  connected: false,
  channel: null,

  async loadRules(opts) {
    const params = opts?.status ? `?status=${opts.status}` : "";
    const data = await api.get<{ rules: BehaviorRule[] }>(`/evolution/rules${params}`);
    set({ rules: data.rules });
  },

  async loadSignals() {
    const data = await api.get<{ signals: EvolutionSignal[] }>("/evolution/signals");
    set({ signals: data.signals });
  },

  async loadStats() {
    const data = await api.get<EvolutionStats>("/evolution/stats");
    set({ stats: data });
  },

  async connect() {
    try {
      const { channel } = await joinChannel("evolution:updates");
      set({ channel, connected: true });

      channel.on("rule_created", (rule: BehaviorRule) => {
        set((state) => ({ rules: [rule, ...state.rules] }));
      });

      channel.on("rule_updated", (updated: BehaviorRule) => {
        set((state) => ({
          rules: state.rules.map((r) => (r.id === updated.id ? updated : r)),
        }));
      });
    } catch {
      console.warn("Evolution WebSocket failed, using REST");
    }
  },

  async createRule(data) {
    await api.post("/evolution/rules", data);
    await useEvolutionStore.getState().loadRules();
  },

  async updateRule(id, data) {
    await api.put(`/evolution/rules/${id}`, data);
    await useEvolutionStore.getState().loadRules();
  },

  async activateRule(id) {
    await api.post(`/evolution/rules/${id}/activate`, {});
    await useEvolutionStore.getState().loadRules();
  },

  async rollbackRule(id) {
    await api.post(`/evolution/rules/${id}/rollback`, {});
    await useEvolutionStore.getState().loadRules();
  },

  async applyVersion(id, content) {
    await api.post(`/evolution/rules/${id}/version`, { content });
    await useEvolutionStore.getState().loadRules();
  },

  async getVersionHistory(id) {
    const data = await api.get<{ versions: BehaviorRule[] }>(`/evolution/rules/${id}/history`);
    return data.versions;
  },

  async triggerScan() {
    await api.post("/evolution/scan", {});
  },

  async proposeEvolution(instruction) {
    await api.post("/evolution/propose", { instruction });
  },
}));
