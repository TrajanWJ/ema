import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { Responsibility, CheckIn } from "@/types/responsibilities";

interface ResponsibilitiesState {
  responsibilities: readonly Responsibility[];
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  create: (data: {
    title: string;
    description?: string;
    role: string;
    cadence: string;
    project_id?: string | null;
  }) => Promise<void>;
  update: (id: string, data: Partial<Responsibility>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  checkIn: (id: string, status: CheckIn["status"], note?: string) => Promise<void>;
  byRole: (role: string) => readonly Responsibility[];
}

export const useResponsibilitiesStore = create<ResponsibilitiesState>((set, get) => ({
  responsibilities: [],
  connected: false,
  channel: null,

  async loadViaRest() {
    const data = await api.get<{ responsibilities: Responsibility[] }>("/responsibilities");
    set({ responsibilities: data.responsibilities });
  },

  async connect() {
    const { channel, response } = await joinChannel("responsibilities:lobby");
    const data = response as { responsibilities: Responsibility[] };
    set({ channel, connected: true, responsibilities: data.responsibilities });

    channel.on("responsibility_created", (item: Responsibility) => {
      set((state) => ({ responsibilities: [item, ...state.responsibilities] }));
    });

    channel.on("responsibility_updated", (updated: Responsibility) => {
      set((state) => ({
        responsibilities: state.responsibilities.map((r) =>
          r.id === updated.id ? updated : r
        ),
      }));
    });

    channel.on("responsibility_deleted", (payload: { id: string }) => {
      set((state) => ({
        responsibilities: state.responsibilities.filter((r) => r.id !== payload.id),
      }));
    });
  },

  async create(data) {
    await api.post("/responsibilities", data);
  },

  async update(id, data) {
    await api.patch(`/responsibilities/${id}`, data);
  },

  async remove(id) {
    await api.delete(`/responsibilities/${id}`);
  },

  async checkIn(id, status, note) {
    await api.post(`/responsibilities/${id}/check_in`, { status, note });
  },

  byRole(role) {
    return get().responsibilities.filter((r) => r.role === role);
  },
}));
