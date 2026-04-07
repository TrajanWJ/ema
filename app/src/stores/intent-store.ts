import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";

export interface Intent {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string | null;
  readonly level: number;
  readonly kind: string;
  readonly status: string;
  readonly phase: number | null;
  readonly completion_pct: number | null;
  readonly clarity: number | null;
  readonly energy: number | null;
  readonly priority: number;
  readonly confidence: number | null;
  readonly parent_id: string | null;
  readonly project_id: string | null;
  readonly source_fingerprint: string | null;
  readonly provenance_class: string | null;
  readonly inserted_at: string;
  readonly updated_at: string;
}

export interface IntentLink {
  readonly id: string;
  readonly intent_id: string;
  readonly linkable_type: string;
  readonly linkable_id: string;
  readonly role: string;
  readonly provenance: string;
}

const LEVEL_NAMES = ["Vision", "Strategy", "Objective", "Initiative", "Task", "Step"];

interface IntentState {
  intents: readonly Intent[];
  tree: unknown | null;
  selectedIntent: Intent | null;
  lineage: unknown[] | null;
  runtime: Record<string, unknown> | null;
  loading: boolean;
  connected: boolean;
  channel: Channel | null;

  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  loadTree: () => Promise<void>;
  selectIntent: (intent: Intent | null) => void;
  loadLineage: (id: string) => Promise<void>;
  loadRuntime: (id: string) => Promise<void>;
  createIntent: (attrs: Partial<Intent>) => Promise<Intent>;
  updateIntent: (id: string, attrs: Partial<Intent>) => Promise<void>;
  deleteIntent: (id: string) => Promise<void>;
  getByLevel: (level: number) => readonly Intent[];
  getChildren: (parentId: string) => readonly Intent[];
  getRoots: () => readonly Intent[];
  levelName: (level: number) => string;
}

export const useIntentStore = create<IntentState>((set, get) => ({
  intents: [],
  tree: null,
  selectedIntent: null,
  lineage: null,
  runtime: null,
  loading: false,
  connected: false,
  channel: null,

  levelName: (level: number) => LEVEL_NAMES[level] || `L${level}`,

  async loadViaRest() {
    set({ loading: true });
    try {
      const data = await api.get<{ intents: Intent[] }>("/intents");
      set({ intents: data.intents, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async connect() {
    try {
      const { channel, response } = await joinChannel("intents:lobby");
      const data = response as { intents: Intent[] };
      set({ channel, connected: true, intents: data.intents });

      channel.on("intent_created", (intent: Intent) => {
        set((s) => ({ intents: [intent, ...s.intents] }));
      });

      channel.on("intent_updated", (updated: Intent) => {
        set((s) => ({
          intents: s.intents.map((i) => (i.id === updated.id ? updated : i)),
          selectedIntent: s.selectedIntent?.id === updated.id ? updated : s.selectedIntent,
        }));
      });

      channel.on("intent_deleted", (payload: { id: string }) => {
        set((s) => ({
          intents: s.intents.filter((i) => i.id !== payload.id),
          selectedIntent: s.selectedIntent?.id === payload.id ? null : s.selectedIntent,
        }));
      });
    } catch {
      await get().loadViaRest();
    }
  },

  async loadTree() {
    try {
      const tree = await api.get<unknown>("/intents/tree");
      set({ tree });
    } catch {
      // silent
    }
  },

  selectIntent(intent) {
    set({ selectedIntent: intent, lineage: null, runtime: null });
    if (intent) {
      get().loadLineage(intent.id);
      get().loadRuntime(intent.id);
    }
  },

  async loadLineage(id) {
    try {
      const data = await api.get<unknown>(`/intents/${id}/lineage`);
      set({ lineage: Array.isArray(data) ? data : [] });
    } catch {
      set({ lineage: [] });
    }
  },

  async loadRuntime(id) {
    try {
      const data = await api.get<Record<string, unknown>>(`/intents/${id}/runtime`);
      set({ runtime: data });
    } catch {
      set({ runtime: null });
    }
  },

  async createIntent(attrs) {
    const data = await api.post<{ intent: Intent }>("/intents", attrs);
    set((s) => ({ intents: [data.intent, ...s.intents] }));
    return data.intent;
  },

  async updateIntent(id, attrs) {
    const data = await api.put<{ intent: Intent }>(`/intents/${id}`, attrs);
    set((s) => ({
      intents: s.intents.map((i) => (i.id === id ? data.intent : i)),
      selectedIntent: s.selectedIntent?.id === id ? data.intent : s.selectedIntent,
    }));
  },

  async deleteIntent(id) {
    await api.delete(`/intents/${id}`);
    set((s) => ({
      intents: s.intents.filter((i) => i.id !== id),
      selectedIntent: s.selectedIntent?.id === id ? null : s.selectedIntent,
    }));
  },

  getByLevel(level) {
    return get().intents.filter((i) => i.level === level);
  },

  getChildren(parentId) {
    return get().intents.filter((i) => i.parent_id === parentId);
  },

  getRoots() {
    const ids = new Set(get().intents.map((i) => i.id));
    return get().intents.filter((i) => !i.parent_id || !ids.has(i.parent_id));
  },
}));
