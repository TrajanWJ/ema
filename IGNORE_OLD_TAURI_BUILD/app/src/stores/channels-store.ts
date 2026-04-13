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
  streaming?: boolean;
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
  agentSlug?: string;
  agentBackend?: string;
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

export interface Platform {
  key: string;
  label: string;
  icon: string;
  status: "connected" | "not_connected" | "error";
  connections: readonly { agent_slug: string; agent_name: string; active: boolean; connection_status: string }[];
  active_channels: number;
  total_channels: number;
}

export type ViewMode = "channels" | "inbox" | "platforms";

export interface SearchState {
  query: string;
  results: ChannelMessage[];
  searching: boolean;
}

interface AgentRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatar: string;
  status: string;
  settings: Record<string, unknown>;
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
  platforms: Platform[];

  // UI state
  activeServerId: string | null;
  activeChannelId: string | null;
  viewMode: ViewMode;
  showMemberList: boolean;
  loading: boolean;
  error: string | null;
  typingUsers: Record<string, number>;
  search: SearchState;
  agentStreaming: boolean;
  streamingMessageId: string | null;

  // Phoenix channel refs (not serialized)
  _lobbyChannel: Channel | null;
  _chatChannel: Channel | null;
  _agentChannel: Channel | null;

  // Actions
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  setActiveServer: (serverId: string) => void;
  setActiveChannel: (channelId: string) => void;
  sendMessage: (content: string) => Promise<void>;
  sendToAgent: (agentSlug: string, message: string) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  toggleMemberList: () => void;
  searchMessages: (query: string) => Promise<void>;
  clearSearch: () => void;
  loadInbox: (filters?: Record<string, string>) => Promise<void>;
  addReaction: (messageId: string, emoji: string) => void;
  sendTypingIndicator: () => void;
  loadPlatforms: () => Promise<void>;
  sendCrossPlatform: (platform: string, channel: string, content: string) => Promise<void>;

  // Computed
  activeServer: () => Server | null;
  activeChannel: () => ChannelDef | null;
  typingMembers: () => Member[];
  isAgentChannel: () => boolean;
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
];

const DEMO_MEMBERS: Member[] = [
  { id: "trajan", name: "Trajan", status: "online", accent: "#6b95f0", role: "Admin" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPING_EXPIRY_MS = 5_000;
const TYPING_THROTTLE_MS = 3_000;

let lastTypingSentAt = 0;

function bindChatEvents(channel: Channel, set: SetFn, get: GetFn): void {
  channel.on("new_message", (payload: unknown) => {
    const msg = payload as ChannelMessage;
    const existing = get().messages;
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

function bindAgentChatEvents(channel: Channel, set: SetFn, get: GetFn): void {
  channel.on("message_delta", (payload: unknown) => {
    const { text } = payload as { text: string };
    const { messages, streamingMessageId } = get();

    if (streamingMessageId) {
      // Append to existing streaming message
      set({
        messages: messages.map((m) =>
          m.id === streamingMessageId
            ? { ...m, content: m.content + text }
            : m,
        ),
      });
    } else {
      // Create new streaming message
      const newId = `stream-${Date.now()}`;
      const channel = get().activeChannel();
      set({
        streamingMessageId: newId,
        agentStreaming: true,
        messages: [
          ...messages,
          {
            id: newId,
            content: text,
            authorId: channel?.agentSlug ?? "agent",
            authorName: channel?.name ?? "Agent",
            authorAccent: "#2dd4a8",
            timestamp: Date.now(),
            role: "assistant" as const,
            streaming: true,
          },
        ],
      });
    }
  });

  channel.on("tool_call", (payload: unknown) => {
    const event = payload as { name: string; input: Record<string, unknown>; raw: unknown };
    const { messages, streamingMessageId } = get();

    const toolCall: ToolCall = {
      id: `tc-${Date.now()}`,
      kind: mapToolKind(event.name),
      title: event.name,
      input: JSON.stringify(event.input, null, 2),
    };

    if (streamingMessageId) {
      set({
        messages: messages.map((m) =>
          m.id === streamingMessageId
            ? { ...m, toolCalls: [...(m.toolCalls ?? []), toolCall] }
            : m,
        ),
      });
    }
  });

  channel.on("message_complete", () => {
    const { messages, streamingMessageId } = get();
    set({
      agentStreaming: false,
      streamingMessageId: null,
      messages: messages.map((m) =>
        m.id === streamingMessageId ? { ...m, streaming: false } : m,
      ),
    });
  });

  // Also handle the old-style "response" event for non-streaming agents
  channel.on("response", (payload: unknown) => {
    const { reply, tool_calls } = payload as {
      reply: string;
      tool_calls: Array<{ name: string; input: Record<string, unknown> }>;
    };
    const { messages } = get();
    const channel = get().activeChannel();

    const toolCalls: ToolCall[] = (tool_calls ?? []).map((tc, i) => ({
      id: `tc-${Date.now()}-${i}`,
      kind: mapToolKind(tc.name),
      title: tc.name,
      input: JSON.stringify(tc.input, null, 2),
    }));

    set({
      agentStreaming: false,
      streamingMessageId: null,
      messages: [
        ...messages,
        {
          id: `resp-${Date.now()}`,
          content: reply,
          authorId: channel?.agentSlug ?? "agent",
          authorName: channel?.name ?? "Agent",
          authorAccent: "#2dd4a8",
          timestamp: Date.now(),
          role: "assistant" as const,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        },
      ],
    });
  });

  channel.on("error", (payload: unknown) => {
    const { message } = payload as { message: string };
    set({ agentStreaming: false, streamingMessageId: null, error: message });
  });

  channel.on("typing", (payload: unknown) => {
    const { agent } = payload as { agent: string };
    set({
      typingUsers: { ...get().typingUsers, [agent]: Date.now() },
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

function mapToolKind(name: string): ToolCall["kind"] {
  if (name.includes("read")) return "read";
  if (name.includes("edit")) return "edit";
  if (name.includes("write")) return "write";
  if (name.includes("bash") || name.includes("exec")) return "bash";
  if (name.includes("search") || name.includes("grep")) return "search";
  return "generic";
}

function agentToServer(agent: AgentRecord): Server {
  const settings = agent.settings ?? {};

  return {
    id: `agent-${agent.slug}`,
    name: agent.name,
    icon: agent.avatar || "🤖",
    connectionStatus: agent.status === "active" ? "connected" : "disconnected",
    channels: [
      {
        id: `agent-chat-${agent.slug}`,
        name: agent.name,
        type: "text",
        serverId: `agent-${agent.slug}`,
        topic: agent.description,
        category: "Chat",
        agentSlug: agent.slug,
        agentBackend: (settings.backend as string) ?? undefined,
      },
    ],
  };
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
  platforms: [],

  // -- UI state -------------------------------------------------------------
  activeServerId: null,
  activeChannelId: null,
  viewMode: "channels",
  showMemberList: true,
  loading: false,
  error: null,
  typingUsers: {},
  search: { query: "", results: [], searching: false },
  agentStreaming: false,
  streamingMessageId: null,

  // -- Channel refs ---------------------------------------------------------
  _lobbyChannel: null,
  _chatChannel: null,
  _agentChannel: null,

  // -- Actions --------------------------------------------------------------

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      // Load agents and build agent servers
      const agents = await api.get<AgentRecord[]>("/agents").catch(() => []);
      const agentServers = (Array.isArray(agents) ? agents : [])
        .filter((a) => a.status === "active")
        .map(agentToServer);

      // Build agent members
      const agentMembers: Member[] = (Array.isArray(agents) ? agents : [])
        .filter((a) => a.status === "active")
        .map((a) => ({
          id: a.slug,
          name: a.name,
          status: "online" as const,
          avatar: a.avatar,
          accent: (a.settings?.accent_color as string) ?? "#2dd4a8",
          role: "Agent",
        }));

      // Try loading channel data from REST
      let baseServers = DEMO_SERVERS;
      let baseMembers = DEMO_MEMBERS;
      try {
        const data = await api.get<{ servers: Server[]; members: Member[] }>("/channels");
        if (data.servers) baseServers = data.servers;
        if (data.members) baseMembers = data.members;
      } catch {
        // Fall back to demo data
      }

      set({
        servers: [...baseServers, ...agentServers],
        members: [...baseMembers, ...agentMembers],
        loading: false,
      });

      // Auto-select first agent server if none selected
      if (!get().activeServerId && agentServers.length > 0) {
        const firstAgent = agentServers[0];
        set({
          activeServerId: firstAgent.id,
          activeChannelId: firstAgent.channels[0]?.id ?? null,
        });
      } else if (!get().activeServerId) {
        set({ activeServerId: "ema", activeChannelId: "general" });
      }
    } catch {
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

    // If there is already an active channel, join it
    const { activeChannelId } = get();
    if (activeChannelId) {
      get().setActiveChannel(activeChannelId);
    }
  },

  disconnect() {
    const { _lobbyChannel, _chatChannel, _agentChannel } = get();
    _lobbyChannel?.leave();
    _chatChannel?.leave();
    _agentChannel?.leave();
    set({ _lobbyChannel: null, _chatChannel: null, _agentChannel: null });
  },

  setActiveServer(serverId: string) {
    const server = get().servers.find((s) => s.id === serverId);
    const firstChannel = server?.channels[0]?.id ?? null;
    set({
      activeServerId: serverId,
      activeChannelId: firstChannel,
      messages: [],
      agentStreaming: false,
      streamingMessageId: null,
    });
    if (firstChannel) {
      get().setActiveChannel(firstChannel);
    }
  },

  setActiveChannel(channelId: string) {
    // Leave previous channels
    const prevChat = get()._chatChannel;
    const prevAgent = get()._agentChannel;
    prevChat?.leave();
    prevAgent?.leave();
    set({
      _chatChannel: null,
      _agentChannel: null,
      activeChannelId: channelId,
      messages: [],
      loading: true,
      agentStreaming: false,
      streamingMessageId: null,
    });

    // Find the channel definition to check if it's an agent channel
    const allChannels = get().servers.flatMap((s) => s.channels);
    const channelDef = allChannels.find((c) => c.id === channelId);

    if (channelDef?.agentSlug) {
      // Join agent chat channel
      joinChannel(`agents:chat:${channelDef.agentSlug}`)
        .then(({ channel }) => {
          set({ _agentChannel: channel, loading: false });
          bindAgentChatEvents(channel, set, get);

          // Load conversation history via REST
          api
            .get<{
              conversations: Array<{ id: string; messages: ChannelMessage[] }>;
            }>(`/agents/${channelDef.agentSlug}/conversations`)
            .then((data) => {
              if (data.conversations?.[0]?.messages) {
                set({ messages: data.conversations[0].messages });
              }
            })
            .catch(() => {
              // No history yet
            });
        })
        .catch(() => {
          set({ loading: false });
        });
    } else {
      // Standard channel join
      joinChannel(`channels:chat:${channelId}`)
        .then(({ channel, response }) => {
          set({ _chatChannel: channel });
          bindChatEvents(channel, set, get);

          const joined = response as { messages?: ChannelMessage[] } | undefined;
          if (joined?.messages) {
            set({ messages: joined.messages, loading: false });
          } else {
            return api
              .get<{ messages: ChannelMessage[] }>(`/channels/${channelId}/messages`)
              .then((data) => set({ messages: data.messages, loading: false }));
          }
        })
        .catch(() => {
          api
            .get<{ messages: ChannelMessage[] }>(`/channels/${channelId}/messages`)
            .then((data) => set({ messages: data.messages, loading: false }))
            .catch(() => set({ loading: false }));
        });
    }
  },

  async sendMessage(content: string) {
    const { activeChannelId, _chatChannel, messages } = get();
    if (!activeChannelId) return;

    // Check if this is an agent channel
    const channel = get().activeChannel();
    if (channel?.agentSlug) {
      return get().sendToAgent(channel.agentSlug, content);
    }

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
        // Optimistic message stays
      }
    }
  },

  async sendToAgent(agentSlug: string, message: string) {
    const { _agentChannel, messages } = get();

    // Add user message optimistically
    const userMsg: ChannelMessage = {
      id: `usr-${Date.now()}`,
      content: message,
      authorId: "trajan",
      authorName: "Trajan",
      authorAccent: "#6b95f0",
      timestamp: Date.now(),
      role: "user",
    };
    set({ messages: [...messages, userMsg], agentStreaming: true });

    if (_agentChannel) {
      _agentChannel.push("send_message", { content: message });
    } else {
      // Fallback: REST
      try {
        const result = await api.post<{ reply: string; tool_calls: unknown[] }>(
          `/agents/${agentSlug}/chat`,
          { message },
        );
        const channel = get().activeChannel();
        set({
          agentStreaming: false,
          messages: [
            ...get().messages,
            {
              id: `resp-${Date.now()}`,
              content: result.reply,
              authorId: agentSlug,
              authorName: channel?.name ?? agentSlug,
              authorAccent: "#2dd4a8",
              timestamp: Date.now(),
              role: "assistant" as const,
            },
          ],
        });
      } catch {
        set({ agentStreaming: false, error: "Failed to send message to agent" });
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

    const { _chatChannel, _agentChannel } = get();
    const ch = _agentChannel ?? _chatChannel;
    if (ch) {
      ch.push("typing", {});
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

  isAgentChannel(): boolean {
    const channel = get().activeChannel();
    return !!channel?.agentSlug;
  },

  async loadPlatforms() {
    try {
      const data = await api.get<{ platforms: Platform[] }>("/channels/platforms");
      set({ platforms: data.platforms });
    } catch {
      // Platform data unavailable
    }
  },

  async sendCrossPlatform(platform: string, channel: string, content: string) {
    await api.post("/channels/send", { platform, channel, content });
  },
}));
