import { create } from "zustand";
import { api } from "@/lib/api";

export interface ObsidianNote {
  path: string;
  title: string;
  tags: string[];
  type: string | null;
  content: string; // preview or full content
}

export interface ObsidianNoteDetail extends ObsidianNote {
  frontmatter: Record<string, string>;
}

interface ObsidianVaultState {
  notes: ObsidianNote[];
  searchResults: ObsidianNote[];
  selectedNote: ObsidianNoteDetail | null;
  loading: boolean;
  searchLoading: boolean;
  error: string | null;
  activeTab: "recent" | "search";

  loadRecent: () => Promise<void>;
  search: (query: string) => Promise<void>;
  loadNote: (path: string) => Promise<void>;
  createNote: (path: string, content: string) => Promise<void>;
  setTab: (tab: "recent" | "search") => void;
  clearSelection: () => void;
}

export const useObsidianVaultStore = create<ObsidianVaultState>((set) => ({
  notes: [],
  searchResults: [],
  selectedNote: null,
  loading: false,
  searchLoading: false,
  error: null,
  activeTab: "recent",

  async loadRecent() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ notes: ObsidianNote[] }>("/obsidian/notes?limit=20");
      set({ notes: data.notes, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async search(query) {
    if (!query.trim()) return;
    set({ searchLoading: true, error: null });
    try {
      const data = await api.get<{ notes: ObsidianNote[] }>(
        `/obsidian/search?q=${encodeURIComponent(query)}`
      );
      set({ searchResults: data.notes, searchLoading: false, activeTab: "search" });
    } catch (e) {
      set({ error: String(e), searchLoading: false });
    }
  },

  async loadNote(path) {
    set({ loading: true });
    try {
      const data = await api.get<{ note: ObsidianNoteDetail }>(
        `/obsidian/notes/${encodeURIComponent(path)}`
      );
      set({ selectedNote: data.note, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async createNote(path, content) {
    await api.post("/obsidian/notes", { path, content });
  },

  setTab(tab) {
    set({ activeTab: tab });
  },

  clearSelection() {
    set({ selectedNote: null });
  },
}));
