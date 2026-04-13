import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { Pipe } from "@/types/pipes";

interface CatalogItem {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly schema: Record<string, unknown>;
}

interface PipesCatalog {
  readonly triggers: readonly CatalogItem[];
  readonly actions: readonly CatalogItem[];
  readonly transforms: readonly CatalogItem[];
}

interface PipesState {
  pipes: readonly Pipe[];
  systemPipes: readonly Pipe[];
  catalog: PipesCatalog | null;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  loadSystemPipes: () => Promise<void>;
  loadCatalog: () => Promise<void>;
  create: (data: {
    name: string;
    trigger_pattern: string;
    description?: string;
    project_id?: string | null;
  }) => Promise<void>;
  update: (id: string, data: Partial<Pipe>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggle: (id: string) => Promise<void>;
}

export const usePipesStore = create<PipesState>((set) => ({
  pipes: [],
  systemPipes: [],
  catalog: null,
  connected: false,
  channel: null,

  async loadViaRest() {
    const data = await api.get<{ pipes: Pipe[] }>("/pipes");
    set({ pipes: data.pipes });
  },

  async connect() {
    const { channel, response } = await joinChannel("pipes:editor");
    const data = response as { pipes: Pipe[] };
    set({ channel, connected: true, pipes: data.pipes });

    channel.on("pipe_created", (pipe: Pipe) => {
      set((state) => ({ pipes: [pipe, ...state.pipes] }));
    });

    channel.on("pipe_updated", (updated: Pipe) => {
      set((state) => ({
        pipes: state.pipes.map((p) => (p.id === updated.id ? updated : p)),
      }));
    });

    channel.on("pipe_deleted", (payload: { id: string }) => {
      set((state) => ({
        pipes: state.pipes.filter((p) => p.id !== payload.id),
      }));
    });
  },

  async loadSystemPipes() {
    const data = await api.get<{ pipes: Pipe[] }>("/pipes/system");
    set({ systemPipes: data.pipes });
  },

  async loadCatalog() {
    const data = await api.get<PipesCatalog>("/pipes/catalog");
    set({ catalog: data });
  },

  async create(data) {
    await api.post("/pipes", data);
  },

  async update(id, data) {
    await api.patch(`/pipes/${id}`, data);
  },

  async remove(id) {
    await api.delete(`/pipes/${id}`);
  },

  async toggle(id) {
    await api.post(`/pipes/${id}/toggle`, {});
  },
}));
