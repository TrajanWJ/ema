import { create } from "zustand";
import { api } from "@/lib/api";

export interface ToolCall {
  id: string;
  kind: "read" | "edit" | "write" | "bash" | "search" | "done" | "error" | "thinking" | "generic";
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
}

export interface ChannelDef {
  id: string;
  name: string;
  type: "text" | "voice" | "announcement";
  serverId: string;
  topic?: string;
  unread?: number;
}

export interface Server {
  id: string;
  name: string;
  icon: string;
  channels: ChannelDef[];
}

export interface Member {
  id: string;
  name: string;
  status: "online" | "idle" | "dnd" | "offline";
  avatar?: string;
  accent?: string;
  role?: string;
}

interface ChannelsState {
  servers: Server[];
  messages: ChannelMessage[];
  members: Member[];
  activeServerId: string | null;
  activeChannelId: string | null;
  loading: boolean;
  error: string | null;

  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  setActiveServer: (serverId: string) => void;
  setActiveChannel: (channelId: string) => void;
  sendMessage: (content: string) => Promise<void>;
  activeServer: () => Server | null;
  activeChannel: () => ChannelDef | null;
}

// Default demo data until backend is wired up
const DEMO_SERVERS: Server[] = [
  {
    id: "ema",
    name: "EMA",
    icon: "◉",
    channels: [
      { id: "general", name: "general", type: "text", serverId: "ema", topic: "Main coordination channel" },
      { id: "agents", name: "agents", type: "text", serverId: "ema", topic: "Agent activity feed" },
      { id: "tasks", name: "tasks", type: "text", serverId: "ema", topic: "Task updates" },
      { id: "logs", name: "logs", type: "text", serverId: "ema", topic: "System logs" },
    ],
  },
  {
    id: "research",
    name: "Research",
    icon: "⬡",
    channels: [
      { id: "papers", name: "papers", type: "text", serverId: "research", topic: "Research papers and summaries" },
      { id: "notes", name: "notes", type: "text", serverId: "research", topic: "Research notes" },
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

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  servers: DEMO_SERVERS,
  messages: [],
  members: DEMO_MEMBERS,
  activeServerId: "ema",
  activeChannelId: "general",
  loading: false,
  error: null,

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
    // WebSocket connection to be implemented when backend is ready
    const state = get();
    const channelId = state.activeChannelId;
    if (!channelId) return;

    try {
      const data = await api.get<{ messages: ChannelMessage[] }>(`/channels/${channelId}/messages`);
      set({ messages: data.messages });
    } catch {
      // No backend yet — start with empty messages
    }
  },

  setActiveServer(serverId: string) {
    const state = get();
    const server = state.servers.find((s) => s.id === serverId);
    const firstChannel = server?.channels[0]?.id ?? null;
    set({ activeServerId: serverId, activeChannelId: firstChannel, messages: [] });
  },

  setActiveChannel(channelId: string) {
    set({ activeChannelId: channelId, messages: [] });
    // Load messages for this channel
    api
      .get<{ messages: ChannelMessage[] }>(`/channels/${channelId}/messages`)
      .then((data) => set({ messages: data.messages }))
      .catch(() => {});
  },

  async sendMessage(content: string) {
    const state = get();
    if (!state.activeChannelId) return;

    const optimistic: ChannelMessage = {
      id: `tmp-${Date.now()}`,
      content,
      authorId: "trajan",
      authorName: "Trajan",
      authorAccent: "#6b95f0",
      timestamp: Date.now(),
      role: "user",
    };
    set({ messages: [...state.messages, optimistic] });

    try {
      await api.post(`/channels/${state.activeChannelId}/messages`, { content });
    } catch {
      // Optimistic — message stays for now
    }
  },

  activeServer(): Server | null {
    const state = get();
    return state.servers.find((s) => s.id === state.activeServerId) ?? null;
  },

  activeChannel(): ChannelDef | null {
    const state = get();
    if (!state.activeServerId || !state.activeChannelId) return null;
    const server = state.servers.find((s) => s.id === state.activeServerId);
    return server?.channels.find((c) => c.id === state.activeChannelId) ?? null;
  },
}));
