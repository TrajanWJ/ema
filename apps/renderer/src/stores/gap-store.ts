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

interface GapState {
  gaps: readonly GapRecord[];
  counts: GapCounts;
  filterSource: string | null;
  filterSeverity: string | null;
  filterProject: string | null;
  loading: boolean;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  setFilterSource: (source: string | null) => void;
  setFilterSeverity: (severity: string | null) => void;
  setFilterProject: (projectId: string | null) => void;
  resolveGap: (id: string) => Promise<void>;
  createTaskFromGap: (id: string) => Promise<void>;
  sendToExecution: (gap: { title: string; description: string | null }) => Promise<void>;
  scan: () => Promise<void>;
}

export const useGapStore = create<GapState>((set, get) => ({
  gaps: [],
  counts: {},
  filterSource: null,
  filterSeverity: null,
  filterProject: null,
  loading: false,
  connected: false,
  channel: null,

  async loadViaRest() {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      const { filterSource, filterSeverity, filterProject } = get();
      if (filterSource) params.set("source", filterSource);
      if (filterSeverity) params.set("severity", filterSeverity);
      if (filterProject) params.set("project_id", filterProject);

      const data = await api.get<{ gaps: GapRecord[]; counts: GapCounts }>(
        `/gaps?${params.toString()}`
      );
      set({ gaps: data.gaps, counts: data.counts, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async connect() {
    try {
      const { channel, response } = await joinChannel("gaps:live");
      const data = response as { gaps: GapRecord[]; counts: GapCounts };
      set({ channel, connected: true, gaps: data.gaps, counts: data.counts });

      channel.on("gap_resolved", (gap: GapRecord) => {
        set((state) => ({
          gaps: state.gaps.filter((g) => g.id !== gap.id),
        }));
      });

      channel.on("scan_complete", (payload: { counts: GapCounts }) => {
        set({ counts: payload.counts });
        get().loadViaRest();
      });
    } catch {
      // REST fallback
    }
  },

  setFilterSource(source) {
    set({ filterSource: source });
    get().loadViaRest();
  },

  setFilterSeverity(severity) {
    set({ filterSeverity: severity });
    get().loadViaRest();
  },

  setFilterProject(projectId) {
    set({ filterProject: projectId });
    get().loadViaRest();
  },

  async resolveGap(id) {
    await api.post(`/gaps/${id}/resolve`, {});
    set((state) => ({ gaps: state.gaps.filter((g) => g.id !== id) }));
  },

  async createTaskFromGap(id) {
    await api.post(`/gaps/${id}/create_task`, {});
    set((state) => ({ gaps: state.gaps.filter((g) => g.id !== id) }));
  },

  async sendToExecution(gap) {
    const content = gap.description
      ? `${gap.title}: ${gap.description}`
      : gap.title;
    await api.post("/brain-dump/items", { content, source: "text" });
  },

  async scan() {
    set({ loading: true });
    await api.post("/gaps/scan", {});
    await get().loadViaRest();
  },
}));
