import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type {
  FocusSession,
  FocusBlock,
  FocusTodayStats,
  FocusWeeklyStats,
  FocusPhase,
} from "@/types/focus";

interface FocusState {
  currentSession: FocusSession | null;
  phase: FocusPhase;
  elapsedMs: number;
  blockElapsedMs: number;
  workMs: number;
  breakMs: number;
  history: readonly FocusSession[];
  todayStats: FocusTodayStats;
  weeklyStats: FocusWeeklyStats;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  startSession: (targetMs?: number, taskId?: string) => Promise<void>;
  stopSession: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  takeBreak: () => Promise<void>;
  resumeWork: () => Promise<void>;
}

const DEFAULT_TODAY: FocusTodayStats = {
  sessions_count: 0,
  completed_count: 0,
  total_work_ms: 0,
};

const DEFAULT_WEEKLY: FocusWeeklyStats = {
  sessions_count: 0,
  total_work_ms: 0,
  streak_days: 0,
};

export const useFocusStore = create<FocusState>((set) => ({
  currentSession: null,
  phase: "idle" as FocusPhase,
  elapsedMs: 0,
  blockElapsedMs: 0,
  workMs: 45 * 60 * 1000,
  breakMs: 15 * 60 * 1000,
  history: [],
  todayStats: DEFAULT_TODAY,
  weeklyStats: DEFAULT_WEEKLY,
  connected: false,
  channel: null,

  async loadViaRest() {
    const [currentData, historyData, todayData, weeklyData] = await Promise.all([
      api.get<{ session: FocusSession | null; timer: { phase: string; elapsed_ms: number; block_elapsed_ms: number; work_ms: number; break_ms: number } }>("/focus/current"),
      api.get<{ sessions: FocusSession[] }>("/focus/sessions"),
      api.get<FocusTodayStats>("/focus/today"),
      api.get<FocusWeeklyStats>("/focus/weekly"),
    ]);
    set({
      currentSession: currentData.session,
      phase: (currentData.timer?.phase as FocusPhase) ?? "idle",
      elapsedMs: currentData.timer?.elapsed_ms ?? 0,
      blockElapsedMs: currentData.timer?.block_elapsed_ms ?? 0,
      workMs: currentData.timer?.work_ms ?? 45 * 60 * 1000,
      breakMs: currentData.timer?.break_ms ?? 15 * 60 * 1000,
      history: historyData.sessions,
      todayStats: todayData,
      weeklyStats: weeklyData,
    });
  },

  async connect() {
    const { channel, response } = await joinChannel("focus:timer");
    const data = response as {
      current_session: FocusSession | null;
      today_stats: FocusTodayStats;
      timer: { phase: string; elapsed_ms: number; block_elapsed_ms: number; work_ms: number; break_ms: number };
    };
    set({
      channel,
      connected: true,
      currentSession: data.current_session,
      todayStats: data.today_stats,
      phase: (data.timer?.phase as FocusPhase) ?? "idle",
      elapsedMs: data.timer?.elapsed_ms ?? 0,
      blockElapsedMs: data.timer?.block_elapsed_ms ?? 0,
      workMs: data.timer?.work_ms ?? 45 * 60 * 1000,
      breakMs: data.timer?.break_ms ?? 15 * 60 * 1000,
    });

    // Server-driven tick every second
    channel.on("tick", (payload: {
      phase: string;
      elapsed_ms: number;
      block_elapsed_ms: number;
      work_ms: number;
      break_ms: number;
      session: FocusSession | null;
    }) => {
      set({
        phase: payload.phase as FocusPhase,
        elapsedMs: payload.elapsed_ms,
        blockElapsedMs: payload.block_elapsed_ms,
        workMs: payload.work_ms,
        breakMs: payload.break_ms,
        currentSession: payload.session,
      });
    });

    channel.on("phase_change", (payload: { phase: string }) => {
      set({ phase: payload.phase as FocusPhase });
    });

    channel.on("session_started", (session: FocusSession) => {
      set({ currentSession: session, phase: "focusing" });
    });

    channel.on("session_ended", (payload: { session: FocusSession; today_stats: FocusTodayStats }) => {
      set((state) => ({
        currentSession: null,
        phase: "idle" as FocusPhase,
        elapsedMs: 0,
        blockElapsedMs: 0,
        history: [payload.session, ...state.history],
        todayStats: payload.today_stats,
      }));
    });

    channel.on("block_added", (block: FocusBlock) => {
      set((state) => {
        if (!state.currentSession) return state;
        return {
          currentSession: {
            ...state.currentSession,
            blocks: [...state.currentSession.blocks, block],
          },
        };
      });
    });

    channel.on("block_ended", (block: FocusBlock) => {
      set((state) => {
        if (!state.currentSession) return state;
        return {
          currentSession: {
            ...state.currentSession,
            blocks: state.currentSession.blocks.map((b) =>
              b.id === block.id ? block : b
            ),
          },
        };
      });
    });
  },

  async startSession(targetMs, taskId) {
    const body: Record<string, unknown> = {};
    if (targetMs) body.target_ms = targetMs;
    if (taskId) body.task_id = taskId;
    const session = await api.post<FocusSession>("/focus/start", body);
    set({ currentSession: session, phase: "focusing" });
  },

  async stopSession() {
    const session = await api.post<FocusSession>("/focus/stop", {});
    set((state) => ({
      currentSession: null,
      phase: "idle" as FocusPhase,
      elapsedMs: 0,
      blockElapsedMs: 0,
      history: [session, ...state.history],
    }));
  },

  async pause() {
    await api.post("/focus/pause", {});
    set({ phase: "paused" });
  },

  async resume() {
    await api.post("/focus/resume", {});
    set({ phase: "focusing" });
  },

  async takeBreak() {
    await api.post("/focus/break", {});
    set({ phase: "break" });
  },

  async resumeWork() {
    await api.post("/focus/resume-work", {});
    set({ phase: "focusing" });
  },
}));
