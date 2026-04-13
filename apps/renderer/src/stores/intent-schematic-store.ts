import { create } from "zustand";
import { api } from "@/lib/api";
import type { IntentNode, ChatMessage } from "@/types/intents";
import type { VaultNote } from "@/types/vault";

interface IntentSchematicState {
  intentTree: IntentNode[];
  wikiNotes: VaultNote[];
  selectedPath: string | null;
  selectedContent: string | null;
  selectedIntent: IntentNode | null;
  editMode: boolean;
  editContent: string;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  loading: boolean;
  error: string | null;

  loadTree: () => Promise<void>;
  selectPage: (path: string) => Promise<void>;
  savePage: () => Promise<void>;
  setEditMode: (mode: boolean) => void;
  setEditContent: (content: string) => void;
  sendChat: (message: string) => Promise<void>;
  findIntentForPath: (path: string) => IntentNode | null;
}

function flattenTree(nodes: IntentNode[]): IntentNode[] {
  const result: IntentNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}

export const useIntentSchematicStore = create<IntentSchematicState>(
  (set, get) => ({
    intentTree: [],
    wikiNotes: [],
    selectedPath: null,
    selectedContent: null,
    selectedIntent: null,
    editMode: false,
    editContent: "",
    chatMessages: [],
    chatLoading: false,
    loading: false,
    error: null,

    loadTree: async () => {
      set({ loading: true, error: null });
      try {
        const [treeRes, notesRes] = await Promise.all([
          api.get<{ tree: IntentNode[] }>("/intents/tree"),
          api.get<{ notes: VaultNote[] }>("/vault/search?q=Intent&space=wiki"),
        ]);
        const tree = treeRes?.tree ?? [];
        const allNotes: VaultNote[] = notesRes?.notes ?? [];
        const wikiNotes = allNotes.filter((n: VaultNote) =>
          n.file_path?.startsWith("wiki/Intents/") && n.file_path.endsWith(".md")
        );
        set({ intentTree: tree, wikiNotes, loading: false });
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : "Failed to load",
          loading: false,
        });
      }
    },

    selectPage: async (path: string) => {
      set({ selectedPath: path, selectedContent: null, editMode: false });
      try {
        const res = await api.get<{ content?: string }>(`/vault/note?path=${encodeURIComponent(path)}`);
        const content = res?.content ?? "";
        const intent = get().findIntentForPath(path);
        set({
          selectedContent: content,
          selectedIntent: intent,
          editContent: content,
        });
      } catch {
        set({ selectedContent: "Failed to load page content." });
      }
    },

    savePage: async () => {
      const { selectedPath, editContent } = get();
      if (!selectedPath) return;
      try {
        await api.put("/vault/note", {
          path: selectedPath,
          content: editContent,
        });
        set({ selectedContent: editContent, editMode: false });
      } catch {
        // silent fail — content stays in editor
      }
    },

    setEditMode: (mode: boolean) => {
      if (mode) {
        set({ editMode: true, editContent: get().selectedContent ?? "" });
      } else {
        set({ editMode: false });
      }
    },

    setEditContent: (content: string) => set({ editContent: content }),

    sendChat: async (message: string) => {
      const { selectedPath, selectedIntent, chatMessages } = get();
      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };
      set({ chatMessages: [...chatMessages, userMsg], chatLoading: true });

      try {
        const res = await api.post<{ reply?: string; content?: string }>("/agents/ema/chat", {
          content: message,
          metadata: {
            intent_path: selectedPath,
            intent_id: selectedIntent?.id,
            channel_type: "intent_chat",
          },
        });
        const reply = res?.reply ?? res?.content ?? "No response.";
        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now()}_reply`,
          role: "assistant",
          content: reply,
          timestamp: new Date().toISOString(),
        };
        set((s) => ({
          chatMessages: [...s.chatMessages, assistantMsg],
          chatLoading: false,
        }));
        // Reload page in case agent edited it
        if (selectedPath) {
          get().selectPage(selectedPath);
        }
      } catch {
        set({ chatLoading: false });
      }
    },

    findIntentForPath: (path: string) => {
      const slug = path
        .split("/")
        .pop()
        ?.replace(".md", "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      if (!slug) return null;
      const flat = flattenTree(get().intentTree);
      return flat.find((n) => n.slug === slug) ?? null;
    },
  })
);
