import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";

export interface CliTool {
  readonly id: string;
  readonly name: string;
  readonly binary_path: string;
  readonly version: string | null;
  readonly capabilities: readonly string[];
  readonly session_dir: string | null;
  readonly detected_at: string | null;
}

export interface CliSession {
  readonly id: string;
  readonly cli_tool_id: string | null;
  readonly tool_name: string | null;
  readonly project_path: string;
  readonly status: "running" | "idle" | "crashed" | "completed" | "stopped";
  readonly pid: number | null;
  readonly prompt: string;
  readonly started_at: string | null;
  readonly ended_at: string | null;
  readonly linked_task_id: string | null;
  readonly linked_proposal_id: string | null;
  readonly output_summary: string | null;
  readonly exit_code: number | null;
  readonly created_at: string;
}

interface CliManagerState {
  tools: readonly CliTool[];
  sessions: readonly CliSession[];
  activeSessions: readonly CliSession[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  scan: () => Promise<void>;
  startSession: (toolName: string, projectPath: string, prompt: string, opts?: Record<string, string>) => Promise<void>;
  stopSession: (id: string) => Promise<void>;
}

export const useCliManagerStore = create<CliManagerState>((set) => ({
  tools: [],
  sessions: [],
  activeSessions: [],
  loading: false,
  error: null,
  connected: false,
  channel: null,

  async loadViaRest() {
    try {
      set({ loading: true });
      const [toolsData, sessionsData] = await Promise.all([
        api.get<{ tools: CliTool[] }>("/cli-manager/tools"),
        api.get<{ sessions: CliSession[] }>("/cli-manager/sessions"),
      ]);
      const active = sessionsData.sessions.filter((s) => s.status === "running");
      set({
        tools: toolsData.tools,
        sessions: sessionsData.sessions,
        activeSessions: active,
        loading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load", loading: false });
    }
  },

  async connect() {
    try {
      const { channel, response } = await joinChannel("cli_manager:lobby");
      const data = response as { tools: CliTool[]; active_sessions: CliSession[] };
      set({
        channel,
        connected: true,
        tools: data.tools,
        activeSessions: data.active_sessions,
      });

      channel.on("session_created", (session: CliSession) => {
        set((s) => ({
          sessions: [session, ...s.sessions],
          activeSessions: session.status === "running" ? [session, ...s.activeSessions] : s.activeSessions,
        }));
      });

      channel.on("session_updated", (updated: CliSession) => {
        set((s) => ({
          sessions: s.sessions.map((sess) => (sess.id === updated.id ? updated : sess)),
          activeSessions:
            updated.status === "running"
              ? s.activeSessions.some((sess) => sess.id === updated.id)
                ? s.activeSessions.map((sess) => (sess.id === updated.id ? updated : sess))
                : [updated, ...s.activeSessions]
              : s.activeSessions.filter((sess) => sess.id !== updated.id),
        }));
      });
    } catch {
      set({ error: "Failed to join cli_manager channel" });
    }
  },

  async scan() {
    const data = await api.post<{ tools: CliTool[]; count: number }>("/cli-manager/scan", {});
    set((s) => {
      const existing = new Set(s.tools.map((t) => t.id));
      const newTools = data.tools.filter((t) => !existing.has(t.id));
      return { tools: [...s.tools, ...newTools] };
    });
  },

  async startSession(toolName, projectPath, prompt, opts = {}) {
    await api.post("/cli-manager/sessions", {
      tool_name: toolName,
      project_path: projectPath,
      prompt,
      ...opts,
    });
  },

  async stopSession(id) {
    await api.post(`/cli-manager/sessions/${id}/stop`, {});
  },
}));
