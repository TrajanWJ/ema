import { create } from "zustand";
import { api } from "@/lib/api";
import { joinChannel } from "@/lib/ws";
import type { Channel } from "@/lib/ws";

export interface ChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly timestamp: string;
  readonly actionCard?: ActionCard;
}

export interface ActionCard {
  readonly type: "task" | "brain_dump" | "note" | "proposal";
  readonly title: string;
  readonly id?: string;
}

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

interface JarvisStoreState {
  orbState: OrbState;
  messages: readonly ChatMessage[];
  expanded: boolean;
  conversationId: string | null;
  inputText: string;
  channel: Channel | null;

  sendMessage: (text: string) => Promise<void>;
  setExpanded: (expanded: boolean) => void;
  setInputText: (text: string) => void;
  setOrbState: (state: OrbState) => void;
  clearMessages: () => void;
  connect: () => Promise<void>;
}

function makeId(): string {
  return `j-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const JARVIS_AGENT_SLUG = "jarvis";

export const useJarvisStore = create<JarvisStoreState>((set, get) => ({
  orbState: "idle",
  messages: [],
  expanded: false,
  conversationId: null,
  inputText: "",
  channel: null,

  async sendMessage(text: string) {
    const userMsg: ChatMessage = {
      id: makeId(),
      role: "user",
      text,
      timestamp: new Date().toISOString(),
    };

    set((s) => ({
      messages: [...s.messages, userMsg],
      inputText: "",
      orbState: "thinking",
    }));

    try {
      const { conversationId } = get();
      const res = await api.post<{
        reply: string;
        conversation_id: string;
        tool_calls: unknown[];
      }>(`/agents/${JARVIS_AGENT_SLUG}/chat`, {
        message: text,
        conversation_id: conversationId,
      });

      const actionCard = parseActionCard(res.reply, res.tool_calls);

      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: "assistant",
        text: res.reply,
        timestamp: new Date().toISOString(),
        actionCard,
      };

      set((s) => ({
        messages: [...s.messages, assistantMsg],
        conversationId: res.conversation_id,
        orbState: "idle",
      }));
    } catch {
      // Fallback to voice/process endpoint if jarvis agent doesn't exist
      try {
        const res = await api.post<{ reply: string }>("/voice/process", { text });

        const assistantMsg: ChatMessage = {
          id: makeId(),
          role: "assistant",
          text: res.reply,
          timestamp: new Date().toISOString(),
        };

        set((s) => ({
          messages: [...s.messages, assistantMsg],
          orbState: "idle",
        }));
      } catch {
        const errorMsg: ChatMessage = {
          id: makeId(),
          role: "assistant",
          text: "I'm having trouble connecting. Is the daemon running?",
          timestamp: new Date().toISOString(),
        };

        set((s) => ({
          messages: [...s.messages, errorMsg],
          orbState: "idle",
        }));
      }
    }
  },

  setExpanded(expanded: boolean) {
    set({ expanded });
  },

  setInputText(inputText: string) {
    set({ inputText });
  },

  setOrbState(orbState: OrbState) {
    set({ orbState });
  },

  clearMessages() {
    set({ messages: [], conversationId: null });
  },

  async connect() {
    try {
      const { channel } = await joinChannel("jarvis:lobby");
      set({ channel });

      channel.on("orb_state", (payload: { state: OrbState }) => {
        set({ orbState: payload.state });
      });
    } catch {
      // Channel may not exist yet — that's fine
    }
  },
}));

function parseActionCard(
  _reply: string,
  toolCalls: unknown[] | undefined,
): ActionCard | undefined {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return undefined;

  const first = toolCalls[0] as Record<string, unknown> | undefined;
  if (!first || typeof first !== "object") return undefined;

  const tool = first.tool as string | undefined;
  if (tool === "brain_dump:create_item") {
    return { type: "brain_dump", title: String(first.title ?? "New item") };
  }

  return undefined;
}
