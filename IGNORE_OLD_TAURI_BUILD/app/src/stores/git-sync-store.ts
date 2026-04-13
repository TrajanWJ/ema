import { create } from "zustand";
import { api } from "@/lib/api";
import type { GitEvent, WikiSyncAction, SyncStatus } from "@/types/git-sync";

interface GitSyncState {
  events: readonly GitEvent[];
  syncStatus: SyncStatus | null;
  loading: boolean;
  connected: boolean;
  loadViaRest: () => Promise<void>;
  loadSyncStatus: () => Promise<void>;
  applySuggestion: (eventId: string, actionId: string) => Promise<void>;
  scanRepo: (repoPath: string) => Promise<void>;
}

export const useGitSyncStore = create<GitSyncState>((set, get) => ({
  events: [],
  syncStatus: null,
  loading: false,
  connected: false,

  async loadViaRest() {
    set({ loading: true });
    try {
      const [eventsData, statusData] = await Promise.all([
        api.get<{ events: GitEvent[] }>("/intelligence/git-events"),
        api.get<SyncStatus>("/intelligence/sync-status"),
      ]);
      set({
        events: eventsData.events,
        syncStatus: statusData,
        loading: false,
        connected: true,
      });
    } catch {
      set({ loading: false });
    }
  },

  async loadSyncStatus() {
    try {
      const status = await api.get<SyncStatus>("/intelligence/sync-status");
      set({ syncStatus: status });
    } catch {
      // ignore
    }
  },

  async applySuggestion(eventId: string, actionId: string) {
    const result = await api.post<{ action: WikiSyncAction }>(
      `/intelligence/git-events/${eventId}/apply/${actionId}`,
      {},
    );

    set((state) => ({
      events: state.events.map((event) => {
        if (event.id !== eventId) return event;
        return {
          ...event,
          sync_actions: event.sync_actions.map((a) =>
            a.id === actionId ? result.action : a,
          ),
        };
      }),
    }));

    // Refresh status counts
    get().loadSyncStatus();
  },

  async scanRepo(repoPath: string) {
    await api.post("/intelligence/git-events/scan", { repo: repoPath });
    // Reload after a brief delay to allow scan to process
    setTimeout(() => get().loadViaRest(), 3000);
  },
}));
