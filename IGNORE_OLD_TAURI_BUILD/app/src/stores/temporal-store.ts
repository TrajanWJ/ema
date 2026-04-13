import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { Rhythm, EnergyLog, TemporalContext, TimeSlot } from "@/types/temporal";

interface TemporalState {
  rhythms: readonly Rhythm[];
  context: TemporalContext | null;
  recentLogs: readonly EnergyLog[];
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  logEnergy: (energy: number, focus?: number, activityType?: string) => Promise<void>;
  getBestTime: (taskType: string) => Promise<readonly TimeSlot[]>;
}

export const useTemporalStore = create<TemporalState>((set) => ({
  rhythms: [],
  context: null,
  recentLogs: [],
  connected: false,
  channel: null,

  async loadViaRest() {
    const [rhythmData, contextData] = await Promise.all([
      api.get<{ rhythms: Rhythm[] }>("/temporal/rhythm"),
      api.get<{ context: TemporalContext }>("/temporal/now"),
    ]);
    set({ rhythms: rhythmData.rhythms, context: contextData.context });
  },

  async connect() {
    const { channel, response } = await joinChannel("temporal:dashboard");
    const data = response as {
      rhythms: Rhythm[];
      context: TemporalContext;
      recent_logs: EnergyLog[];
    };
    set({
      channel,
      connected: true,
      rhythms: data.rhythms,
      context: data.context,
      recentLogs: data.recent_logs,
    });

    channel.on("context_updated", (ctx: TemporalContext) => {
      set({ context: ctx });
    });

    channel.on("rhythm_updated", (rhythm: Rhythm) => {
      set((state) => ({
        rhythms: state.rhythms.some((r) => r.id === rhythm.id)
          ? state.rhythms.map((r) => (r.id === rhythm.id ? rhythm : r))
          : [...state.rhythms, rhythm],
      }));
    });

    channel.on("energy_logged", (log: EnergyLog) => {
      set((state) => ({
        recentLogs: [log, ...state.recentLogs].slice(0, 50),
      }));
    });
  },

  async logEnergy(energy, focus, activityType) {
    await api.post("/temporal/log", {
      energy_level: energy,
      focus_quality: focus,
      activity_type: activityType,
    });
  },

  async getBestTime(taskType) {
    const data = await api.get<{ slots: TimeSlot[] }>(`/temporal/best-time?for=${taskType}`);
    return data.slots;
  },
}));
