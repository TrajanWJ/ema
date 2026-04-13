import { create } from "zustand";
import { api } from "@/lib/api";

export interface Clip {
  readonly id: string;
  readonly content: string;
  readonly content_type: "text" | "code" | "url" | "image";
  readonly source: "manual" | "agent" | "pipe";
  readonly pinned: boolean;
  readonly expires_at: string | null;
  readonly inserted_at: string;
}

interface ClipboardState {
  clips: readonly Clip[];
  loading: boolean;
  error: string | null;
  loadViaRest: () => Promise<void>;
  createClip: (data: {
    content: string;
    content_type: Clip["content_type"];
  }) => Promise<void>;
  pinClip: (id: string) => Promise<void>;
  deleteClip: (id: string) => Promise<void>;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  clips: [],
  loading: false,
  error: null,

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ clips: Clip[] }>("/clipboard");
      set({ clips: data.clips, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async createClip(payload) {
    try {
      const data = await api.post<{ clips: Clip[] }>("/clipboard", payload);
      set({ clips: data.clips });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  async pinClip(id) {
    try {
      const data = await api.post<{ clips: Clip[] }>(
        `/clipboard/${id}/pin`,
        {},
      );
      set({ clips: data.clips });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  async deleteClip(id) {
    try {
      await api.delete(`/clipboard/${id}`);
      set((s) => ({ clips: s.clips.filter((c) => c.id !== id) }));
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
