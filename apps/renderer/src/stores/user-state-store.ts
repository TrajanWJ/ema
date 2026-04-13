import { create } from "zustand";
import { api } from "@/lib/api";
import type {
  UserStateHistoryEntry,
  UserStateSignalKind,
  UserStateSnapshot,
} from "@/types/user-state";

interface UpdateUserStateInput {
  readonly mode?: UserStateSnapshot["mode"];
  readonly focus_score?: number;
  readonly energy_score?: number;
  readonly distress_flag?: boolean;
  readonly drift_score?: number;
  readonly current_intent_slug?: string | null;
  readonly updated_by?: UserStateSnapshot["updated_by"];
  readonly reason?: string;
}

interface UserStateStore {
  state: UserStateSnapshot | null;
  history: readonly UserStateHistoryEntry[];
  loading: boolean;
  error: string | null;
  loadCurrent: () => Promise<void>;
  loadHistory: (limit?: number) => Promise<void>;
  updateState: (input: UpdateUserStateInput) => Promise<UserStateSnapshot>;
  signal: (kind: UserStateSignalKind, note?: string) => Promise<UserStateSnapshot>;
}

export const useUserStateStore = create<UserStateStore>((set) => ({
  state: null,
  history: [],
  loading: false,
  error: null,

  async loadCurrent() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ state: UserStateSnapshot }>("/user-state/current");
      set({ state: data.state, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "user_state_load_failed",
      });
    }
  },

  async loadHistory(limit = 8) {
    try {
      const data = await api.get<{ entries: UserStateHistoryEntry[] }>(
        `/user-state/history?limit=${limit}`,
      );
      set({ history: data.entries });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "user_state_history_failed",
      });
    }
  },

  async updateState(input) {
    const data = await api.post<{ state: UserStateSnapshot }>("/user-state/update", input);
    set((state) => ({
      state: data.state,
      history: [data.state as UserStateHistoryEntry, ...state.history].slice(0, 8),
    }));
    return data.state;
  },

  async signal(kind, note) {
    const data = await api.post<{ state: UserStateSnapshot }>("/user-state/signal", {
      kind,
      source: "desk",
      note,
    });
    await useUserStateStore.getState().loadHistory(8);
    set({ state: data.state });
    return data.state;
  },
}));
