import { create } from "zustand";

import { api } from "@/lib/api";
import type { HumanOpsAgenda, HumanOpsDailyBrief, HumanOpsDay } from "@/types/human-ops";

interface HumanOpsState {
  days: Record<string, HumanOpsDay>;
  briefs: Record<string, HumanOpsDailyBrief>;
  agendas: Record<string, HumanOpsAgenda>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  storageMode: "unknown" | "backend" | "local";
  loadDay: (dateKey: string) => Promise<void>;
  loadBrief: (dateKey: string) => Promise<void>;
  loadAgenda: (dateKey: string, horizonDays?: number) => Promise<void>;
  hydrateDay: (dateKey: string) => Promise<void>;
  setPlan: (dateKey: string, plan: string) => Promise<void>;
  setLinkedGoal: (dateKey: string, goalId: string | null) => Promise<void>;
  setNowTask: (dateKey: string, taskId: string | null) => Promise<void>;
  togglePinnedTask: (dateKey: string, taskId: string) => Promise<void>;
  setReviewNote: (dateKey: string, reviewNote: string) => Promise<void>;
  resetDay: (dateKey: string) => Promise<void>;
}

function emptyDay(dateKey: string): HumanOpsDay {
  const now = new Date().toISOString();
  return {
    date: dateKey,
    plan: "",
    linked_goal_id: null,
    now_task_id: null,
    pinned_task_ids: [],
    review_note: "",
    created_at: now,
    updated_at: now,
  };
}

async function putDay(dateKey: string, patch: Record<string, unknown>): Promise<HumanOpsDay> {
  return api.put<HumanOpsDay>(`/human-ops/day/${dateKey}`, patch);
}

function updateCachedDay(
  state: HumanOpsState,
  dateKey: string,
  day: HumanOpsDay,
): Pick<HumanOpsState, "days" | "briefs"> {
  return {
    days: {
      ...state.days,
      [dateKey]: day,
    },
    briefs: state.briefs[dateKey]
      ? {
          ...state.briefs,
          [dateKey]: {
            ...state.briefs[dateKey],
            day,
          },
        }
      : state.briefs,
  };
}

export const useHumanOpsStore = create<HumanOpsState>((set, get) => ({
  days: {},
  briefs: {},
  agendas: {},
  loading: false,
  saving: false,
  error: null,
  storageMode: "unknown",

  async loadDay(dateKey) {
    set({ loading: true, error: null });
    try {
      const day = await api.get<HumanOpsDay>(`/human-ops/day/${dateKey}`);
      set((state) => ({
        loading: false,
        storageMode: "backend",
        ...updateCachedDay(state, dateKey, day),
      }));
    } catch (error) {
      set((state) => ({
        loading: false,
        storageMode: "local",
        error: error instanceof Error ? error.message : "human_ops_day_load_failed",
        days: state.days[dateKey]
          ? state.days
          : {
              ...state.days,
              [dateKey]: emptyDay(dateKey),
            },
      }));
    }
  },

  async loadBrief(dateKey) {
    try {
      const brief = await api.get<HumanOpsDailyBrief>(`/human-ops/brief/${dateKey}`);
      set((state) => ({
        storageMode: "backend",
        briefs: {
          ...state.briefs,
          [dateKey]: brief,
        },
        days: {
          ...state.days,
          [dateKey]: brief.day,
        },
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "human_ops_brief_load_failed",
      });
    }
  },

  async loadAgenda(dateKey, horizonDays = 7) {
    try {
      const agenda = await api.get<HumanOpsAgenda>(
        `/human-ops/agenda/${dateKey}?days=${horizonDays}`,
      );
      set((state) => ({
        storageMode: "backend",
        agendas: {
          ...state.agendas,
          [`${dateKey}:${horizonDays}`]: agenda,
        },
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "human_ops_agenda_load_failed",
      });
    }
  },

  async hydrateDay(dateKey) {
    await Promise.all([get().loadDay(dateKey), get().loadBrief(dateKey), get().loadAgenda(dateKey, 7)]);
  },

  async setPlan(dateKey, plan) {
    set({ saving: true, error: null });
    try {
      const day = await putDay(dateKey, { plan });
      set((state) => ({
        saving: false,
        storageMode: "backend",
        ...updateCachedDay(state, dateKey, day),
      }));
    } catch (error) {
      set({
        saving: false,
        storageMode: "local",
        error: error instanceof Error ? error.message : "human_ops_plan_failed",
      });
    }
  },

  async setLinkedGoal(dateKey, goalId) {
    set({ saving: true, error: null });
    try {
      const day = await putDay(dateKey, { linked_goal_id: goalId });
      set((state) => ({
        saving: false,
        storageMode: "backend",
        ...updateCachedDay(state, dateKey, day),
      }));
      await get().loadBrief(dateKey);
    } catch (error) {
      set({
        saving: false,
        storageMode: "local",
        error: error instanceof Error ? error.message : "human_ops_goal_link_failed",
      });
    }
  },

  async setNowTask(dateKey, taskId) {
    set({ saving: true, error: null });
    try {
      const current = get().days[dateKey] ?? emptyDay(dateKey);
      const pinned_task_ids =
        taskId && !current.pinned_task_ids.includes(taskId)
          ? [taskId, ...current.pinned_task_ids]
          : [...current.pinned_task_ids];
      const day = await putDay(dateKey, {
        now_task_id: taskId,
        pinned_task_ids,
      });
      set((state) => ({
        saving: false,
        storageMode: "backend",
        ...updateCachedDay(state, dateKey, day),
      }));
      await get().loadBrief(dateKey);
    } catch (error) {
      set({
        saving: false,
        storageMode: "local",
        error: error instanceof Error ? error.message : "human_ops_now_task_failed",
      });
    }
  },

  async togglePinnedTask(dateKey, taskId) {
    set({ saving: true, error: null });
    try {
      const current = get().days[dateKey] ?? emptyDay(dateKey);
      const exists = current.pinned_task_ids.includes(taskId);
      const pinned_task_ids = exists
        ? current.pinned_task_ids.filter((candidate) => candidate !== taskId)
        : [taskId, ...current.pinned_task_ids];
      const now_task_id = current.now_task_id === taskId && exists ? null : current.now_task_id;
      const day = await putDay(dateKey, { pinned_task_ids, now_task_id });
      set((state) => ({
        saving: false,
        storageMode: "backend",
        ...updateCachedDay(state, dateKey, day),
      }));
      await get().loadBrief(dateKey);
    } catch (error) {
      set({
        saving: false,
        storageMode: "local",
        error: error instanceof Error ? error.message : "human_ops_pin_failed",
      });
    }
  },

  async setReviewNote(dateKey, reviewNote) {
    set({ saving: true, error: null });
    try {
      const day = await putDay(dateKey, { review_note: reviewNote });
      set((state) => ({
        saving: false,
        storageMode: "backend",
        ...updateCachedDay(state, dateKey, day),
      }));
    } catch (error) {
      set({
        saving: false,
        storageMode: "local",
        error: error instanceof Error ? error.message : "human_ops_review_note_failed",
      });
    }
  },

  async resetDay(dateKey) {
    set({ saving: true, error: null });
    try {
      const day = await putDay(dateKey, {
        plan: "",
        linked_goal_id: null,
        now_task_id: null,
        pinned_task_ids: [],
        review_note: "",
      });
      set((state) => ({
        saving: false,
        storageMode: "backend",
        ...updateCachedDay(state, dateKey, day),
      }));
      await get().loadBrief(dateKey);
    } catch (error) {
      set({
        saving: false,
        storageMode: "local",
        error: error instanceof Error ? error.message : "human_ops_reset_failed",
      });
    }
  },
}));
