import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import {
  mapDurableProposalRecord,
  type DurableProposalRecord,
  type Proposal,
  type Seed,
  type ProposalSortKey,
  type ProposalSortDir,
} from "@/types/proposals";

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

function replaceProposal(
  proposals: readonly Proposal[],
  proposal: Proposal,
): readonly Proposal[] {
  const existing = proposals.some((item) => item.id === proposal.id);
  return existing
    ? proposals.map((item) => (item.id === proposal.id ? proposal : item))
    : [proposal, ...proposals];
}

export const useProposalsStore = create<ProposalsState>((set, get) => ({
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
    const byId = new Map(get().proposals.map((proposal) => [proposal.id, proposal]));
    return ids.map((id) => byId.get(id)).filter((proposal): proposal is Proposal => proposal !== undefined);
  },

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ proposals: DurableProposalRecord[] }>("/proposals");
      set({
        proposals: (data.proposals ?? []).map((proposal) => mapDurableProposalRecord(proposal)),
        loading: false,
      });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  async connect() {
    try {
      const { channel, response } = await joinChannel("proposals:queue");
      const data = response as { proposals: DurableProposalRecord[] };
      set({
        channel,
        connected: true,
        proposals: (data.proposals ?? []).map((proposal) => mapDurableProposalRecord(proposal)),
      });

      channel.on("proposal_created", (proposal: DurableProposalRecord) => {
        set((state) => ({
          proposals: replaceProposal(state.proposals, mapDurableProposalRecord(proposal)),
        }));
      });

      channel.on("proposal_updated", (updated: DurableProposalRecord) => {
        set((state) => ({
          proposals: replaceProposal(state.proposals, mapDurableProposalRecord(updated)),
        }));
      });

      channel.on("proposal_deleted", (payload: { id: string }) => {
        set((state) => ({
          proposals: state.proposals.filter((proposal) => proposal.id !== payload.id),
        }));
      });

      channel.on("streaming_stage", (payload: { proposal_id: string; stage: string }) => {
        const status = (payload.stage as "idle" | "generating" | "refining" | "reviewing") || "idle";
        set((state) => ({
          streamingStatus: { ...state.streamingStatus, [payload.proposal_id]: status },
        }));
      });
    } catch {
      await get().loadViaRest();
    }
  },

  async approve(id) {
    const data = await api.post<{ proposal: DurableProposalRecord }>(`/proposals/${id}/approve`, {
      actor_id: "actor_human_owner",
    });
    set((state) => ({
      proposals: replaceProposal(state.proposals, mapDurableProposalRecord(data.proposal)),
    }));
  },

  async redirect(id, note) {
    const data = await api.post<{ proposal: DurableProposalRecord }>(`/proposals/${id}/revise`, {
      rationale: note,
    });
    set((state) => ({
      proposals: replaceProposal(state.proposals, mapDurableProposalRecord(data.proposal)),
    }));
  },

  async kill(id) {
    const data = await api.post<{ proposal: DurableProposalRecord }>(`/proposals/${id}/reject`, {
      actor_id: "actor_human_owner",
      reason: "Rejected from renderer proposal queue",
    });
    set((state) => ({
      proposals: replaceProposal(state.proposals, mapDurableProposalRecord(data.proposal)),
    }));
  },

  async loadSeeds() {
    const data = await api.get<{ seeds: Seed[] }>("/proposals/seeds");
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
