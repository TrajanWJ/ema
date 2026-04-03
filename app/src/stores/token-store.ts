import { create } from "zustand";
import { api } from "@/lib/api";
import { joinChannel, type Channel } from "@/lib/ws";

interface TokenSummary {
  readonly today_cost: number;
  readonly today_delta: number;
  readonly week_cost: number;
  readonly month_cost: number;
  readonly monthly_budget: number;
  readonly percent_used: number;
  readonly days_remaining: number;
  readonly by_agent: readonly BreakdownRow[];
  readonly by_model: readonly BreakdownRow[];
  readonly as_of: string;
}

interface ExecutionRecord {
  readonly id: string;
  readonly mode: string;
  readonly status: string;
  readonly metadata: Record<string, unknown> | null;
  readonly inserted_at: string;
  readonly completed_at: string | null;
}

interface ModeBreakdown {
  readonly mode: string;
  readonly count: number;
  readonly total_cost: number;
  readonly avg_cost: number;
}

interface BreakdownRow {
  readonly key: string;
  readonly total_cost: number;
  readonly total_input: number;
  readonly total_output: number;
  readonly event_count: number;
}

interface HistoryDay {
  readonly date: string;
  readonly total_cost: number;
  readonly total_input: number;
  readonly total_output: number;
  readonly event_count: number;
}

interface Forecast {
  readonly daily_avg: number;
  readonly projected_monthly: number;
  readonly trend: string;
}

interface Budget {
  readonly monthly_budget: number;
  readonly alert_threshold_pct: number;
  readonly current_spend: number;
  readonly percent_used: number;
  readonly days_remaining: number;
}

interface CostAlert {
  readonly type: string;
  readonly message: string;
  readonly timestamp: string;
}

interface TokenState {
  summary: TokenSummary | null;
  history: readonly HistoryDay[];
  forecast: Forecast | null;
  budget: Budget | null;
  alerts: readonly CostAlert[];
  modeBreakdown: readonly ModeBreakdown[];
  avgCostPerExecution: number;
  totalExecutions: number;
  loading: boolean;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  loadHistory: () => Promise<void>;
  loadForecast: () => Promise<void>;
  loadBudget: () => Promise<void>;
  loadExecutionStats: () => Promise<void>;
  setBudget: (amount: number) => Promise<void>;
  clearAlerts: () => void;
}

export const useTokenStore = create<TokenState>((set, get) => ({
  summary: null,
  history: [],
  forecast: null,
  budget: null,
  alerts: [],
  modeBreakdown: [],
  avgCostPerExecution: 0,
  totalExecutions: 0,
  loading: false,
  connected: false,
  channel: null,

  loadViaRest: async () => {
    set({ loading: true });
    try {
      const [summary, historyRes, forecast, budget] = await Promise.all([
        api.get<TokenSummary>("/tokens/summary"),
        api.get<{ history: HistoryDay[] }>("/tokens/history"),
        api.get<Forecast>("/tokens/forecast"),
        api.get<Budget>("/tokens/budget"),
      ]);
      set({
        summary,
        history: historyRes.history,
        forecast,
        budget,
        loading: false,
      });
      get().loadExecutionStats().catch(() => {});
    } catch {
      set({ loading: false });
    }
  },

  connect: async () => {
    try {
      const { channel } = await joinChannel("intelligence:tokens");
      channel.on("token_recorded", () => {
        get().loadViaRest();
      });
      channel.on("budget_warning", (payload: Record<string, unknown>) => {
        set((s) => ({
          summary: s.summary
            ? { ...s.summary, percent_used: (payload.percent as number) ?? s.summary.percent_used }
            : s.summary,
        }));
      });
      channel.on("cost_spike", (payload: Record<string, unknown>) => {
        const alert: CostAlert = {
          type: "cost_spike",
          message: (payload.message as string) ?? "Cost spike detected",
          timestamp: new Date().toISOString(),
        };
        set((s) => ({ alerts: [alert, ...s.alerts].slice(0, 20) }));
      });
      channel.on("budget_exceeded", (payload: Record<string, unknown>) => {
        const alert: CostAlert = {
          type: "budget_exceeded",
          message: (payload.message as string) ?? "Budget exceeded",
          timestamp: new Date().toISOString(),
        };
        set((s) => ({ alerts: [alert, ...s.alerts].slice(0, 20) }));
      });
      channel.on("weekly_digest", (payload: Record<string, unknown>) => {
        const alert: CostAlert = {
          type: "weekly_digest",
          message: (payload.message as string) ?? "Weekly digest available",
          timestamp: new Date().toISOString(),
        };
        set((s) => ({ alerts: [alert, ...s.alerts].slice(0, 20) }));
      });
      set({ connected: true, channel });
    } catch {
      set({ connected: false });
    }
  },

  loadHistory: async () => {
    try {
      const res = await api.get<{ history: HistoryDay[] }>("/tokens/history");
      set({ history: res.history });
    } catch {
      // silent
    }
  },

  loadForecast: async () => {
    try {
      const forecast = await api.get<Forecast>("/tokens/forecast");
      set({ forecast });
    } catch {
      // silent
    }
  },

  loadBudget: async () => {
    try {
      const budget = await api.get<Budget>("/tokens/budget");
      set({ budget });
    } catch {
      // silent
    }
  },

  loadExecutionStats: async () => {
    try {
      const res = await api.get<{ executions: ExecutionRecord[] }>("/executions");
      const execs = res.executions ?? [];
      const completed = execs.filter((e) => e.status === "completed");

      // Per-mode breakdown
      const modeMap = new Map<string, { count: number; total_cost: number }>();
      for (const e of completed) {
        const mode = e.mode || "unknown";
        const cost = (e.metadata as Record<string, unknown> | null)?.total_cost_usd;
        const costNum = typeof cost === "number" ? cost : 0;
        const existing = modeMap.get(mode) ?? { count: 0, total_cost: 0 };
        modeMap.set(mode, { count: existing.count + 1, total_cost: existing.total_cost + costNum });
      }

      const modeBreakdown: ModeBreakdown[] = Array.from(modeMap.entries())
        .map(([mode, { count, total_cost }]) => ({
          mode,
          count,
          total_cost,
          avg_cost: count > 0 ? total_cost / count : 0,
        }))
        .sort((a, b) => b.total_cost - a.total_cost);

      const totalCost = modeBreakdown.reduce((s, m) => s + m.total_cost, 0);
      const totalCount = completed.length;

      set({
        modeBreakdown,
        avgCostPerExecution: totalCount > 0 ? totalCost / totalCount : 0,
        totalExecutions: totalCount,
      });
    } catch {
      // silent
    }
  },

  setBudget: async (amount: number) => {
    try {
      await api.put("/tokens/budget", { amount_usd: amount });
      await get().loadBudget();
      await get().loadViaRest();
    } catch {
      // silent
    }
  },

  clearAlerts: () => {
    set({ alerts: [] });
  },
}));
