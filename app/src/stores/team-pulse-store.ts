import { create } from "zustand";
import { api } from "@/lib/api";

export interface TeamMember {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly avatar_url: string | null;
  readonly availability: "available" | "busy" | "away" | "offline";
  readonly skills: readonly string[];
  readonly current_load: number; // 0-100
  readonly current_task: string | null;
}

export interface Standup {
  readonly id: string;
  readonly member_id: string;
  readonly member_name: string;
  readonly yesterday: string;
  readonly today: string;
  readonly blockers: string;
  readonly submitted_at: string;
}

interface TeamPulseState {
  members: readonly TeamMember[];
  standups: readonly Standup[];
  loading: boolean;
  error: string | null;
  loadTeam: () => Promise<void>;
  loadStandups: () => Promise<void>;
  submitStandup: (data: {
    yesterday: string;
    today: string;
    blockers: string;
  }) => Promise<void>;
}

export const useTeamPulseStore = create<TeamPulseState>((set) => ({
  members: [],
  standups: [],
  loading: false,
  error: null,

  async loadTeam() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ members: TeamMember[] }>("/team-pulse/members");
      set({ members: data.members, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async loadStandups() {
    try {
      const data = await api.get<{ standups: Standup[] }>("/team-pulse/standups");
      set({ standups: data.standups });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  async submitStandup(data) {
    await api.post("/team-pulse/standups", data);
    const res = await api.get<{ standups: Standup[] }>("/team-pulse/standups");
    set({ standups: res.standups });
  },
}));
