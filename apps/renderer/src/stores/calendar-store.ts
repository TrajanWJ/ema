import { create } from "zustand";
import { api } from "@/lib/api";
import type { CalendarEntry, CalendarEntryKind, CalendarEntryStatus } from "@/types/calendar";

interface CalendarFilters {
  readonly owner_kind?: "human" | "agent";
  readonly owner_id?: string;
  readonly status?: CalendarEntryStatus;
  readonly entry_kind?: CalendarEntryKind;
  readonly goal_id?: string;
  readonly intent_slug?: string;
  readonly from?: string;
  readonly to?: string;
  readonly buildout_id?: string;
}

interface CreateCalendarEntryInput {
  readonly title: string;
  readonly description?: string | null;
  readonly entry_kind: CalendarEntryKind;
  readonly status?: CalendarEntryStatus;
  readonly owner_kind?: "human" | "agent";
  readonly owner_id?: string;
  readonly starts_at: string;
  readonly ends_at?: string | null;
  readonly phase?: "idle" | "plan" | "execute" | "review" | "retro" | null;
  readonly goal_id?: string | null;
  readonly task_id?: string | null;
  readonly project_id?: string | null;
  readonly space_id?: string | null;
  readonly intent_slug?: string | null;
  readonly execution_id?: string | null;
  readonly location?: string | null;
}

interface UpdateCalendarEntryInput {
  readonly title?: string;
  readonly description?: string | null;
  readonly entry_kind?: CalendarEntryKind;
  readonly status?: CalendarEntryStatus;
  readonly owner_kind?: "human" | "agent";
  readonly owner_id?: string;
  readonly starts_at?: string;
  readonly ends_at?: string | null;
  readonly phase?: "idle" | "plan" | "execute" | "review" | "retro" | null;
  readonly goal_id?: string | null;
  readonly task_id?: string | null;
  readonly project_id?: string | null;
  readonly space_id?: string | null;
  readonly intent_slug?: string | null;
  readonly execution_id?: string | null;
  readonly location?: string | null;
}

interface CalendarState {
  entries: readonly CalendarEntry[];
  loading: boolean;
  error: string | null;
  loadViaRest: (filters?: CalendarFilters) => Promise<void>;
  createEntry: (input: CreateCalendarEntryInput) => Promise<CalendarEntry>;
  updateEntry: (id: string, input: UpdateCalendarEntryInput) => Promise<CalendarEntry>;
  removeEntry: (id: string) => Promise<void>;
}

function sortEntries(entries: readonly CalendarEntry[]): CalendarEntry[] {
  return [...entries].sort(
    (left, right) =>
      new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
  );
}

function toQueryString(filters: CalendarFilters): string {
  const params = new URLSearchParams();
  if (filters.owner_kind) params.set("owner_kind", filters.owner_kind);
  if (filters.owner_id) params.set("owner_id", filters.owner_id);
  if (filters.status) params.set("status", filters.status);
  if (filters.entry_kind) params.set("entry_kind", filters.entry_kind);
  if (filters.goal_id) params.set("goal_id", filters.goal_id);
  if (filters.intent_slug) params.set("intent_slug", filters.intent_slug);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.buildout_id) params.set("buildout_id", filters.buildout_id);
  const query = params.toString();
  return query.length > 0 ? `?${query}` : "";
}

export const useCalendarStore = create<CalendarState>((set) => ({
  entries: [],
  loading: false,
  error: null,

  async loadViaRest(filters = {}) {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ entries: CalendarEntry[] }>(
        `/calendar${toQueryString(filters)}`,
      );
      set({ entries: sortEntries(data.entries), loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "calendar_load_failed",
      });
    }
  },

  async createEntry(input) {
    const entry = await api.post<CalendarEntry>("/calendar", input);
    set((state) => ({ entries: sortEntries([...state.entries, entry]) }));
    return entry;
  },

  async updateEntry(id, input) {
    const updated = await api.put<CalendarEntry>(`/calendar/${id}`, input);
    set((state) => ({
      entries: sortEntries(
        state.entries.map((entry) => (entry.id === id ? updated : entry)),
      ),
    }));
    return updated;
  },

  async removeEntry(id) {
    await api.delete(`/calendar/${id}`);
    set((state) => ({
      entries: state.entries.filter((entry) => entry.id !== id),
    }));
  },
}));
