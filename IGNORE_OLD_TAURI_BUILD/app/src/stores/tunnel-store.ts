import { create } from "zustand";
import { api } from "@/lib/api";

export interface Tunnel {
  readonly pid: number;
  readonly local_port: number;
  readonly remote_host: string;
  readonly remote_port: number;
  readonly ssh_host: string;
  readonly status: "active" | "inactive" | "error";
}

interface TunnelState {
  tunnels: readonly Tunnel[];
  loading: boolean;
  error: string | null;
  loadViaRest: () => Promise<void>;
  createTunnel: (data: {
    local_port: number;
    remote_host: string;
    remote_port: number;
    ssh_host: string;
  }) => Promise<void>;
  killTunnel: (pid: number) => Promise<void>;
}

export const useTunnelStore = create<TunnelState>((set) => ({
  tunnels: [],
  loading: false,
  error: null,

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ tunnels: Tunnel[] }>("/tunnels");
      set({ tunnels: data.tunnels, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async createTunnel(payload) {
    try {
      const data = await api.post<{ tunnels: Tunnel[] }>("/tunnels", payload);
      set({ tunnels: data.tunnels });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  async killTunnel(pid) {
    try {
      await api.delete(`/tunnels/${pid}`);
      set((s) => ({ tunnels: s.tunnels.filter((t) => t.pid !== pid) }));
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
