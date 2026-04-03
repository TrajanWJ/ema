import { create } from "zustand";
import { api } from "@/lib/api";

export interface Conversation {
  readonly id: string;
  readonly title: string;
  readonly last_message: string | null;
  readonly unread_count: number;
  readonly updated_at: string;
}

export interface Message {
  readonly id: string;
  readonly conversation_id: string;
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
  readonly created_at: string;
}

interface MessageHubState {
  conversations: readonly Conversation[];
  activeConversationId: string | null;
  messages: readonly Message[];
  loading: boolean;
  error: string | null;
  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  createConversation: (title: string) => Promise<void>;
}

export const useMessageHubStore = create<MessageHubState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  loading: false,
  error: null,

  async loadConversations() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ conversations: Conversation[] }>("/messaging/conversations");
      set({ conversations: data.conversations, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async selectConversation(id) {
    set({ activeConversationId: id, messages: [], loading: true });
    try {
      const data = await api.get<{ messages: Message[] }>(`/messaging/conversations/${id}/messages`);
      set({ messages: data.messages, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  async loadMessages(conversationId) {
    const data = await api.get<{ messages: Message[] }>(`/messaging/conversations/${conversationId}/messages`);
    set({ messages: data.messages });
  },

  async sendMessage(conversationId, content) {
    const msg = await api.post<Message>(`/messaging/conversations/${conversationId}/messages`, { content });
    set((s) => ({ messages: [...s.messages, msg] }));
  },

  async createConversation(title) {
    const conv = await api.post<Conversation>("/messaging/conversations", { title });
    set((s) => ({ conversations: [conv, ...s.conversations] }));
  },
}));
