import { create } from "zustand";
import { api } from "@/lib/api";

export interface PulseSummary {
  readonly active_agents: number;
  readonly executions_today: number;
  readonly proposals_today: number;
  readonly tasks_completed: number;
}

export interface Agent {
  readonly id: string;
  readonly agent_id: string;
  readonly name: string;
  readonly status: "active" | "idle" | "error";
  readonly last_active: string | null;
  readonly tasks_completed: number;
  readonly proposals_generated: number;
  readonly skills?: readonly string[];
}

export interface AgentActivity {
  readonly agent_id: string;
  readonly action: string;
  readonly timestamp: string;
}

export interface Velocity {
  readonly daily: readonly number[];
  readonly length: number;
  map: <T>(fn: (v: number, i: number) => T) => T[];
}

export type VelocityData = Velocity;

export interface TeamMember {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly status: string;
  readonly skills: readonly string[];
}

interface TeamPulseState {
  summary: PulseSummary | null;
  agents: readonly Agent[];
  velocity: Velocity | null;
  members: readonly TeamMember[];
  loading: boolean;
  error: string | null;
  loadViaRest: () => Promise<void>;
}

export const useTeamPulseStore = create<TeamPulseState>((set) => ({
  summary: null,
  agents: [],
  velocity: null,
  members: [],
  loading: false,
  error: null,

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const [pulseData, agentData, velocityData] = await Promise.all([
        api
          .get<{ summary: PulseSummary }>("/team-pulse")
          .catch(() => ({ summary: null })),
        api
          .get<{ agents: Agent[] }>("/team-pulse/agents")
          .catch(() => ({ agents: [] as Agent[] })),
        api
          .get<{ velocity: Velocity }>("/team-pulse/velocity")
          .catch(() => ({ velocity: null })),
      ]);
      set({
        summary: pulseData.summary,
        agents: agentData.agents,
        velocity: velocityData.velocity,
        loading: false,
      });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

}));
