import { create } from "zustand";
import { api } from "@/lib/api";
import { joinChannel } from "@/lib/ws";
import type { Channel } from "@/lib/ws";
import type { WindowState } from "@/types/workspace";

interface WorkspaceStore {
  windows: WindowState[];
  channel: Channel | null;
  load: () => Promise<void>;
  connect: () => Promise<void>;
  updateWindow: (appId: string, state: Partial<WindowState>) => Promise<void>;
  isOpen: (appId: string) => boolean;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  windows: [],
  channel: null,

  load: async () => {
    const res = await api.get<{ data: WindowState[] }>("/workspace");
    set({ windows: res.data });
  },

  connect: async () => {
    const { channel } = await joinChannel("workspace:state");
    channel.on("window_updated", (payload: WindowState) => {
      set((state) => {
        const idx = state.windows.findIndex((w) => w.app_id === payload.app_id);
        const updated = [...state.windows];
        if (idx >= 0) {
          updated[idx] = payload;
        } else {
          updated.push(payload);
        }
        return { windows: updated };
      });
    });
    set({ channel });
  },

  updateWindow: async (appId, attrs) => {
    await api.put(`/workspace/${appId}`, attrs);
  },

  isOpen: (appId) => {
    return get().windows.some((w) => w.app_id === appId && w.is_open);
  },
}));
