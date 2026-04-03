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

interface TokenState {
  summary: TokenSummary | null;
  history: readonly HistoryDay[];
  forecast: Forecast | null;
  budget: Budget | null;
  loading: boolean;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  loadHistory: () => Promise<void>;
  loadForecast: () => Promise<void>;
  loadBudget: () => Promise<void>;
  setBudget: (amount: number) => Promise<void>;
}

export const useTokenStore = create<TokenState>((set, get) => ({
  summary: null,
  history: [],
  forecast: null,
  budget: null,
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

  setBudget: async (amount: number) => {
    try {
      await api.put("/tokens/budget", { amount_usd: amount });
      await get().loadBudget();
      await get().loadViaRest();
    } catch {
      // silent
    }
  },
}));
