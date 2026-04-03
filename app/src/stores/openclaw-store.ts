import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";

interface OpenClawSession {
  readonly id: string;
  readonly agent_type?: string;
  readonly status?: string;
  readonly created_at?: string;
}

interface OpenClawStatus {
  readonly connected: boolean;
  readonly last_check: string | null;
  readonly session_count: number;
  readonly error: string | null;
}

interface OpenClawState {
  status: OpenClawStatus;
  sessions: readonly OpenClawSession[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  sendMessage: (sessionId: string, content: string) => Promise<void>;
  dispatch: (agentType: string, opts?: Record<string, unknown>) => Promise<void>;
}

export const useOpenClawStore = create<OpenClawState>((set) => ({
  status: { connected: false, last_check: null, session_count: 0, error: null },
  sessions: [],
  loading: false,
  error: null,
  connected: false,
  channel: null,

  async loadViaRest() {
    try {
      set({ loading: true });
      const [statusData, sessionsData] = await Promise.all([
        api.get<OpenClawStatus>("/openclaw/status"),
        api.get<{ sessions: OpenClawSession[] }>("/openclaw/sessions").catch(() => ({ sessions: [] })),
      ]);
      set({ status: statusData, sessions: sessionsData.sessions, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load", loading: false });
    }
  },

  async connect() {
    try {
      const { channel, response } = await joinChannel("openclaw:events");
      const data = response as OpenClawStatus;
      set({ channel, connected: true, status: data });

      channel.on("connected", () => {
        set((s) => ({ status: { ...s.status, connected: true, error: null } }));
      });

      channel.on("disconnected", (payload: { reason?: string }) => {
        set((s) => ({ status: { ...s.status, connected: false, error: payload.reason ?? null } }));
      });
    } catch {
      set({ error: "Failed to join openclaw channel" });
    }
  },

  async sendMessage(sessionId, content) {
    await api.post("/openclaw/message", { session_id: sessionId, content });
  },

  async dispatch(agentType, opts = {}) {
    await api.post("/openclaw/dispatch", { agent_type: agentType, ...opts });
  },
}));
