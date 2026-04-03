import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";

export interface IntentNode {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly level: number;
  readonly level_name: string;
  readonly parent_id: string | null;
  readonly status: string;
  readonly project_id: string | null;
  readonly linked_task_ids: readonly string[];
  readonly linked_wiki_path: string | null;
  readonly created_at: string;
  readonly children?: readonly IntentNode[];
}

interface IntentState {
  nodes: readonly IntentNode[];
  tree: readonly IntentNode[];
  selectedNode: IntentNode | null;
  selectedProject: string | null;
  zoomLevel: number;
  loading: boolean;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  selectProject: (projectId: string | null) => void;
  loadTree: (projectId: string) => Promise<void>;
  selectNode: (node: IntentNode | null) => void;
  createNode: (attrs: Record<string, unknown>) => Promise<void>;
  updateNode: (id: string, attrs: Record<string, unknown>) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  setZoomLevel: (level: number) => void;
  exportMarkdown: (projectId: string) => Promise<string>;
}

export const useIntentStore = create<IntentState>((set, get) => ({
  nodes: [],
  tree: [],
  selectedNode: null,
  selectedProject: null,
  zoomLevel: 4,
  loading: false,
  connected: false,
  channel: null,

  async loadViaRest() {
    set({ loading: true });
    try {
      const { selectedProject } = get();
      const params = selectedProject ? `?project_id=${selectedProject}` : "";
      const data = await api.get<{ nodes: IntentNode[] }>(`/intent/nodes${params}`);
      set({ nodes: data.nodes, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async connect() {
    try {
      const { channel, response } = await joinChannel("intent:live");
      const data = response as { nodes: IntentNode[] };
      set({ channel, connected: true, nodes: data.nodes });

      channel.on("node_created", () => { get().loadViaRest(); });
      channel.on("node_updated", () => { get().loadViaRest(); });
      channel.on("node_deleted", () => { get().loadViaRest(); });
    } catch {
      // REST fallback
    }
  },

  selectProject(projectId) {
    set({ selectedProject: projectId, tree: [], selectedNode: null });
    if (projectId) {
      get().loadTree(projectId);
    }
  },

  async loadTree(projectId) {
    const data = await api.get<{ tree: IntentNode[] }>(`/intent/tree/${projectId}`);
    set({ tree: data.tree });
  },

  selectNode(node) {
    set({ selectedNode: node });
  },

  async createNode(attrs) {
    await api.post("/intent/nodes", attrs);
    const { selectedProject } = get();
    if (selectedProject) get().loadTree(selectedProject);
    get().loadViaRest();
  },

  async updateNode(id, attrs) {
    await api.put(`/intent/nodes/${id}`, attrs);
    const { selectedProject } = get();
    if (selectedProject) get().loadTree(selectedProject);
    get().loadViaRest();
  },

  async deleteNode(id) {
    await api.delete(`/intent/nodes/${id}`);
    set({ selectedNode: null });
    const { selectedProject } = get();
    if (selectedProject) get().loadTree(selectedProject);
    get().loadViaRest();
  },

  setZoomLevel(level) {
    set({ zoomLevel: level });
  },

  async exportMarkdown(projectId) {
    const data = await api.get<{ markdown: string }>(`/intent/export/${projectId}`);
    return data.markdown;
  },
}));
