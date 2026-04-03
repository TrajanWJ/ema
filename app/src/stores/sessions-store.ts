import { create } from "zustand";
import { api } from "@/lib/api";
import { joinChannel } from "@/lib/ws";
import type { Channel } from "@/lib/ws";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Session {
  readonly id: string;
  readonly session_id?: string;
  readonly project_path: string | null;
  readonly project_id: string | null;
  readonly model: string | null;
  readonly status: string;
  readonly started_at: string | null;
  readonly last_active: string | null;
  readonly token_count?: number | null;
  readonly files_touched?: string[] | null;
  readonly summary?: string | null;
}

export interface StreamEvent {
  readonly type: string;
  readonly data: Record<string, unknown> | string;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface SessionsState {
  // Data
  sessions: Session[];
  selectedSessionId: string | null;
  sessionOutput: Record<string, string[]>;
  loading: boolean;
  error: string | null;

  // Channel ref
  _channel: Channel | null;
  _sessionChannel: Channel | null;

  // Actions
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  selectSession: (id: string | null) => void;
  createSession: (projectPath: string, model: string) => Promise<void>;
  continueSession: (id: string, prompt: string) => Promise<void>;
  killSession: (id: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SetFn = (partial: Partial<SessionsState>) => void;
type GetFn = () => SessionsState;

function mergeSessions(
  bridgeSessions: Record<string, unknown>[],
  dbSessions: Record<string, unknown>[],
): Session[] {
  const bridgeMapped: Session[] = bridgeSessions.map((s) => ({
    id: String(s.id ?? ""),
    project_path: (s.project_path as string) ?? null,
    project_id: (s.project_id as string) ?? null,
    model: (s.model as string) ?? null,
    status: String(s.status ?? "unknown"),
    started_at: (s.started_at as string) ?? null,
    last_active: (s.last_active as string) ?? null,
  }));

  const bridgeIds = new Set(bridgeMapped.map((s) => s.id));

  const dbMapped: Session[] = dbSessions
    .filter((s) => !bridgeIds.has(String(s.id ?? s.session_id ?? "")))
    .map((s) => ({
      id: String(s.id ?? s.session_id ?? ""),
      session_id: (s.session_id as string) ?? undefined,
      project_path: (s.project_path as string) ?? null,
      project_id: (s.project_id as string) ?? null,
      model: (s.model as string) ?? null,
      status: String(s.status ?? "unknown"),
      started_at: (s.started_at as string) ?? null,
      last_active: (s.last_active as string) ?? null,
      token_count: (s.token_count as number) ?? null,
      files_touched: (s.files_touched as string[]) ?? null,
      summary: (s.summary as string) ?? null,
    }));

  return [...bridgeMapped, ...dbMapped];
}

function bindLobbyEvents(channel: Channel, set: SetFn, get: GetFn): void {
  channel.on("snapshot", (payload: unknown) => {
    const { sessions } = payload as { sessions: Record<string, unknown>[] };
    if (Array.isArray(sessions)) {
      set({ sessions: mergeSessions(sessions, []) });
    }
  });

  channel.on("session_created", (payload: unknown) => {
    const data = payload as Record<string, unknown>;
    const session: Session = {
      id: String(data.id ?? ""),
      project_path: (data.project_path as string) ?? null,
      project_id: (data.project_id as string) ?? null,
      model: (data.model as string) ?? null,
      status: String(data.status ?? "active"),
      started_at: (data.started_at as string) ?? null,
      last_active: (data.last_active as string) ?? null,
    };
    const existing = get().sessions;
    if (!existing.some((s) => s.id === session.id)) {
      set({ sessions: [session, ...existing] });
    }
  });

  channel.on("session_killed", (payload: unknown) => {
    const { id, session_id } = payload as { id?: string; session_id?: string };
    const targetId = id ?? session_id;
    set({
      sessions: get().sessions.map((s) =>
        s.id === targetId ? { ...s, status: "killed" } : s,
      ),
    });
  });

  channel.on("session_ended", (payload: unknown) => {
    const { id, session_id } = payload as { id?: string; session_id?: string };
    const targetId = id ?? session_id;
    set({
      sessions: get().sessions.map((s) =>
        s.id === targetId ? { ...s, status: "ended" } : s,
      ),
    });
  });
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSessionsStore = create<SessionsState>((set, get) => ({
  // -- Data -----------------------------------------------------------------
  sessions: [],
  selectedSessionId: null,
  sessionOutput: {},
  loading: false,
  error: null,

  // -- Channel refs ---------------------------------------------------------
  _channel: null,
  _sessionChannel: null,

  // -- Actions --------------------------------------------------------------

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{
        bridge_sessions: Record<string, unknown>[];
        sessions: Record<string, unknown>[];
      }>("/claude-sessions");

      const bridge = Array.isArray(data.bridge_sessions)
        ? data.bridge_sessions
        : [];
      const db = Array.isArray(data.sessions) ? data.sessions : [];
      set({ sessions: mergeSessions(bridge, db), loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load sessions",
      });
    }
  },

  async connect() {
    try {
      const { channel } = await joinChannel("claude_sessions:lobby");
      set({ _channel: channel });
      bindLobbyEvents(channel, set, get);
    } catch {
      // Backend not available -- operate offline
    }
  },

  disconnect() {
    const { _channel, _sessionChannel } = get();
    _channel?.leave();
    _sessionChannel?.leave();
    set({ _channel: null, _sessionChannel: null });
  },

  selectSession(id: string | null) {
    // Leave previous per-session channel
    const prev = get()._sessionChannel;
    prev?.leave();
    set({ selectedSessionId: id, _sessionChannel: null });

    if (!id) return;

    // Join per-session channel for streaming output
    joinChannel(`claude_sessions:${id}`)
      .then(({ channel }) => {
        set({ _sessionChannel: channel });

        channel.on("stream_event", (payload: unknown) => {
          const event = payload as StreamEvent;
          const output = { ...get().sessionOutput };
          const lines = output[id] ?? [];

          if (event.type === "text_delta") {
            const text =
              typeof event.data === "string"
                ? event.data
                : (event.data as { text?: string }).text ?? "";
            // Append text to last line or create new line
            if (lines.length > 0 && !lines[lines.length - 1].endsWith("\n")) {
              const updated = [...lines];
              updated[updated.length - 1] += text;
              output[id] = updated;
            } else {
              output[id] = [...lines, text];
            }
          } else {
            output[id] = [...lines, `[${event.type}] ${typeof event.data === "string" ? event.data : JSON.stringify(event.data)}`];
          }

          set({ sessionOutput: output });
        });
      })
      .catch(() => {
        // Per-session channel not available
      });
  },

  async createSession(projectPath: string, model: string) {
    try {
      const data = await api.post<{ session: Record<string, unknown> }>(
        "/claude-sessions",
        { project_path: projectPath, model },
      );
      const s = data.session;
      const session: Session = {
        id: String(s.id ?? ""),
        project_path: (s.project_path as string) ?? null,
        project_id: (s.project_id as string) ?? null,
        model: (s.model as string) ?? null,
        status: String(s.status ?? "active"),
        started_at: (s.started_at as string) ?? null,
        last_active: (s.last_active as string) ?? null,
      };
      const existing = get().sessions;
      if (!existing.some((e) => e.id === session.id)) {
        set({ sessions: [session, ...existing] });
      }
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to create session",
      });
    }
  },

  async continueSession(id: string, prompt: string) {
    try {
      await api.post(`/claude-sessions/${id}/continue`, { prompt });
      // Output will arrive via the per-session channel stream_event
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to continue session",
      });
    }
  },

  async killSession(id: string) {
    try {
      await api.delete(`/claude-sessions/${id}`);
      set({
        sessions: get().sessions.map((s) =>
          s.id === id ? { ...s, status: "killed" } : s,
        ),
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to kill session",
      });
    }
  },
}));
