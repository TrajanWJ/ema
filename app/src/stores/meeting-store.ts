import { create } from "zustand";
import { api } from "@/lib/api";

export interface AgendaItem {
  readonly topic: string;
  readonly duration_min: number;
  readonly presenter: string;
}

export interface ActionItem {
  readonly id: string;
  readonly description: string;
  readonly assignee: string;
  readonly done: boolean;
}

export interface Meeting {
  readonly id: string;
  readonly title: string;
  readonly agenda: readonly AgendaItem[];
  readonly attendees: readonly string[];
  readonly scheduled_at: string;
  readonly notes: string;
  readonly action_items: readonly ActionItem[];
  readonly status: "scheduled" | "in_progress" | "completed" | "cancelled";
}

interface MeetingState {
  meetings: readonly Meeting[];
  loading: boolean;
  error: string | null;
  loadMeetings: () => Promise<void>;
  createMeeting: (data: Omit<Meeting, "id" | "action_items" | "notes" | "status">) => Promise<void>;
  updateMeeting: (id: string, data: Partial<Meeting>) => Promise<void>;
  deleteMeeting: (id: string) => Promise<void>;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  meetings: [],
  loading: false,
  error: null,

  async loadMeetings() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ meetings: Meeting[] }>("/meetings");
      set({ meetings: data.meetings, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async createMeeting(data) {
    await api.post("/meetings", { meeting: data });
    const res = await api.get<{ meetings: Meeting[] }>("/meetings");
    set({ meetings: res.meetings });
  },

  async updateMeeting(id, data) {
    await api.patch(`/meetings/${id}`, { meeting: data });
    const res = await api.get<{ meetings: Meeting[] }>("/meetings");
    set({ meetings: res.meetings });
  },

  async deleteMeeting(id) {
    await api.delete(`/meetings/${id}`);
    set((s) => ({ meetings: s.meetings.filter((m) => m.id !== id) }));
  },
}));
