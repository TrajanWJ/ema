import { create } from "zustand";
import { api } from "@/lib/api";

export interface Tunnel {
  readonly id: string;
  readonly name: string;
  readonly local_port: number;
  readonly public_url: string;
  readonly status: "active" | "inactive" | "error";
  readonly created_at: string;
}

interface TunnelState {
  tunnels: readonly Tunnel[];
  loading: boolean;
  error: string | null;
  loadTunnels: () => Promise<void>;
  createTunnel: (name: string, local_port: number) => Promise<void>;
  deleteTunnel: (id: string) => Promise<void>;
}

export const useTunnelStore = create<TunnelState>((set) => ({
  tunnels: [],
  loading: false,
  error: null,

  async loadTunnels() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ tunnels: Tunnel[] }>("/tunnels");
      set({ tunnels: data.tunnels, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async createTunnel(name, local_port) {
    const tunnel = await api.post<Tunnel>("/tunnels", { name, local_port });
    set((s) => ({ tunnels: [tunnel, ...s.tunnels] }));
  },

  async deleteTunnel(id) {
    await api.delete(`/tunnels/${id}`);
    set((s) => ({ tunnels: s.tunnels.filter((t) => t.id !== id) }));
  },
}));
