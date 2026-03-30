import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";
import type { Agent, AgentMessage } from "@/types/agents";

interface AgentsState {
  agents: readonly Agent[];
  selectedAgentId: string | null;
  messages: readonly AgentMessage[];
  conversationId: string | null;
  conversations: readonly { id: string }[];
  connected: boolean;
  channel: Channel | null;
  chatChannel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  create: (data: {
    name: string;
    description?: string;
    model: string;
    temperature: number;
    tools?: string[];
    project_id?: string | null;
  }) => Promise<void>;
  update: (id: string, data: Partial<Agent>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  selectAgent: (id: string | null) => void;
  sendMessage: (slug: string, content: string) => Promise<void>;
  loadConversations: (slug: string) => Promise<void>;
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  selectedAgentId: null,
  messages: [],
  conversationId: null,
  conversations: [],
  connected: false,
  channel: null,
  chatChannel: null,

  async loadViaRest() {
    const data = await api.get<{ agents: Agent[] }>("/agents");
    set({ agents: data.agents });
  },

  async connect() {
    const { channel, response } = await joinChannel("agents:lobby");
    const data = response as { agents: Agent[] };
    set({ channel, connected: true, agents: data.agents });

    channel.on("agent_created", (agent: Agent) => {
      set((state) => ({ agents: [agent, ...state.agents] }));
    });

    channel.on("agent_updated", (updated: Agent) => {
      set((state) => ({
        agents: state.agents.map((a) => (a.id === updated.id ? updated : a)),
      }));
    });

    channel.on("agent_deleted", (payload: { id: string }) => {
      set((state) => ({
        agents: state.agents.filter((a) => a.id !== payload.id),
      }));
    });
  },

  async create(data) {
    await api.post("/agents", data);
  },

  async update(id, data) {
    await api.patch(`/agents/${id}`, data);
  },

  async remove(id) {
    await api.delete(`/agents/${id}`);
  },

  selectAgent(id) {
    set({ selectedAgentId: id, messages: [], conversationId: null });
  },

  async sendMessage(slug, content) {
    const state = get();
    const userMsg: AgentMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content,
      tool_calls: [],
      created_at: new Date().toISOString(),
    };
    set({ messages: [...state.messages, userMsg] });

    const resp = await api.post<{
      reply: string;
      conversation_id: string;
      tool_calls: unknown[];
    }>(`/agents/${slug}/chat`, {
      message: content,
      conversation_id: state.conversationId,
    });

    const assistantMsg: AgentMessage = {
      id: `resp-${Date.now()}`,
      role: "assistant",
      content: resp.reply,
      tool_calls: resp.tool_calls ?? [],
      created_at: new Date().toISOString(),
    };

    set({
      messages: [...get().messages, assistantMsg],
      conversationId: resp.conversation_id,
    });
  },

  async loadConversations(slug) {
    const data = await api.get<{ conversations: { id: string }[] }>(
      `/agents/${slug}/conversations`
    );
    set({ conversations: data.conversations });
  },
}));
