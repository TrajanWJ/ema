import { create } from "zustand";
import { api } from "@/lib/api";

export interface Conversation {
  readonly id: string;
  readonly platform: string;
  readonly title: string;
  readonly last_message: string | null;
  readonly unread_count: number;
  readonly updated_at: string;
}

export interface Message {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly platform: string;
  readonly timestamp: string;
  readonly created_at: string;
}

interface MessageHubState {
  conversations: readonly Conversation[];
  messages: readonly Message[];
  activeConversationId: string | null;
  loading: boolean;
  error: string | null;
  loadViaRest: () => Promise<void>;
  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
}

export const useMessageHubStore = create<MessageHubState>((set) => ({
  conversations: [],
  messages: [],
  activeConversationId: null,
  loading: false,
  error: null,

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<{ conversations: Conversation[] }>(
        "/messages/conversations",
      );
      set({ conversations: data.conversations, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async loadConversations() {
    await useMessageHubStore.getState().loadViaRest();
  },

  async selectConversation(id) {
    set({ activeConversationId: id, messages: [], loading: true });
    try {
      const data = await api.get<{ messages: Message[] }>(
        `/messages?conversation_id=${id}`,
      );
      set({ messages: data.messages, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async sendMessage(conversationId, content) {
    try {
      const data = await api.post<{ messages: Message[] }>(
        "/messages/send",
        { conversation_id: conversationId, content },
      );
      set({ messages: data.messages });
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
