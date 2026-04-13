import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";

interface SessionRecord {
  readonly id: string;
  readonly session_id: string | null;
  readonly project_path: string | null;
  readonly status: string;
  readonly token_count: number | null;
  readonly tool_calls: number | null;
  readonly summary: string | null;
  readonly last_active: string | null;
  readonly started_at: string | null;
  readonly ended_at: string | null;
  readonly project_id: string | null;
  readonly created_at: string;
}

interface MemoryFragment {
  readonly id: string;
  readonly session_id: string | null;
  readonly fragment_type: string;
  readonly content: string;
  readonly importance_score: number;
  readonly project_path: string | null;
  readonly created_at: string;
}

interface SessionStats {
  readonly total_sessions: number;
  readonly total_tokens: number;
  readonly most_active_project: { project_path: string; count: number } | null;
}

interface MemoryState {
  sessions: readonly SessionRecord[];
  fragments: readonly MemoryFragment[];
  stats: SessionStats | null;
  selectedSession: SessionRecord | null;
  searchQuery: string;
  loading: boolean;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  selectSession: (session: SessionRecord | null) => void;
  loadFragments: (sessionId?: string, projectPath?: string) => Promise<void>;
  extractFragments: (sessionId: string) => Promise<void>;
  getContext: (projectPath: string) => Promise<string>;
  search: (query: string) => Promise<void>;
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
  sessions: [],
  fragments: [],
  stats: null,
  selectedSession: null,
  searchQuery: "",
  loading: false,
  connected: false,
  channel: null,

  async loadViaRest() {
    set({ loading: true });
    try {
      const data = await api.get<{ sessions: SessionRecord[]; stats: SessionStats }>(
        "/memory/sessions"
      );
      set({ sessions: data.sessions, stats: data.stats, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async connect() {
    try {
      const { channel, response } = await joinChannel("memory:live");
      const data = response as { sessions: SessionRecord[]; stats: SessionStats };
      set({ channel, connected: true, sessions: data.sessions, stats: data.stats });

      channel.on("fragments_extracted", (payload: { session_id: string; count: number }) => {
        const selected = get().selectedSession;
        if (selected?.id === payload.session_id) {
          get().loadFragments(payload.session_id);
        }
      });

      channel.on("session_updated", (session: SessionRecord) => {
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === session.id ? session : s)),
        }));
      });
    } catch {
      // REST fallback
    }
  },

  selectSession(session) {
    set({ selectedSession: session });
    if (session) {
      get().loadFragments(session.id);
    }
  },

  async loadFragments(sessionId, projectPath) {
    const params = new URLSearchParams();
    if (sessionId) params.set("session_id", sessionId);
    if (projectPath) params.set("project_path", projectPath);

    const data = await api.get<{ fragments: MemoryFragment[] }>(
      `/memory/fragments?${params.toString()}`
    );
    set({ fragments: data.fragments });
  },

  async extractFragments(sessionId) {
    const data = await api.post<{ fragments: MemoryFragment[] }>(
      `/memory/extract/${sessionId}`,
      {}
    );
    set({ fragments: data.fragments });
  },

  async getContext(projectPath) {
    const data = await api.get<{ context: string }>(
      `/memory/context?project_path=${encodeURIComponent(projectPath)}`
    );
    return data.context;
  },

  async search(query) {
    set({ searchQuery: query });
    if (!query.trim()) {
      get().loadViaRest();
      return;
    }
    const data = await api.get<{ sessions: SessionRecord[] }>(
      `/memory/search?q=${encodeURIComponent(query)}`
    );
    set({ sessions: data.sessions });
  },
}));
