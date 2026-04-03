import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { InboxItem } from "@/types/brain-dump";

interface BrainDumpState {
  items: readonly InboxItem[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  add: (content: string, source?: InboxItem["source"], projectId?: string | null) => Promise<void>;
  process: (id: string, action: InboxItem["action"]) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useBrainDumpStore = create<BrainDumpState>((set) => ({
  items: [],
  loading: false,
  error: null,
  connected: false,
  channel: null,

  async loadViaRest() {
    const data = await api.get<{ items: InboxItem[] }>("/brain-dump/items");
    set({ items: data.items });
  },

  async connect() {
    const { channel, response } = await joinChannel("brain_dump:queue");
    const data = response as { items: InboxItem[] };
    set({ channel, connected: true, items: data.items });

    channel.on("item_created", (item: InboxItem) => {
      set((state) => ({ items: [item, ...state.items] }));
    });

    channel.on("item_processed", (updated: InboxItem) => {
      set((state) => ({
        items: state.items.map((item) => (item.id === updated.id ? updated : item)),
      }));
    });

    channel.on("item_deleted", (payload: { id: string }) => {
      set((state) => ({
        items: state.items.filter((item) => item.id !== payload.id),
      }));
    });
  },

  async add(content, source = "text", projectId = null) {
    await api.post("/brain-dump/items", { content, source, project_id: projectId });
  },

  async process(id, action) {
    await api.patch(`/brain-dump/items/${id}/process`, { action });
  },

  async remove(id) {
    await api.delete(`/brain-dump/items/${id}`);
  },
}));
