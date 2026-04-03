import { create } from "zustand";
import { api } from "@/lib/api";

interface FleetAgent {
  id: string;
  name: string;
  slug: string;
  status: "active" | "idle" | "crashed" | "completed";
  current_task: string | null;
  runtime_seconds: number;
  token_count: number;
  project: string | null;
}

interface FleetHealth {
  active: number;
  idle: number;
  crashed: number;
  completed: number;
}

interface AgentFleetState {
  agents: readonly FleetAgent[];
  health: FleetHealth;
  loading: boolean;
  selectedAgent: string | null;

  loadFleet: () => Promise<void>;
  selectAgent: (id: string | null) => void;
}

export type { FleetAgent, FleetHealth };

export const useAgentFleetStore = create<AgentFleetState>((set) => ({
  agents: [],
  health: { active: 0, idle: 0, crashed: 0, completed: 0 },
  loading: false,
  selectedAgent: null,

  async loadFleet() {
    set({ loading: true });
    try {
      const res = await api.get<{ data: FleetAgent[] }>("/agents");
      const agents = res.data ?? [];
      const health: FleetHealth = { active: 0, idle: 0, crashed: 0, completed: 0 };
      for (const a of agents) {
        if (a.status in health) health[a.status]++;
      }
      set({ agents, health, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  selectAgent(id: string | null) {
    set({ selectedAgent: id });
  },
}));
