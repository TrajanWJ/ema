import { create } from "zustand";
import { api } from "@/lib/api";

export interface Clip {
  readonly id: string;
  readonly content: string;
  readonly content_type: "text" | "image" | "link";
  readonly device: string;
  readonly pinned: boolean;
  readonly expires_at: string | null;
  readonly created_at: string;
}

interface ClipboardState {
  clips: readonly Clip[];
  loading: boolean;
  error: string | null;
  loadClips: () => Promise<void>;
  createClip: (content: string, content_type: Clip["content_type"]) => Promise<void>;
  pinClip: (id: string, pinned: boolean) => Promise<void>;
  deleteClip: (id: string) => Promise<void>;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  clips: [],
  loading: false,
  error: null,

  async loadClips() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ clips: Clip[] }>("/clipboard/clips");
      set({ clips: data.clips, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async createClip(content, content_type) {
    const clip = await api.post<Clip>("/clipboard/clips", { content, content_type });
    set((s) => ({ clips: [clip, ...s.clips] }));
  },

  async pinClip(id, pinned) {
    await api.patch(`/clipboard/clips/${id}`, { pinned });
    set((s) => ({
      clips: s.clips.map((c) => (c.id === id ? { ...c, pinned } : c)),
    }));
  },

  async deleteClip(id) {
    await api.delete(`/clipboard/clips/${id}`);
    set((s) => ({ clips: s.clips.filter((c) => c.id !== id) }));
  },
}));
