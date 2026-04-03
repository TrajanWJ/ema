import { create } from "zustand";
import { api } from "@/lib/api";

export interface AuditEntry {
  readonly id: string;
  readonly actor: string;
  readonly action: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly diff: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown> | null;
  readonly inserted_at: string;
}

interface AuditFilters {
  actor: string;
  action: string;
  resource_type: string;
  from_date: string;
  to_date: string;
}

interface AuditState {
  entries: readonly AuditEntry[];
  filters: AuditFilters;
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  loadEntries: (reset?: boolean) => Promise<void>;
  setFilter: <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) => void;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  entries: [],
  filters: { actor: "", action: "", resource_type: "", from_date: "", to_date: "" },
  loading: false,
  hasMore: true,
  error: null,

  async loadEntries(reset = false) {
    const state = get();
    if (state.loading) return;
    set({ loading: true, error: null });

    try {
      const offset = reset ? 0 : state.entries.length;
      const params = new URLSearchParams();
      params.set("offset", String(offset));
      params.set("limit", "50");
      const { filters } = state;
      if (filters.actor) params.set("actor", filters.actor);
      if (filters.action) params.set("action", filters.action);
      if (filters.resource_type) params.set("resource_type", filters.resource_type);
      if (filters.from_date) params.set("from_date", filters.from_date);
      if (filters.to_date) params.set("to_date", filters.to_date);

      const data = await api.get<{ entries: AuditEntry[] }>(`/audit?${params.toString()}`);
      set({
        entries: reset ? data.entries : [...state.entries, ...data.entries],
        hasMore: data.entries.length === 50,
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  setFilter(key, value) {
    set((s) => ({ filters: { ...s.filters, [key]: value } }));
  },
}));
