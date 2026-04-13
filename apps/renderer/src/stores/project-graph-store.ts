import { create } from "zustand";
import { joinChannel } from "@/lib/ws";
import { api } from "@/lib/api";
import type { Channel } from "phoenix";

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

interface ProjectGraphState {
  graph: GraphData;
  selectedNode: GraphNode | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  channel: Channel | null;
  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  selectNode: (node: GraphNode | null) => void;
  loadNodeDetail: (id: string) => Promise<GraphNode | null>;
}

export type { GraphNode, GraphEdge, GraphData };

export const useProjectGraphStore = create<ProjectGraphState>((set, get) => ({
  graph: { nodes: [], edges: [] },
  selectedNode: null,
  loading: false,
  error: null,
  connected: false,
  channel: null,

  async loadViaRest() {
    set({ loading: true, error: null });
    try {
      const data = await api.get<GraphData>("/project-graph");
      set({ graph: data, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  async connect() {
    try {
      const { channel } = await joinChannel("project_graph:lobby");
      set({ channel, connected: true });

      channel.on("graph_updated", () => {
        get().loadViaRest();
      });

      channel.on("node_updated", (node: GraphNode) => {
        set((state) => ({
          graph: {
            ...state.graph,
            nodes: state.graph.nodes.map((n) =>
              n.id === node.id ? node : n,
            ),
          },
          selectedNode:
            state.selectedNode?.id === node.id ? node : state.selectedNode,
        }));
      });
    } catch (e) {
      console.warn("Channel join failed:", e);
    }
  },

  selectNode(node) {
    set({ selectedNode: node });
  },

  async loadNodeDetail(id) {
    try {
      const data = await api.get<{ node: GraphNode }>(
        `/project-graph/nodes/${id}`,
      );
      set({ selectedNode: data.node });
      return data.node;
    } catch {
      return null;
    }
  },
}));
