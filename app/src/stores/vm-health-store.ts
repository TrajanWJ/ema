import { create } from "zustand";
import { api } from "@/lib/api";
import { joinChannel } from "@/lib/ws";
import type { Channel } from "phoenix";

interface Container {
  readonly ID?: string;
  readonly Names?: string;
  readonly Image?: string;
  readonly Status?: string;
  readonly State?: string;
  readonly Ports?: string;
}

interface VmHealth {
  readonly status: string;
  readonly openclaw_up: boolean;
  readonly ssh_up: boolean;
  readonly latency_ms: number | null;
  readonly containers: readonly Container[];
  readonly checked_at: string | null;
}

interface VmHealthState {
  health: VmHealth | null;
  loading: boolean;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  triggerCheck: () => Promise<void>;
}

export const useVmHealthStore = create<VmHealthState>((set, get) => ({
  health: null,
  loading: false,
  connected: false,
  channel: null,

  loadViaRest: async () => {
    set({ loading: true });
    try {
      const health = await api.get<VmHealth>("/vm/health");
      set({ health, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  connect: async () => {
    try {
      const { channel } = await joinChannel("intelligence:vm");
      channel.on("vm_health_checked", () => {
        get().loadViaRest();
      });
      set({ connected: true, channel });
    } catch {
      set({ connected: false });
    }
  },

  triggerCheck: async () => {
    try {
      await api.post("/vm/check", {});
      // Data will arrive via channel push
    } catch {
      // silent
    }
  },
}));
