import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";

interface GapRecord {
  readonly id: string;
  readonly source: string;
  readonly gap_type: string;
  readonly title: string;
  readonly description: string | null;
  readonly severity: string;
  readonly project_id: string | null;
  readonly file_path: string | null;
  readonly line_number: number | null;
  readonly status: string;
  readonly resolved_at: string | null;
  readonly created_at: string;
}

interface GapCounts {
  readonly critical?: number;
  readonly high?: number;
  readonly medium?: number;
  readonly low?: number;
}

interface GapsState {
  gaps: readonly GapRecord[];
  counts: GapCounts;
  loading: boolean;
  error: string | null;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  resolveGap: (id: string) => Promise<void>;
  createTaskFromGap: (id: string) => Promise<void>;
  scan: () => Promise<void>;
}

export type { GapRecord, GapCounts };

export const useGapsStore = create<GapsState>((set, get) => ({
  gaps: [],
  counts: {},
  loading: false,
  error: null,
  connected: false,
  channel: null,

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ gaps: GapRecord[]; counts: GapCounts }>(
        "/gaps",
      );
      set({ gaps: data.gaps, counts: data.counts, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async connect() {
    try {
      const { channel, response } = await joinChannel("gaps:live");
      const data = response as { gaps: GapRecord[]; counts: GapCounts };
      set({
        channel,
        connected: true,
        gaps: data.gaps,
        counts: data.counts,
      });

      channel.on("gap_resolved", (gap: GapRecord) => {
        set((state) => ({
          gaps: state.gaps.filter((g) => g.id !== gap.id),
        }));
      });

      channel.on("gap_created", (gap: GapRecord) => {
        set((state) => ({ gaps: [gap, ...state.gaps] }));
      });

      channel.on("scan_complete", (payload: { counts: GapCounts }) => {
        set({ counts: payload.counts });
        get().loadViaRest();
      });
    } catch (e) {
      console.warn("Channel join failed:", e);
    }
  },

  async resolveGap(id) {
    await api.post(`/gaps/${id}/resolve`, {});
    set((state) => ({ gaps: state.gaps.filter((g) => g.id !== id) }));
  },

  async createTaskFromGap(id) {
    await api.post(`/gaps/${id}/create_task`, {});
    set((state) => ({ gaps: state.gaps.filter((g) => g.id !== id) }));
  },

  async scan() {
    set({ loading: true });
    await api.post("/gaps/scan", {});
    await get().loadViaRest();
  },
}));
