import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";

interface BreakdownRow {
  readonly key: string;
  readonly total_cost: number;
  readonly total_input: number;
  readonly total_output: number;
  readonly event_count: number;
}

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

interface TokenMonitorState {
  summary: TokenSummary | null;
  history: readonly HistoryDay[];
  forecast: Forecast | null;
  budget: Budget | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  loadHistory: () => Promise<void>;
  loadForecast: () => Promise<void>;
  loadBudget: () => Promise<void>;
  setBudget: (amount: number) => Promise<void>;
}

export type { TokenSummary, HistoryDay, Forecast, Budget, BreakdownRow };

export const useTokenMonitorStore = create<TokenMonitorState>((set, get) => ({
  summary: null,
  history: [],
  forecast: null,
  budget: null,
  loading: false,
  error: null,
  connected: false,
  channel: null,

  async loadViaRest() {
    set({ loading: true, error: null });
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
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async connect() {
    try {
      const { channel } = await joinChannel("intelligence:tokens");
      set({ channel, connected: true });

      channel.on("token_recorded", () => {
        get().loadViaRest();
      });

      channel.on("budget_warning", (payload: Record<string, unknown>) => {
        set((s) => ({
          summary: s.summary
            ? {
                ...s.summary,
                percent_used:
                  (payload.percent as number) ?? s.summary.percent_used,
              }
            : s.summary,
        }));
      });

      channel.on("cost_spike", (payload: Record<string, unknown>) => {
        console.warn(
          "Cost spike:",
          (payload.message as string) ?? "detected",
        );
      });

      channel.on("budget_exceeded", (payload: Record<string, unknown>) => {
        console.warn(
          "Budget exceeded:",
          (payload.message as string) ?? "limit hit",
        );
      });
    } catch (e) {
      console.warn("Channel join failed:", e);
    }
  },

  async loadHistory() {
    try {
      const res = await api.get<{ history: HistoryDay[] }>("/tokens/history");
      set({ history: res.history });
    } catch {
      // silent
    }
  },

  async loadForecast() {
    try {
      const forecast = await api.get<Forecast>("/tokens/forecast");
      set({ forecast });
    } catch {
      // silent
    }
  },

  async loadBudget() {
    try {
      const budget = await api.get<Budget>("/tokens/budget");
      set({ budget });
    } catch {
      // silent
    }
  },

  async setBudget(amount: number) {
    await api.put("/tokens/budget", { amount_usd: amount });
    await get().loadBudget();
    await get().loadViaRest();
  },
}));
