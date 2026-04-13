import { create } from "zustand";
import { api } from "@/lib/api";

interface VmHealth {
  readonly status: string;
  readonly bridge_up: boolean;
  readonly ssh_up: boolean;
  readonly latency_ms: number | null;
  readonly checked_at: string | null;
}

interface TokenSummary {
  readonly today_cost: number;
  readonly week_cost: number;
  readonly month_cost: number;
  readonly monthly_budget: number;
  readonly percent_used: number;
}

interface PipelineStats {
  readonly seeds: number;
  readonly proposals: Record<string, number>;
  readonly tasks: Record<string, number>;
  readonly active_sessions: number;
}

interface ServiceDashboardState {
  vmHealth: VmHealth | null;
  tokenSummary: TokenSummary | null;
  pipelineStats: PipelineStats | null;
  loading: boolean;
  error: string | null;
  loadViaRest: () => Promise<void>;
}

export type { VmHealth, TokenSummary, PipelineStats };

export const useServiceDashboardStore = create<ServiceDashboardState>(
  (set) => ({
    vmHealth: null,
    tokenSummary: null,
    pipelineStats: null,
    loading: false,
    error: null,

    async loadViaRest() {
      set({ loading: true, error: null });
      try {
        const [vmHealth, tokenSummary, pipelineStats] =
          await Promise.all([
            api.get<VmHealth>("/vm/health"),
            api.get<TokenSummary>("/tokens/summary"),
            api.get<PipelineStats>("/pipeline/stats"),
          ]);

        set({
          vmHealth,
          tokenSummary,
          pipelineStats,
          loading: false,
        });
      } catch (e) {
        set({ error: String(e), loading: false });
      }
    },
  }),
);
