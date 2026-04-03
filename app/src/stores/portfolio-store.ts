import { create } from "zustand";
import { api } from "@/lib/api";

export interface Milestone {
  readonly id: string;
  readonly project_id: string;
  readonly title: string;
  readonly due_date: string;
  readonly status: "pending" | "in_progress" | "completed" | "overdue";
}

export interface Risk {
  readonly id: string;
  readonly project_id: string;
  readonly title: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly likelihood: "low" | "medium" | "high";
  readonly mitigation: string;
  readonly status: "open" | "mitigated" | "accepted";
}

export interface PortfolioProject {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly health: "on_track" | "at_risk" | "blocked";
  readonly progress: number; // 0-100
  readonly owner: string;
  readonly milestones: readonly Milestone[];
  readonly risks: readonly Risk[];
  readonly updated_at: string;
}

interface PortfolioState {
  projects: readonly PortfolioProject[];
  loading: boolean;
  error: string | null;
  loadPortfolio: () => Promise<void>;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  projects: [],
  loading: false,
  error: null,

  async loadPortfolio() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ projects: PortfolioProject[] }>("/portfolio/projects");
      set({ projects: data.projects, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },
}));
