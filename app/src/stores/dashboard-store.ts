import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";

interface DashboardHabit {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly completed: boolean;
  readonly streak: number;
}

interface DashboardJournal {
  readonly id: string;
  readonly date: string;
  readonly content: string;
  readonly one_thing: string | null;
  readonly mood: number | null;
  readonly energy_p: number | null;
  readonly energy_m: number | null;
  readonly energy_e: number | null;
}

interface DashboardSnapshot {
  readonly date: string;
  readonly inbox_count: number;
  readonly recent_inbox: readonly { id: string; content: string; source: string; created_at: string }[];
  readonly habits: readonly DashboardHabit[];
  readonly journal: DashboardJournal | null;
}

interface DashboardState {
  snapshot: DashboardSnapshot | null;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  snapshot: null,
  connected: false,
  channel: null,

  async loadViaRest() {
    const snapshot = await api.get<DashboardSnapshot>("/dashboard/today");
    set({ snapshot });
  },

  async connect() {
    const { channel } = await joinChannel("dashboard:lobby");
    set({ channel, connected: true });
    channel.on("snapshot", (snapshot: DashboardSnapshot) => {
      set({ snapshot });
    });
  },
}));
