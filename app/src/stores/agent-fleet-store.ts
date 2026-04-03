import { create } from "zustand";
import { api } from "@/lib/api";

interface TrustScore {
  score: number;
  label: string;
  color: string;
  completion_rate: number;
  avg_latency_ms: number;
  error_count: number;
  session_count: number;
  days_active: number;
  calculated_at: string;
}

interface FleetAgent {
  id: string;
  name: string;
  slug: string;
  status: "active" | "idle" | "crashed" | "completed";
  current_task: string | null;
  runtime_seconds: number;
  token_count: number;
  project: string | null;
  trust_score: TrustScore | null;
  description: string | null;
  model: string | null;
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

export type { FleetAgent, FleetHealth, TrustScore };

function normalizeStatus(status: string | undefined): FleetAgent["status"] {
  if (status === "active" || status === "running") return "active";
  if (status === "crashed" || status === "error") return "crashed";
  if (status === "completed" || status === "done") return "completed";
  return "idle";
}

export const useAgentFleetStore = create<AgentFleetState>((set) => ({
  agents: [],
  health: { active: 0, idle: 0, crashed: 0, completed: 0 },
  loading: false,
  selectedAgent: null,

  async loadFleet() {
    set({ loading: true });
    try {
      const res = await api.get<{ agents?: FleetAgent[]; data?: FleetAgent[] }>("/agents");
      const raw = res.agents ?? res.data ?? [];
      // Map agent controller response to fleet format
      const agents: FleetAgent[] = raw.map((a: Record<string, unknown>) => ({
        id: (a.id as string) ?? "",
        name: (a.name as string) ?? (a.slug as string) ?? "unknown",
        slug: (a.slug as string) ?? "",
        status: normalizeStatus(a.status as string),
        current_task: (a.current_task as string | null) ?? null,
        runtime_seconds: (a.runtime_seconds as number) ?? 0,
        token_count: (a.token_count as number) ?? 0,
        project: (a.project as string | null) ?? (a.project_id as string | null) ?? null,
        trust_score: (a.trust_score as TrustScore | null) ?? null,
        description: (a.description as string | null) ?? null,
        model: (a.model as string | null) ?? null,
      }));
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
