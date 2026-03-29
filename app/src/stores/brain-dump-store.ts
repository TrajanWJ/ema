import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { InboxItem } from "@/types/brain-dump";

interface BrainDumpState {
  items: readonly InboxItem[];
  connected: boolean;
  channel: Channel | null;
  connect: () => Promise<void>;
  add: (content: string, source?: InboxItem["source"]) => Promise<void>;
  process: (id: string, action: InboxItem["action"]) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useBrainDumpStore = create<BrainDumpState>((set) => ({
  items: [],
  connected: false,
  channel: null,

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

  async add(content, source = "text") {
    await api.post("/brain-dump/items", { content, source });
  },

  async process(id, action) {
    await api.patch(`/brain-dump/items/${id}/process`, { action });
  },

  async remove(id) {
    await api.delete(`/brain-dump/items/${id}`);
  },
}));
