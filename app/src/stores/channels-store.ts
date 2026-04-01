import { create } from "zustand";
import { api } from "@/lib/api";
import { joinChannel } from "@/lib/ws";
import type { Channel } from "@/lib/ws";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolCall {
  id: string;
  kind:
    | "read"
    | "edit"
    | "write"
    | "bash"
    | "search"
    | "done"
    | "error"
    | "thinking"
    | "generic";
  title: string;
  filePath?: string;
  input?: string;
  output?: string;
}

export interface ChannelMessage {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorAccent?: string;
  timestamp: number;
  role: "user" | "assistant" | "system";
  toolCalls?: ToolCall[];
  replyTo?: string;
  reactions?: Record<string, string[]>;
  edited?: boolean;
}

export interface ChannelDef {
  id: string;
  name: string;
  type: "text" | "voice" | "announcement";
  serverId: string;
  topic?: string;
  unread?: number;
  category?: string;
  description?: string;
}

export interface Server {
  id: string;
  name: string;
  icon: string;
  channels: ChannelDef[];
  connectionStatus?: "connected" | "degraded" | "disconnected";
  unreadTotal?: number;
}

export interface Member {
  id: string;
  name: string;
  status: "online" | "idle" | "dnd" | "offline";
  avatar?: string;
  accent?: string;
  role?: string;
  isTyping?: boolean;
}

export type ViewMode = "channels" | "inbox";

export interface SearchState {
  query: string;
  results: ChannelMessage[];
  searching: boolean;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface ChannelsState {
  // Data
  servers: Server[];
  messages: ChannelMessage[];
  members: Member[];
  inboxMessages: ChannelMessage[];

  // UI state
  activeServerId: string | null;
  activeChannelId: string | null;
  viewMode: ViewMode;
  showMemberList: boolean;
  loading: boolean;
  error: string | null;
  typingUsers: Record<string, number>;
  search: SearchState;

  // Phoenix channel refs (not serialized)
  _lobbyChannel: Channel | null;
  _chatChannel: Channel | null;

  // Actions
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  setActiveServer: (serverId: string) => void;
  setActiveChannel: (channelId: string) => void;
  sendMessage: (content: string) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  toggleMemberList: () => void;
  searchMessages: (query: string) => Promise<void>;
  clearSearch: () => void;
  loadInbox: (filters?: Record<string, string>) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => void;
  sendTypingIndicator: () => void;

  // Computed
  activeServer: () => Server | null;
  activeChannel: () => ChannelDef | null;
  typingMembers: () => Member[];
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const DEMO_SERVERS: Server[] = [
  {
    id: "ema",
    name: "EMA",
    icon: "◉",
    connectionStatus: "connected",
    channels: [
      {
        id: "general",
        name: "general",
        type: "text",
        serverId: "ema",
        topic: "Main coordination channel",
        category: "Information",
      },
      {
        id: "agents",
        name: "agents",
        type: "text",
        serverId: "ema",
        topic: "Agent activity feed",
        category: "Information",
      },
      {
        id: "tasks",
        name: "tasks",
        type: "text",
        serverId: "ema",
        topic: "Task updates",
        category: "Work",
      },
      {
        id: "logs",
        name: "logs",
        type: "text",
        serverId: "ema",
        topic: "System logs",
        category: "Work",
      },
      {
        id: "announcements",
        name: "announcements",
        type: "announcement",
        serverId: "ema",
        topic: "Important updates",
        category: "Information",
      },
    ],
  },
  {
    id: "research",
    name: "Research",
    icon: "⬡",
    connectionStatus: "connected",
    channels: [
      {
        id: "papers",
        name: "papers",
        type: "text",
        serverId: "research",
        topic: "Research papers and summaries",
        category: "Topics",
      },
      {
        id: "notes",
        name: "notes",
        type: "text",
        serverId: "research",
        topic: "Research notes",
        category: "Topics",
      },
    ],
  },
];

const DEMO_MEMBERS: Member[] = [
  { id: "trajan", name: "Trajan", status: "online", accent: "#6b95f0", role: "Admin" },
  { id: "coder", name: "Coder", status: "online", accent: "#57A773", role: "Agent" },
  { id: "researcher", name: "Researcher", status: "idle", accent: "#a78bfa", role: "Agent" },
  { id: "orchestrator", name: "Orchestrator", status: "online", accent: "#f59e0b", role: "Agent" },
  { id: "right-hand", name: "Right Hand", status: "dnd", accent: "#2dd4a8", role: "Agent" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPING_EXPIRY_MS = 5_000;
const TYPING_THROTTLE_MS = 3_000;

/** Timestamp of the last typing indicator we pushed to the server. */
let lastTypingSentAt = 0;

/**
 * Wire up standard event listeners on a Phoenix channel.
 * Returns a cleanup function that removes all listeners.
 */
function bindChatEvents(channel: Channel, set: SetFn, get: GetFn): void {
  channel.on("new_message", (payload: unknown) => {
    const msg = payload as ChannelMessage;
    const existing = get().messages;
    // Deduplicate — the optimistic message may already be present
    if (existing.some((m) => m.id === msg.id)) return;
    set({ messages: [...existing, msg] });
  });

  channel.on("typing", (payload: unknown) => {
    const { user_id } = payload as { user_id: string };
    set({
      typingUsers: { ...get().typingUsers, [user_id]: Date.now() },
    });
  });
}

function bindLobbyEvents(channel: Channel, set: SetFn, get: GetFn): void {
  channel.on("new_message", (payload: unknown) => {
    const msg = payload as ChannelMessage;
    const existing = get().messages;
    if (existing.some((m) => m.id === msg.id)) return;
    set({ messages: [...existing, msg] });
  });

  channel.on("health_update", (payload: unknown) => {
    const { server_id, status } = payload as {
      server_id: string;
      status: "connected" | "degraded" | "disconnected";
    };
    set({
      servers: get().servers.map((s) =>
        s.id === server_id ? { ...s, connectionStatus: status } : s,
      ),
    });
  });

  channel.on("typing", (payload: unknown) => {
    const { user_id } = payload as { user_id: string };
    set({
      typingUsers: { ...get().typingUsers, [user_id]: Date.now() },
    });
  });

  channel.on("member_update", (payload: unknown) => {
    const updated = payload as Member;
    set({
      members: get().members.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
    });
  });
}

// Zustand set/get signatures for internal helpers
type SetFn = (partial: Partial<ChannelsState>) => void;
type GetFn = () => ChannelsState;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  // -- Data -----------------------------------------------------------------
  servers: DEMO_SERVERS,
  messages: [],
  members: DEMO_MEMBERS,
  inboxMessages: [],

  // -- UI state -------------------------------------------------------------
  activeServerId: "ema",
  activeChannelId: "general",
  viewMode: "channels",
  showMemberList: true,
  loading: false,
  error: null,
  typingUsers: {},
  search: { query: "", results: [], searching: false },

  // -- Channel refs ---------------------------------------------------------
  _lobbyChannel: null,
  _chatChannel: null,

  // -- Actions --------------------------------------------------------------

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ servers: Server[]; members: Member[] }>("/channels");
      set({ servers: data.servers, members: data.members, loading: false });
    } catch {
      // Fall back to demo data silently
      set({ loading: false });
    }
  },

  async connect() {
    try {
      const { channel } = await joinChannel("channels:lobby");
      set({ _lobbyChannel: channel });
      bindLobbyEvents(channel, set, get);
    } catch {
      // Backend not available — operate in offline/demo mode
    }

    // If there is already an active channel, join its chat topic too
    const { activeChannelId } = get();
    if (activeChannelId) {
      get().setActiveChannel(activeChannelId);
    }
  },

  disconnect() {
    const { _lobbyChannel, _chatChannel } = get();
    _lobbyChannel?.leave();
    _chatChannel?.leave();
    set({ _lobbyChannel: null, _chatChannel: null });
  },

  setActiveServer(serverId: string) {
    const server = get().servers.find((s) => s.id === serverId);
    const firstChannel = server?.channels[0]?.id ?? null;
    set({
      activeServerId: serverId,
      activeChannelId: firstChannel,
      messages: [],
    });
    if (firstChannel) {
      get().setActiveChannel(firstChannel);
    }
  },

  setActiveChannel(channelId: string) {
    // Leave previous chat channel
    const prev = get()._chatChannel;
    if (prev) {
      prev.leave();
      set({ _chatChannel: null });
    }

    set({ activeChannelId: channelId, messages: [], loading: true });

    // Attempt to join the Phoenix chat channel
    joinChannel(`channels:chat:${channelId}`)
      .then(({ channel, response }) => {
        set({ _chatChannel: channel });
        bindChatEvents(channel, set, get);

        // If the join response contains messages, use them
        const joined = response as { messages?: ChannelMessage[] } | undefined;
        if (joined?.messages) {
          set({ messages: joined.messages, loading: false });
        } else {
          // Fallback: fetch via REST
          return api
            .get<{ messages: ChannelMessage[] }>(`/channels/${channelId}/messages`)
            .then((data) => set({ messages: data.messages, loading: false }));
        }
      })
      .catch(() => {
        // No WS — try REST only
        api
          .get<{ messages: ChannelMessage[] }>(`/channels/${channelId}/messages`)
          .then((data) => set({ messages: data.messages, loading: false }))
          .catch(() => set({ loading: false }));
      });
  },

  async sendMessage(content: string) {
    const { activeChannelId, _chatChannel, messages } = get();
    if (!activeChannelId) return;

    const optimistic: ChannelMessage = {
      id: `tmp-${Date.now()}`,
      content,
      authorId: "trajan",
      authorName: "Trajan",
      authorAccent: "#6b95f0",
      timestamp: Date.now(),
      role: "user",
    };
    set({ messages: [...messages, optimistic] });

    if (_chatChannel) {
      _chatChannel.push("new_message", { content });
    } else {
      try {
        await api.post(`/channels/${activeChannelId}/messages`, { content });
      } catch {
        // Optimistic message stays — will reconcile on reconnect
      }
    }
  },

  setViewMode(mode: ViewMode) {
    set({ viewMode: mode });
  },

  toggleMemberList() {
    set({ showMemberList: !get().showMemberList });
  },

  async searchMessages(query: string) {
    set({ search: { query, results: [], searching: true } });
    try {
      const data = await api.get<{ messages: ChannelMessage[] }>(
        `/channels/inbox?search=${encodeURIComponent(query)}`,
      );
      set({ search: { query, results: data.messages, searching: false } });
    } catch {
      set({ search: { query, results: [], searching: false } });
    }
  },

  clearSearch() {
    set({ search: { query: "", results: [], searching: false } });
  },

  async loadInbox(filters?: Record<string, string>) {
    set({ loading: true });
    try {
      const params = filters
        ? `?${new URLSearchParams(filters).toString()}`
        : "";
      const data = await api.get<{ messages: ChannelMessage[] }>(
        `/channels/inbox${params}`,
      );
      set({ inboxMessages: data.messages, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addReaction(messageId: string, emoji: string) {
    const userId = "trajan";
    set({
      messages: get().messages.map((msg) => {
        if (msg.id !== messageId) return msg;
        const reactions = { ...msg.reactions };
        const users = reactions[emoji] ? [...reactions[emoji]] : [];
        const idx = users.indexOf(userId);
        if (idx >= 0) {
          users.splice(idx, 1);
        } else {
          users.push(userId);
        }
        if (users.length === 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = users;
        }
        return { ...msg, reactions };
      }),
    });
  },

  sendTypingIndicator() {
    const now = Date.now();
    if (now - lastTypingSentAt < TYPING_THROTTLE_MS) return;
    lastTypingSentAt = now;

    const { _chatChannel } = get();
    if (_chatChannel) {
      _chatChannel.push("typing", {});
    }
  },

  // -- Computed -------------------------------------------------------------

  activeServer(): Server | null {
    const { servers, activeServerId } = get();
    return servers.find((s) => s.id === activeServerId) ?? null;
  },

  activeChannel(): ChannelDef | null {
    const { servers, activeServerId, activeChannelId } = get();
    if (!activeServerId || !activeChannelId) return null;
    const server = servers.find((s) => s.id === activeServerId);
    return server?.channels.find((c) => c.id === activeChannelId) ?? null;
  },

  typingMembers(): Member[] {
    const { members, typingUsers } = get();
    const cutoff = Date.now() - TYPING_EXPIRY_MS;
    return members.filter((m) => {
      const ts = typingUsers[m.id];
      return ts !== undefined && ts > cutoff;
    });
  },
}));
