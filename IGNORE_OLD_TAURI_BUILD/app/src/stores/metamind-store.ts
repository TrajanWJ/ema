import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type {
  SavedPrompt,
  PipelineRun,
  PipelineStage,
  InterceptorStats,
  ReviewerStats,
  ResearcherStats,
  ExpertDomain,
  ExpertReview,
} from "@/types/metamind";

interface MetaMindState {
  prompts: readonly SavedPrompt[];
  pipelineRuns: readonly PipelineRun[];
  activePipeline: PipelineRun | null;
  interceptorStats: InterceptorStats | null;
  reviewerStats: ReviewerStats | null;
  researcherStats: ResearcherStats | null;
  connected: boolean;
  channel: Channel | null;
  searchQuery: string;
  categoryFilter: string | null;

  loadPrompts: () => Promise<void>;
  connect: () => Promise<void>;
  searchPrompts: (query: string) => Promise<void>;
  savePrompt: (data: Partial<SavedPrompt>) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  trackOutcome: (id: string, success: boolean) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: string | null) => void;
}

export const useMetaMindStore = create<MetaMindState>((set, get) => ({
  prompts: [],
  pipelineRuns: [],
  activePipeline: null,
  interceptorStats: null,
  reviewerStats: null,
  researcherStats: null,
  connected: false,
  channel: null,
  searchQuery: "",
  categoryFilter: null,

  async loadPrompts() {
    const data = await api.get<{ prompts: SavedPrompt[] }>("/metamind/library");
    set({ prompts: data.prompts });
  },

  async connect() {
    const { channel, response } = await joinChannel("metamind:lobby");
    const data = response as { prompts: SavedPrompt[]; stats: InterceptorStats };
    set({
      channel,
      connected: true,
      prompts: data.prompts ?? [],
      interceptorStats: data.stats ?? null,
    });

    channel.on("pipeline_stage", (payload: {
      intercept_id: string;
      stage: PipelineStage;
      prompt?: string;
      reviews?: Record<ExpertDomain, ExpertReview>;
      revised_prompt?: string;
      avg_score?: number;
      was_modified?: boolean;
    }) => {
      set((state) => {
        const existing = state.pipelineRuns.find(
          (r) => r.intercept_id === payload.intercept_id
        );

        const run: PipelineRun = {
          intercept_id: payload.intercept_id,
          stage: payload.stage,
          original_prompt: existing?.original_prompt ?? payload.prompt ?? "",
          revised_prompt: payload.revised_prompt ?? existing?.revised_prompt ?? null,
          reviews: payload.reviews ?? existing?.reviews ?? {},
          avg_score: payload.avg_score ?? existing?.avg_score ?? 0,
          was_modified: payload.was_modified ?? existing?.was_modified ?? false,
          started_at: existing?.started_at ?? new Date().toISOString(),
          completed_at: payload.stage === "dispatched" ? new Date().toISOString() : null,
        };

        const runs = existing
          ? state.pipelineRuns.map((r) =>
              r.intercept_id === payload.intercept_id ? run : r
            )
          : [run, ...state.pipelineRuns].slice(0, 50);

        return {
          pipelineRuns: runs,
          activePipeline: run.stage !== "dispatched" ? run : state.activePipeline,
        };
      });
    });

    channel.on("prompt_saved", (prompt: SavedPrompt) => {
      set((state) => ({
        prompts: [prompt, ...state.prompts.filter((p) => p.id !== prompt.id)],
      }));
    });

    channel.on("prompt_deleted", (payload: { id: string }) => {
      set((state) => ({
        prompts: state.prompts.filter((p) => p.id !== payload.id),
      }));
    });

    channel.on("stats_updated", (payload: {
      interceptor: InterceptorStats;
      reviewer: ReviewerStats;
      researcher: ResearcherStats;
    }) => {
      set({
        interceptorStats: payload.interceptor,
        reviewerStats: payload.reviewer,
        researcherStats: payload.researcher,
      });
    });
  },

  async searchPrompts(query) {
    set({ searchQuery: query });
    if (!query.trim()) {
      await get().loadPrompts();
      return;
    }
    const data = await api.get<{ prompts: SavedPrompt[] }>(
      `/metamind/library?q=${encodeURIComponent(query)}`
    );
    set({ prompts: data.prompts });
  },

  async savePrompt(data) {
    await api.post("/metamind/library", data);
  },

  async deletePrompt(id) {
    await api.delete(`/metamind/library/${id}`);
  },

  async trackOutcome(id, success) {
    await api.post(`/metamind/library/${id}/outcome`, { success });
  },

  setSearchQuery(query) {
    set({ searchQuery: query });
  },

  setCategoryFilter(category) {
    set({ categoryFilter: category });
  },
}));
