import { create } from "zustand";
import { api } from "@/lib/api";

export interface AgendaItem {
  readonly topic: string;
  readonly duration_min: number;
  readonly presenter: string;
}

export interface Meeting {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly scheduled_at: string;
  readonly starts_at: string;
  readonly ends_at: string | null;
  readonly attendees: readonly string[];
  readonly agenda: readonly AgendaItem[];
  readonly location: string | null;
  readonly project_id: string | null;
  readonly notes: string | null;
  readonly status: "scheduled" | "in_progress" | "completed" | "cancelled";
  readonly inserted_at: string;
}

interface MeetingState {
  meetings: readonly Meeting[];
  loading: boolean;
  error: string | null;
  loadViaRest: () => Promise<void>;
  createMeeting: (attrs: {
    title: string;
    scheduled_at: string;
    starts_at?: string;
    ends_at?: string;
    location?: string;
    notes?: string;
    attendees?: string[];
    agenda?: { topic: string; duration_min: number; presenter: string }[];
  }) => Promise<void>;
  updateMeeting: (
    id: string,
    attrs: Partial<Omit<Meeting, "id" | "inserted_at">>,
  ) => Promise<void>;
  deleteMeeting: (id: string) => Promise<void>;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  meetings: [],
  loading: false,
  error: null,

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ meetings: Meeting[] }>("/meetings");
      set({ meetings: data.meetings, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async createMeeting(attrs) {
    await api.post<{ meeting: Meeting }>("/meetings", { meeting: attrs });
    await useMeetingStore.getState().loadViaRest();
  },

  async updateMeeting(id, attrs) {
    await api.put<{ meeting: Meeting }>(`/meetings/${id}`, {
      meeting: attrs,
    });
    await useMeetingStore.getState().loadViaRest();
  },

  async deleteMeeting(id) {
    await api.delete(`/meetings/${id}`);
    set((s) => ({
      meetings: s.meetings.filter((m) => m.id !== id),
    }));
  },
}));
