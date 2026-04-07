import { create } from "zustand";
import type { Space } from "../api/hq";
import * as hq from "../api/hq";

export type { Space };

interface SpaceStore {
  spaces: Space[];
  activeSpaceId: string | null;
  loading: boolean;
  error: string | null;

  loadSpaces: () => Promise<void>;
  setActiveSpace: (id: string | null) => void;
  createSpace: (data: { org_id: string; name: string; space_type: string; icon?: string; color?: string }) => Promise<Space>;
  getActiveSpace: () => Space | null;
}

export const useSpaceStore = create<SpaceStore>((set, get) => ({
  spaces: [],
  activeSpaceId: localStorage.getItem("hq_active_space") || null,
  loading: false,
  error: null,

  getActiveSpace() {
    const { spaces, activeSpaceId } = get();
    return spaces.find((s) => s.id === activeSpaceId) ?? null;
  },

  async loadSpaces() {
    set({ loading: true, error: null });
    try {
      const data = await hq.getSpaces();
      set({ spaces: data.spaces, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  setActiveSpace(id) {
    set({ activeSpaceId: id });
    if (id) localStorage.setItem("hq_active_space", id);
    else localStorage.removeItem("hq_active_space");
  },

  async createSpace(data) {
    const space = await hq.createSpace(data);
    set((state) => ({ spaces: [space, ...state.spaces] }));
    return space;
  },
}));
