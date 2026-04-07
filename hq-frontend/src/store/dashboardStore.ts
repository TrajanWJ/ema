import { create } from "zustand";
import type { DashboardData } from "../api/hq";
import * as hq from "../api/hq";

interface DashboardStore {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  loadDashboard: () => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  data: null,
  loading: false,
  error: null,

  async loadDashboard() {
    set({ loading: true, error: null });
    try {
      const data = await hq.getDashboard();
      set({ data, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
}));
