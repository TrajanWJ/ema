import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { VaultNote, VaultGraph } from "@/types/vault";

interface VaultState {
  notes: readonly VaultNote[];
  graph: VaultGraph | null;
  searchResults: readonly VaultNote[];
  selectedNote: (VaultNote & { content?: string }) | null;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  search: (query: string, space?: string) => Promise<void>;
  loadNote: (path: string) => Promise<void>;
  updateNote: (path: string, content: string) => Promise<void>;
  loadGraph: (filters?: Record<string, string>) => Promise<void>;
}

export const useVaultStore = create<VaultState>((set) => ({
  notes: [],
  graph: null,
  searchResults: [],
  selectedNote: null,
  connected: false,
  channel: null,

  async loadViaRest() {
    const data = await api.get<{ tree: VaultNote[] }>("/vault/tree");
    set({ notes: data.tree });
  },

  async connect() {
    const { channel, response } = await joinChannel("vault:files");
    const data = response as { tree: VaultNote[] };
    set({ channel, connected: true, notes: data.tree });

    channel.on("note_created", (note: VaultNote) => {
      set((state) => ({ notes: [note, ...state.notes] }));
    });

    channel.on("note_updated", (updated: VaultNote) => {
      set((state) => ({
        notes: state.notes.map((n) => (n.id === updated.id ? updated : n)),
      }));
    });

    channel.on("note_deleted", (payload: { id: string }) => {
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== payload.id),
      }));
    });
  },

  async search(query, space) {
    const params = new URLSearchParams({ q: query });
    if (space) params.set("space", space);
    const data = await api.get<{ results: VaultNote[] }>(`/vault/search?${params}`);
    set({ searchResults: data.results });
  },

  async loadNote(path) {
    const data = await api.get<{ note: VaultNote & { content: string } }>(
      `/vault/note?path=${encodeURIComponent(path)}`
    );
    set({ selectedNote: data.note });
  },

  async updateNote(path, content) {
    await api.put("/vault/note", { path, content });
  },

  async loadGraph(filters) {
    const params = filters ? `?${new URLSearchParams(filters)}` : "";
    const data = await api.get<VaultGraph>(`/vault/graph${params}`);
    set({ graph: data });
  },
}));
