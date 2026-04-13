import { create } from "zustand";
import { api } from "@/lib/api";

export interface Transaction {
  readonly id: string;
  readonly description: string;
  readonly amount: number;
  readonly type: "income" | "expense";
  readonly category: string;
  readonly date: string;
  readonly project_id: string | null;
  readonly recurring: boolean;
  readonly notes: string | null;
  readonly inserted_at: string;
}

interface FinanceSummary {
  readonly total_income: number;
  readonly total_expense: number;
  readonly net: number;
}

interface FinanceState {
  transactions: readonly Transaction[];
  summary: FinanceSummary | null;
  loading: boolean;
  error: string | null;
  loadViaRest: () => Promise<void>;
  loadSummary: () => Promise<void>;
  createTransaction: (attrs: {
    description: string;
    amount: number;
    type: "income" | "expense";
    category: string;
    date: string;
  }) => Promise<void>;
  updateTransaction: (
    id: string,
    attrs: Partial<Omit<Transaction, "id" | "inserted_at">>,
  ) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set) => ({
  transactions: [],
  summary: null,
  loading: false,
  error: null,

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const [txData, summaryData] = await Promise.all([
        api
          .get<{ transactions: Transaction[] }>("/finance")
          .catch(() => ({ transactions: [] as Transaction[] })),
        api
          .get<{ summary: FinanceSummary }>("/finance/summary")
          .catch(() => ({ summary: null })),
      ]);
      set({
        transactions: txData.transactions,
        summary: summaryData.summary,
        loading: false,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async loadSummary() {
    try {
      const data = await api.get<{ summary: FinanceSummary }>(
        "/finance/summary",
      );
      set({ summary: data.summary });
    } catch (e) {
      console.warn("Failed to load summary:", e);
    }
  },

  async createTransaction(attrs) {
    await api.post<{ transaction: Transaction }>("/finance", {
      transaction: attrs,
    });
    await useFinanceStore.getState().loadViaRest();
  },

  async updateTransaction(id, attrs) {
    await api.put<{ transaction: Transaction }>(`/finance/${id}`, {
      transaction: attrs,
    });
    await useFinanceStore.getState().loadViaRest();
  },

  async deleteTransaction(id) {
    await api.delete(`/finance/${id}`);
    set((s) => ({
      transactions: s.transactions.filter((t) => t.id !== id),
    }));
  },
}));
