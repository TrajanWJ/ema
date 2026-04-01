import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import type { Channel } from "phoenix";

export interface BridgeSession {
  readonly id: string;
  readonly project_path: string;
  readonly project_id: string | null;
  readonly model: string;
  readonly status: "idle" | "streaming" | "completed" | "error" | "killed" | "crashed";
  readonly started_at: string;
  readonly last_active: string;
}

interface StreamEvent {
  readonly type: string;
  readonly data: Record<string, unknown>;
}

interface ClaudeBridgeState {
  sessions: readonly BridgeSession[];
  activeSessionId: string | null;
  output: readonly string[];
  connected: boolean;
  lobbyChannel: Channel | null;
  sessionChannel: Channel | null;

  connect: () => Promise<void>;
  createSession: (projectPath: string, model: string, projectId?: string) => Promise<BridgeSession | null>;
  selectSession: (sessionId: string) => Promise<void>;
  sendPrompt: (sessionId: string, prompt: string) => void;
  killSession: (sessionId: string) => void;
  clearOutput: () => void;
}

export const useClaudeBridgeStore = create<ClaudeBridgeState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  output: [],
  connected: false,
  lobbyChannel: null,
  sessionChannel: null,

  async connect() {
    try {
      const { channel, response } = await joinChannel("claude_sessions:lobby");
      const data = response as { sessions?: BridgeSession[] };
      set({
        lobbyChannel: channel,
        connected: true,
        sessions: data.sessions ?? [],
      });

      channel.on("snapshot", (payload: { sessions: BridgeSession[] }) => {
        set({ sessions: payload.sessions });
      });

      channel.on("session_created", (session: BridgeSession) => {
        set((state) => ({
          sessions: [session, ...state.sessions],
        }));
      });

      channel.on("session_killed", (payload: { id: string }) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === payload.id ? { ...s, status: "killed" as const } : s
          ),
        }));
      });

      channel.on("session_ended", (payload: { id: string; status: string }) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === payload.id
              ? { ...s, status: payload.status as BridgeSession["status"] }
              : s
          ),
        }));
      });
    } catch {
      console.warn("Claude Bridge WebSocket not available");
    }
  },

  async createSession(projectPath, model, projectId) {
    const { lobbyChannel } = get();
    if (!lobbyChannel) return null;

    return new Promise<BridgeSession | null>((resolve) => {
      const payload: Record<string, string> = {
        project_path: projectPath,
        model,
      };
      if (projectId) payload.project_id = projectId;

      lobbyChannel
        .push("create", payload)
        .receive("ok", (resp: unknown) => {
          const session = resp as BridgeSession;
          resolve(session);
          get().selectSession(session.id);
        })
        .receive("error", (err: unknown) => {
          console.error("Failed to create session:", err);
          resolve(null);
        });
    });
  },

  async selectSession(sessionId) {
    const { sessionChannel: prev } = get();
    if (prev) {
      prev.leave();
    }

    set({ activeSessionId: sessionId, output: [], sessionChannel: null });

    try {
      const { channel } = await joinChannel(`claude_sessions:${sessionId}`);
      set({ sessionChannel: channel });

      channel.on("stream_event", (event: StreamEvent) => {
        if (event.type === "text_delta" && typeof event.data.text === "string") {
          set((state) => ({
            output: [...state.output, event.data.text as string],
          }));
        }
      });
    } catch {
      console.warn(`Failed to join session channel: ${sessionId}`);
    }
  },

  sendPrompt(sessionId, prompt) {
    const { lobbyChannel } = get();
    if (!lobbyChannel) return;

    lobbyChannel.push("continue", { session_id: sessionId, prompt });
  },

  killSession(sessionId) {
    const { lobbyChannel } = get();
    if (!lobbyChannel) return;

    lobbyChannel.push("kill", { session_id: sessionId });
  },

  clearOutput() {
    set({ output: [] });
  },
}));
