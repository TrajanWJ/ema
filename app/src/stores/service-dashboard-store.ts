import { create } from "zustand";
import { api } from "@/lib/api";

interface VmHealth {
  readonly status: string;
  readonly openclaw_up: boolean;
  readonly ssh_up: boolean;
  readonly latency_ms: number | null;
  readonly checked_at: string | null;
}

interface OpenClawStatus {
  readonly status: string;
  readonly sessions: number;
  readonly uptime_seconds: number | null;
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
  openclawStatus: OpenClawStatus | null;
  tokenSummary: TokenSummary | null;
  pipelineStats: PipelineStats | null;
  loading: boolean;
  error: string | null;
  loadViaRest: () => Promise<void>;
}

export type { VmHealth, OpenClawStatus, TokenSummary, PipelineStats };

export const useServiceDashboardStore = create<ServiceDashboardState>(
  (set) => ({
    vmHealth: null,
    openclawStatus: null,
    tokenSummary: null,
    pipelineStats: null,
    loading: false,
    error: null,

    async loadViaRest() {
      set({ loading: true, error: null });
      try {
        const [vmHealth, openclawStatus, tokenSummary, pipelineStats] =
          await Promise.all([
            api.get<VmHealth>("/vm/health"),
            api.get<OpenClawStatus>("/openclaw/status"),
            api.get<TokenSummary>("/tokens/summary"),
            api.get<PipelineStats>("/pipeline/stats"),
          ]);

        set({
          vmHealth,
          openclawStatus,
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
