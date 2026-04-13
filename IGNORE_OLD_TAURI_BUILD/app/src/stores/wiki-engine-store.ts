import { create } from "zustand";
import { api } from "@/lib/api";
import type { IntentNode, ChatMessage } from "@/types/intents";
import type { VaultNote } from "@/types/vault";

/** Wiki namespace = top-level directory in the vault */
export interface WikiNamespace {
  readonly name: string;
  readonly path: string;
  readonly count: number;
  readonly icon: string;
  readonly color: string;
  readonly description: string;
}

/** Known wiki namespaces with metadata */
const NAMESPACE_META: Record<string, { icon: string; color: string; description: string }> = {
  "Intents":        { icon: "🗺️", color: "#a78bfa", description: "Intent schematic — goals, projects, features, tasks" },
  "research":       { icon: "🔬", color: "#2dd4a8", description: "Research library — tools, patterns, evaluations" },
  "system":         { icon: "⚙",  color: "#6b95f0", description: "System architecture, intelligence, channels" },
  "agents":         { icon: "🤖", color: "#f59e0b", description: "Agent profiles, sessions, evolution records" },
  "projects":       { icon: "📁", color: "#22c55e", description: "Project docs, specs, plans" },
  "architecture":   { icon: "🏗",  color: "#9b59b6", description: "Architecture decisions, patterns" },
  "operations":     { icon: "🔧", color: "#ef4444", description: "Runbooks, infrastructure, procedures" },
  "reference":      { icon: "📚", color: "#64748b", description: "Patterns, templates, best practices" },
  "sessions":       { icon: "💬", color: "#06b6d4", description: "Agent session logs" },
  "skills":         { icon: "⚡", color: "#ec4899", description: "Agent skills library" },
  "codebases":      { icon: "💻", color: "#f97316", description: "Codebase architecture references" },
  "security":       { icon: "🔒", color: "#e24b4a", description: "Security posture, audits" },
  "learnings":      { icon: "💡", color: "#eab308", description: "Lessons learned, gotchas" },
  "daily-notes":    { icon: "📅", color: "#8b5cf6", description: "Daily planning and notes" },
  "templates":      { icon: "📋", color: "#475569", description: "Page templates and archetypes" },
  "knowledge":      { icon: "🧠", color: "#2dd4a8", description: "Knowledge capture and organization" },
  "openclaw":       { icon: "🐙", color: "#a78bfa", description: "Archived OpenClaw docs" },
  "trajan":         { icon: "👤", color: "#6b95f0", description: "Personal docs" },
  "decisions":      { icon: "⚖",  color: "#f59e0b", description: "Decision records" },
  "reports":        { icon: "📊", color: "#22c55e", description: "Analysis reports" },
  "agent-learnings": { icon: "📝", color: "#ec4899", description: "Lessons from agent runs" },
  "tools":          { icon: "🛠",  color: "#64748b", description: "Tool evaluations" },
  "business":       { icon: "💼", color: "#f97316", description: "Business context" },
  "intents":        { icon: "🎯", color: "#a78bfa", description: "Older intent tracking" },
};

const DEFAULT_META = { icon: "📄", color: "#64748b", description: "" };

export interface WikiEngineState {
  // All wiki data
  allNotes: VaultNote[];
  namespaces: WikiNamespace[];
  intentTree: IntentNode[];

  // Navigation
  activeNamespace: string | null;
  searchQuery: string;

  // Current page
  selectedPath: string | null;
  selectedContent: string | null;
  selectedIntent: IntentNode | null;

  // Editing
  editMode: boolean;
  editContent: string;

  // Chat
  chatMessages: ChatMessage[];
  chatLoading: boolean;

  // State
  loading: boolean;
  error: string | null;

  // Actions
  loadWiki: () => Promise<void>;
  setNamespace: (ns: string | null) => void;
  setSearch: (q: string) => void;
  selectPage: (path: string) => Promise<void>;
  savePage: () => Promise<void>;
  setEditMode: (mode: boolean) => void;
  setEditContent: (content: string) => void;
  sendChat: (message: string) => Promise<void>;
  getNotesForNamespace: (ns: string | null) => VaultNote[];
  findIntentForPath: (path: string) => IntentNode | null;
}

function flattenTree(nodes: IntentNode[]): IntentNode[] {
  const result: IntentNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) result.push(...flattenTree(node.children));
  }
  return result;
}

export const useWikiEngineStore = create<WikiEngineState>((set, get) => ({
  allNotes: [],
  namespaces: [],
  intentTree: [],
  activeNamespace: null,
  searchQuery: "",
  selectedPath: null,
  selectedContent: null,
  selectedIntent: null,
  editMode: false,
  editContent: "",
  chatMessages: [],
  chatLoading: false,
  loading: false,
  error: null,

  loadWiki: async () => {
    set({ loading: true, error: null });
    try {
      const [notesRes, treeRes] = await Promise.all([
        api.get<{ notes: VaultNote[] }>("/vault/search?q=&space=wiki"),
        api.get<{ tree: IntentNode[] }>("/intents/tree"),
      ]);

      const allNotes = notesRes?.notes ?? [];
      const intentTree = treeRes?.tree ?? [];

      // Build namespace list from top-level directories
      const nsCounts = new Map<string, number>();
      for (const note of allNotes) {
        const parts = note.file_path?.split("/");
        if (parts && parts.length > 1) {
          const ns = parts[0] === "wiki" && parts.length > 2 ? parts[1] : parts[0];
          nsCounts.set(ns, (nsCounts.get(ns) ?? 0) + 1);
        }
      }

      const namespaces: WikiNamespace[] = [...nsCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => {
          const meta = NAMESPACE_META[name] ?? DEFAULT_META;
          return {
            name,
            path: name,
            count,
            icon: meta.icon,
            color: meta.color,
            description: meta.description,
          };
        });

      set({ allNotes, namespaces, intentTree, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load wiki",
        loading: false,
      });
    }
  },

  setNamespace: (ns) => set({ activeNamespace: ns }),
  setSearch: (q) => set({ searchQuery: q }),

  getNotesForNamespace: (ns) => {
    const { allNotes, searchQuery } = get();
    let filtered = allNotes;

    if (ns) {
      filtered = filtered.filter((n) => {
        const parts = n.file_path?.split("/") ?? [];
        const noteNs = parts[0] === "wiki" && parts.length > 2 ? parts[1] : parts[0];
        return noteNs === ns;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title?.toLowerCase().includes(q) ||
          n.file_path?.toLowerCase().includes(q)
      );
    }

    return filtered;
  },

  selectPage: async (path) => {
    set({ selectedPath: path, selectedContent: null, editMode: false });
    try {
      const res = await api.get<{ content?: string }>(
        `/vault/note?path=${encodeURIComponent(path)}`
      );
      const content = res?.content ?? "";
      const intent = get().findIntentForPath(path);
      set({ selectedContent: content, selectedIntent: intent, editContent: content });
    } catch {
      set({ selectedContent: "Failed to load page." });
    }
  },

  savePage: async () => {
    const { selectedPath, editContent } = get();
    if (!selectedPath) return;
    try {
      await api.put("/vault/note", { path: selectedPath, content: editContent });
      set({ selectedContent: editContent, editMode: false });
    } catch {
      /* keep edit content */
    }
  },

  setEditMode: (mode) => {
    if (mode) set({ editMode: true, editContent: get().selectedContent ?? "" });
    else set({ editMode: false });
  },

  setEditContent: (content) => set({ editContent: content }),

  sendChat: async (message) => {
    const { selectedPath, selectedIntent, chatMessages } = get();
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    set({ chatMessages: [...chatMessages, userMsg], chatLoading: true });

    try {
      const res = await api.post<{ reply?: string; content?: string }>(
        "/agents/ema/chat",
        {
          content: message,
          metadata: {
            intent_path: selectedPath,
            intent_id: selectedIntent?.id,
            channel_type: "wiki_chat",
          },
        }
      );
      const reply = res?.reply ?? res?.content ?? "No response.";
      set((s) => ({
        chatMessages: [
          ...s.chatMessages,
          {
            id: `msg_${Date.now()}_r`,
            role: "assistant" as const,
            content: reply,
            timestamp: new Date().toISOString(),
          },
        ],
        chatLoading: false,
      }));
      if (selectedPath) get().selectPage(selectedPath);
    } catch {
      set({ chatLoading: false });
    }
  },

  findIntentForPath: (path) => {
    const slug = path
      .split("/")
      .pop()
      ?.replace(".md", "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!slug) return null;
    return flattenTree(get().intentTree).find((n) => n.slug === slug) ?? null;
  },
}));

// Re-export for backwards compat
export const useIntentSchematicStore = useWikiEngineStore;
