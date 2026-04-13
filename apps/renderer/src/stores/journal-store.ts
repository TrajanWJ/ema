import { create } from "zustand";
import { api } from "@/lib/api";
import { todayStr } from "@/lib/date-utils";
import type { JournalEntry } from "@/types/journal";

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

interface JournalState {
  currentDate: string;
  currentEntry: JournalEntry | null;
  loading: boolean;
  dirty: boolean;
  loadEntry: (date?: string) => Promise<void>;
  setCurrentDate: (date: string) => Promise<void>;
  updateField: (field: string, value: string | number | null) => void;
  save: () => Promise<void>;
}

export const useJournalStore = create<JournalState>((set, get) => ({
  currentDate: todayStr(),
  currentEntry: null,
  loading: false,
  dirty: false,

  async loadEntry(date?: string) {
    const target = date ?? get().currentDate;
    set({ loading: true });
    const entry = await api.get<JournalEntry>(`/journal/${target}`);
    set({ currentEntry: entry, loading: false, dirty: false, currentDate: target });
  },

  async setCurrentDate(date: string) {
    const state = get();
    if (state.dirty) {
      await state.save();
    }
    await state.loadEntry(date);
  },

  updateField(field, value) {
    const entry = get().currentEntry;
    if (!entry) return;

    set({
      currentEntry: { ...entry, [field]: value },
      dirty: true,
    });

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      get().save();
    }, 600);
  },

  async save() {
    const { currentEntry, currentDate } = get();
    if (!currentEntry) return;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    const updated = await api.put<JournalEntry>(`/journal/${currentDate}`, {
      content: currentEntry.content,
      one_thing: currentEntry.one_thing,
      mood: currentEntry.mood,
      energy_p: currentEntry.energy_p,
      energy_m: currentEntry.energy_m,
      energy_e: currentEntry.energy_e,
      gratitude: currentEntry.gratitude,
      tags: currentEntry.tags,
    });

    set({ currentEntry: updated, dirty: false });
  },
}));
