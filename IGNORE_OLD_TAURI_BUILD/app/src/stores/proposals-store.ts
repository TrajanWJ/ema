import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { Proposal, Seed, ProposalSortKey, ProposalSortDir } from "@/types/proposals";

interface ProposalsState {
  proposals: readonly Proposal[];
  seeds: readonly Seed[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  channel: Channel | null;
  sortKey: ProposalSortKey;
  sortDir: ProposalSortDir;
  filterMinScore: number;
  setSortKey: (key: ProposalSortKey) => void;
  setSortDir: (dir: ProposalSortDir) => void;
  setFilterMinScore: (min: number) => void;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  approve: (id: string) => Promise<void>;
  redirect: (id: string, note: string) => Promise<void>;
  kill: (id: string) => Promise<void>;
  loadSeeds: () => Promise<void>;
  createSeed: (data: Partial<Seed>) => Promise<void>;
  toggleSeed: (id: string) => Promise<void>;
  runSeedNow: (id: string) => Promise<void>;
  streamingStatus: Record<string, "idle" | "generating" | "refining" | "reviewing">;
  setStreamingStatus: (id: string, status: "idle" | "generating" | "refining" | "reviewing") => void;
  selectedForComparison: string[];
  toggleComparisonSelection: (id: string) => void;
  clearComparisonSelection: () => void;
  compareProposals: (ids: string[]) => Promise<Proposal[]>;
}

export const useProposalsStore = create<ProposalsState>((set) => ({
  proposals: [],
  seeds: [],
  loading: false,
  error: null,
  connected: false,
  channel: null,
  sortKey: "created_at",
  sortDir: "desc",
  filterMinScore: 0,
  streamingStatus: {} as Record<string, "idle" | "generating" | "refining" | "reviewing">,
  selectedForComparison: [],

  setSortKey(key) {
    set({ sortKey: key });
  },

  setSortDir(dir) {
    set({ sortDir: dir });
  },

  setFilterMinScore(min) {
    set({ filterMinScore: min });
  },

  setStreamingStatus(id, status) {
    set((state) => ({
      streamingStatus: { ...state.streamingStatus, [id]: status },
    }));
  },

  toggleComparisonSelection(id) {
    set((state) => {
      const selected = state.selectedForComparison;
      if (selected.includes(id)) {
        return { selectedForComparison: selected.filter((s) => s !== id) };
      }
      if (selected.length >= 3) return state;
      return { selectedForComparison: [...selected, id] };
    });
  },

  clearComparisonSelection() {
    set({ selectedForComparison: [] });
  },

  async compareProposals(ids) {
    const params = ids.map((id) => `ids[]=${id}`).join("&");
    const data = await api.get<{ proposals: Proposal[] }>(`/proposals/compare?${params}`);
    return data.proposals;
  },

  async loadViaRest() {
    const data = await api.get<{ proposals: Proposal[] }>("/proposals");
    set({ proposals: data.proposals });
  },

  async connect() {
    const { channel, response } = await joinChannel("proposals:queue");
    const data = response as { proposals: Proposal[] };
    set({ channel, connected: true, proposals: data.proposals });

    channel.on("proposal_created", (proposal: Proposal) => {
      set((state) => ({ proposals: [proposal, ...state.proposals] }));
    });

    channel.on("proposal_updated", (updated: Proposal) => {
      set((state) => ({
        proposals: state.proposals.map((p) => (p.id === updated.id ? updated : p)),
      }));
    });

    channel.on("proposal_deleted", (payload: { id: string }) => {
      set((state) => ({
        proposals: state.proposals.filter((p) => p.id !== payload.id),
      }));
    });

    channel.on("streaming_stage", (payload: { proposal_id: string; stage: string }) => {
      const status = (payload.stage as "idle" | "generating" | "refining" | "reviewing") || "idle";
      set((state) => ({
        streamingStatus: { ...state.streamingStatus, [payload.proposal_id]: status },
      }));
    });
  },

  async approve(id) {
    await api.post(`/proposals/${id}/approve`, {});
  },

  async redirect(id, note) {
    await api.post(`/proposals/${id}/redirect`, { note });
  },

  async kill(id) {
    await api.post(`/proposals/${id}/kill`, {});
  },

  async loadSeeds() {
    const data = await api.get<{ seeds: Seed[] }>("/seeds");
    set({ seeds: data.seeds });
  },

  async createSeed(data) {
    await api.post("/seeds", data);
  },

  async toggleSeed(id) {
    await api.post(`/seeds/${id}/toggle`, {});
  },

  async runSeedNow(id) {
    await api.post(`/seeds/${id}/run-now`, {});
  },
}));
