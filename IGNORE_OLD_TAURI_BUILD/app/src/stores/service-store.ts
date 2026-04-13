import { create } from "zustand";
import { api } from "@/lib/api";

export interface Service {
  readonly id: string;
  readonly name: string;
  readonly status: "running" | "stopped" | "error";
  readonly port: number | null;
  readonly pid: number | null;
  readonly uptime_seconds: number | null;
  readonly updated_at: string;
}

interface ServiceState {
  services: readonly Service[];
  loading: boolean;
  error: string | null;
  loadServices: () => Promise<void>;
  startService: (id: string) => Promise<void>;
  stopService: (id: string) => Promise<void>;
  restartService: (id: string) => Promise<void>;
}

export const useServiceStore = create<ServiceState>((set) => ({
  services: [],
  loading: false,
  error: null,

  async loadServices() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ services: Service[] }>("/services");
      set({ services: data.services, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async startService(id) {
    const svc = await api.post<Service>(`/services/${id}/start`, {});
    set((s) => ({
      services: s.services.map((sv) => (sv.id === id ? svc : sv)),
    }));
  },

  async stopService(id) {
    const svc = await api.post<Service>(`/services/${id}/stop`, {});
    set((s) => ({
      services: s.services.map((sv) => (sv.id === id ? svc : sv)),
    }));
  },

  async restartService(id) {
    const svc = await api.post<Service>(`/services/${id}/restart`, {});
    set((s) => ({
      services: s.services.map((sv) => (sv.id === id ? svc : sv)),
    }));
  },
}));
