import { create } from "zustand";

import { api } from "@/lib/api";

export interface RuntimeTool {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly binary_path: string | null;
  readonly version: string | null;
  readonly config_dir: string | null;
  readonly auth_state: string;
  readonly available: boolean;
  readonly launch_command: string;
  readonly source: string;
  readonly detected_at: string;
}

export interface RuntimeSession {
  readonly id: string;
  readonly session_name: string;
  readonly source: "managed" | "external";
  readonly tool_kind: string;
  readonly tool_name: string;
  readonly status: string;
  readonly runtime_state: string | null;
  readonly cwd: string | null;
  readonly command: string;
  readonly pane_id: string | null;
  readonly pid: number | null;
  readonly started_at: string;
  readonly last_seen_at: string;
  readonly last_output_at: string | null;
  readonly last_transition_at: string | null;
  readonly tail_preview: string | null;
  readonly summary: string | null;
}

export interface RuntimeSessionScreen {
  readonly session_id: string;
  readonly session_name: string;
  readonly pane_id: string | null;
  readonly captured_at: string;
  readonly line_count: number;
  readonly tail: string;
}

export interface RuntimeSessionEvent {
  readonly id: string;
  readonly session_id: string;
  readonly event_kind: string;
  readonly summary: string;
  readonly payload_json: string | null;
  readonly inserted_at: string;
}

interface RuntimeFabricState {
  tools: RuntimeTool[];
  sessions: RuntimeSession[];
  selectedSessionId: string | null;
  screen: RuntimeSessionScreen | null;
  events: RuntimeSessionEvent[];
  loading: boolean;
  error: string | null;
  loadTools: () => Promise<void>;
  scanTools: () => Promise<void>;
  loadSessions: () => Promise<void>;
  selectSession: (id: string | null) => void;
  refreshScreen: (lines?: number) => Promise<void>;
  refreshEvents: (limit?: number) => Promise<void>;
  createSession: (input: {
    tool_kind: string;
    cwd?: string;
    session_name?: string;
    command?: string;
    initial_input?: string;
    simulate_typing?: boolean;
  }) => Promise<RuntimeSession | null>;
  dispatchPrompt: (input: {
    tool_kind: string;
    prompt: string;
    cwd?: string;
    session_id?: string;
    session_name?: string;
    command?: string;
    simulate_typing?: boolean;
  }) => Promise<void>;
  sendText: (id: string, text: string, mode: "paste" | "type", submit?: boolean) => Promise<void>;
  sendKey: (id: string, key: string) => Promise<void>;
  stopSession: (id: string) => Promise<void>;
  forgetSession: (id: string) => Promise<void>;
}

export const useRuntimeFabricStore = create<RuntimeFabricState>((set, get) => ({
  tools: [],
  sessions: [],
  selectedSessionId: null,
  screen: null,
  events: [],
  loading: false,
  error: null,

  async loadTools() {
    try {
      const data = await api.get<{ tools: RuntimeTool[] }>("/runtime-fabric/tools");
      set({ tools: data.tools, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load tools" });
    }
  },

  async scanTools() {
    try {
      const data = await api.post<{ tools: RuntimeTool[] }>("/runtime-fabric/tools/scan", {});
      set({ tools: data.tools, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to scan tools" });
    }
  },

  async loadSessions() {
    try {
      const data = await api.get<{ sessions: RuntimeSession[] }>("/runtime-fabric/sessions");
      set({ sessions: data.sessions, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load sessions" });
    }
  },

  selectSession(id) {
    set({ selectedSessionId: id, screen: null, events: [] });
  },

  async refreshScreen(lines = 220) {
    const id = get().selectedSessionId;
    if (!id) return;
    try {
      const data = await api.get<{ screen: RuntimeSessionScreen }>(
        `/runtime-fabric/sessions/${encodeURIComponent(id)}/screen?lines=${lines}`,
      );
      set({ screen: data.screen, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to capture screen" });
    }
  },

  async refreshEvents(limit = 50) {
    const id = get().selectedSessionId;
    if (!id) return;
    try {
      const data = await api.get<{ events: RuntimeSessionEvent[] }>(
        `/runtime-fabric/sessions/${encodeURIComponent(id)}/events?limit=${limit}`,
      );
      set({ events: data.events, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load session events" });
    }
  },

  async createSession(input) {
    try {
      const data = await api.post<{ session: RuntimeSession }>("/runtime-fabric/sessions", input);
      await get().loadSessions();
      set({ selectedSessionId: data.session.id });
      await get().refreshScreen();
      await get().refreshEvents();
      return data.session;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create session" });
      return null;
    }
  },

  async dispatchPrompt(input) {
    try {
      const data = await api.post<{
        session: RuntimeSession;
        screen: RuntimeSessionScreen;
      }>("/runtime-fabric/dispatch", input);
      await get().loadSessions();
      set({
        selectedSessionId: data.session.id,
        screen: data.screen,
        error: null,
      });
      await get().refreshEvents();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to dispatch prompt" });
    }
  },

  async sendText(id, text, mode, submit = false) {
    await api.post(`/runtime-fabric/sessions/${encodeURIComponent(id)}/input`, {
      text,
      mode,
      submit,
    });
    await get().loadSessions();
    await get().refreshScreen();
    await get().refreshEvents();
  },

  async sendKey(id, key) {
    await api.post(`/runtime-fabric/sessions/${encodeURIComponent(id)}/input`, {
      mode: "key",
      key,
    });
    await get().loadSessions();
    await get().refreshScreen();
    await get().refreshEvents();
  },

  async stopSession(id) {
    await api.post(`/runtime-fabric/sessions/${encodeURIComponent(id)}/stop`, {});
    await get().loadSessions();
    await get().refreshScreen();
    await get().refreshEvents();
  },

  async forgetSession(id) {
    await api.delete<void>(`/runtime-fabric/sessions/${encodeURIComponent(id)}`);
    const nextSessions = get().sessions.filter((session) => session.id !== id);
    const selectedSessionId = get().selectedSessionId === id
      ? nextSessions[0]?.id ?? null
      : get().selectedSessionId;
    set({
      selectedSessionId,
      screen: get().selectedSessionId === id ? null : get().screen,
      events: get().selectedSessionId === id ? [] : get().events,
    });
    await get().loadSessions();
    if (selectedSessionId) {
      await get().refreshScreen();
      await get().refreshEvents();
    }
  },
}));
