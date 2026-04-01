import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { FocusSession, FocusBlock, FocusTodayStats } from "@/types/focus";

interface FocusState {
  currentSession: FocusSession | null;
  history: readonly FocusSession[];
  todayStats: FocusTodayStats;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  startSession: (targetMs?: number) => Promise<void>;
  endSession: (id: string) => Promise<void>;
  addBlock: (sessionId: string, blockType: "work" | "break") => Promise<void>;
  endBlock: (blockId: string) => Promise<void>;
}

const DEFAULT_TODAY: FocusTodayStats = {
  sessions_count: 0,
  completed_count: 0,
  total_work_ms: 0,
};

export const useFocusStore = create<FocusState>((set) => ({
  currentSession: null,
  history: [],
  todayStats: DEFAULT_TODAY,
  connected: false,
  channel: null,

  async loadViaRest() {
    const [currentData, historyData, todayData] = await Promise.all([
      api.get<{ session: FocusSession | null }>("/focus/current"),
      api.get<{ sessions: FocusSession[] }>("/focus/sessions"),
      api.get<FocusTodayStats>("/focus/today"),
    ]);
    set({
      currentSession: currentData.session,
      history: historyData.sessions,
      todayStats: todayData,
    });
  },

  async connect() {
    const { channel, response } = await joinChannel("focus:timer");
    const data = response as {
      current_session: FocusSession | null;
      today_stats: FocusTodayStats;
    };
    set({
      channel,
      connected: true,
      currentSession: data.current_session,
      todayStats: data.today_stats,
    });

    channel.on("session_started", (session: FocusSession) => {
      set({ currentSession: session });
    });

    channel.on("session_ended", (session: FocusSession) => {
      set((state) => ({
        currentSession: null,
        history: [session, ...state.history],
        todayStats: {
          ...state.todayStats,
          completed_count: state.todayStats.completed_count + 1,
        },
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
          todayStats:
            block.block_type === "work" && block.elapsed_ms
              ? {
                  ...state.todayStats,
                  total_work_ms: state.todayStats.total_work_ms + block.elapsed_ms,
                }
              : state.todayStats,
        };
      });
    });
  },

  async startSession(targetMs) {
    const body = targetMs ? { target_ms: targetMs } : {};
    const session = await api.post<FocusSession>("/focus/sessions", body);
    set({ currentSession: session });
  },

  async endSession(id) {
    const session = await api.post<FocusSession>(`/focus/sessions/${id}/stop`, {});
    set((state) => ({
      currentSession: null,
      history: [session, ...state.history],
    }));
  },

  async addBlock(sessionId, blockType) {
    const block = await api.post<FocusBlock>(`/focus/sessions/${sessionId}/blocks`, {
      block_type: blockType,
    });
    set((state) => {
      if (!state.currentSession) return state;
      return {
        currentSession: {
          ...state.currentSession,
          blocks: [...state.currentSession.blocks, block],
        },
      };
    });
  },

  async endBlock(blockId) {
    const block = await api.post<FocusBlock>(`/focus/blocks/${blockId}/end`, {});
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
  },
}));
