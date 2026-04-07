import { create } from "zustand";
import type { Intent } from "../api/hq";
import * as hq from "../api/hq";

export type { Intent };

interface IntentStore {
  intents: Intent[];
  tree: unknown | null;
  loading: boolean;
  error: string | null;

  loadIntents: () => Promise<void>;
  loadTree: () => Promise<void>;
  createIntent: (data: Partial<Intent>) => Promise<Intent>;
  updateIntent: (id: string, data: Partial<Intent>) => Promise<void>;
  getIntentsByLevel: (level: number) => Intent[];
}

export const useIntentStore = create<IntentStore>((set, get) => ({
  intents: [],
  tree: null,
  loading: false,
  error: null,

  async loadIntents() {
    set({ loading: true, error: null });
    try {
      const data = await hq.getIntents();
      set({ intents: data.intents, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  async loadTree() {
    try {
      const tree = await hq.getIntentTree();
      set({ tree });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  async createIntent(data) {
    const result = await hq.createIntent(data);
    set((state) => ({ intents: [result.intent, ...state.intents] }));
    return result.intent;
  },

  async updateIntent(id, data) {
    const result = await hq.updateIntent(id, data);
    set((state) => ({
      intents: state.intents.map((i) => (i.id === id ? result.intent : i)),
    }));
  },

  getIntentsByLevel(level) {
    return get().intents.filter((i) => i.level === level);
  },
}));
