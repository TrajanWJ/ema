import { create } from "zustand";
import { api } from "@/lib/api";

interface GraphNode {
  readonly id: string;
  readonly name: string;
  readonly type: "project" | "proposal" | "execution" | "intent" | "vault_note";
  readonly status: string;
  readonly health_score: number;
  readonly metrics: Record<string, unknown>;
  readonly color: string;
  readonly inserted_at: string;
  readonly detail?: Record<string, unknown>;
}

interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly type: string;
  readonly label: string;
}

interface GraphData {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

interface GraphState {
  graph: GraphData;
  selectedNode: GraphNode | null;
  loading: boolean;
  error: string | null;
  focusProjectId: string | null;
  loadViaRest: () => Promise<void>;
  focusProject: (id: string | null) => Promise<void>;
  selectNode: (node: GraphNode | null) => void;
  loadNodeDetail: (id: string) => Promise<GraphNode | null>;
  refresh: () => Promise<void>;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  graph: { nodes: [], edges: [] },
  selectedNode: null,
  loading: false,
  error: null,
  focusProjectId: null,

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const focusId = get().focusProjectId;
      const params = focusId ? `?project_id=${focusId}` : "";
      const data = await api.get<GraphData>(`/project-graph${params}`);
      set({ graph: data, loading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to load graph",
        loading: false,
      });
    }
  },

  async focusProject(id: string | null) {
    set({ focusProjectId: id });
    await get().loadViaRest();
  },

  selectNode(node: GraphNode | null) {
    set({ selectedNode: node });
  },

  async loadNodeDetail(id: string) {
    try {
      const data = await api.get<{ node: GraphNode }>(`/project-graph/nodes/${id}`);
      set({ selectedNode: data.node });
      return data.node;
    } catch {
      return null;
    }
  },

  async refresh() {
    await get().loadViaRest();
  },
}));
