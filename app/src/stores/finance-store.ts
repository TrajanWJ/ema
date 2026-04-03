import { create } from "zustand";
import { api } from "@/lib/api";

interface Account {
  readonly id: string;
  readonly name: string;
  readonly type: "checking" | "savings" | "credit" | "investment" | "cash";
  readonly balance: number;
  readonly currency: string;
}

interface Transaction {
  readonly id: string;
  readonly account_id: string;
  readonly amount: number;
  readonly category: string;
  readonly description: string;
  readonly date: string;
  readonly type: "income" | "expense" | "transfer";
}

interface Budget {
  readonly id: string;
  readonly category: string;
  readonly limit: number;
  readonly spent: number;
  readonly period: "monthly" | "weekly";
}

interface FinanceState {
  accounts: readonly Account[];
  transactions: readonly Transaction[];
  budgets: readonly Budget[];
  loading: boolean;
  error: string | null;
  loadAccounts: () => Promise<void>;
  loadTransactions: () => Promise<void>;
  loadBudgets: () => Promise<void>;
  createTransaction: (attrs: {
    account_id: string;
    amount: number;
    category: string;
    description: string;
    date: string;
    type: Transaction["type"];
  }) => Promise<void>;
  createAccount: (attrs: {
    name: string;
    type: Account["type"];
    balance: number;
    currency: string;
  }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set) => ({
  accounts: [],
  transactions: [],
  budgets: [],
  loading: false,
  error: null,

  async loadAccounts() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ accounts: Account[] }>("/finance/accounts");
      set({ accounts: data.accounts, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load accounts",
      });
    }
  },

  async loadTransactions() {
    try {
      const data = await api.get<{ transactions: Transaction[] }>("/finance/transactions");
      set({ transactions: data.transactions });
    } catch (e) {
      console.warn("Failed to load transactions:", e);
    }
  },

  async loadBudgets() {
    try {
      const data = await api.get<{ budgets: Budget[] }>("/finance/budgets");
      set({ budgets: data.budgets });
    } catch (e) {
      console.warn("Failed to load budgets:", e);
    }
  },

  async createTransaction(attrs) {
    const created = await api.post<Transaction>("/finance/transactions", attrs);
    set((s) => ({ transactions: [created, ...s.transactions] }));
  },

  async createAccount(attrs) {
    const created = await api.post<Account>("/finance/accounts", attrs);
    set((s) => ({ accounts: [...s.accounts, created] }));
  },

  async deleteTransaction(id) {
    await api.delete(`/finance/transactions/${id}`);
    set((s) => ({
      transactions: s.transactions.filter((t) => t.id !== id),
    }));
  },
}));
