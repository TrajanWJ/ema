import { create } from "zustand";
import { api } from "@/lib/api";
import { joinChannel } from "@/lib/ws";
import type { Channel } from "phoenix";

export type KGNodeType =
  | "project"
  | "proposal"
  | "execution"
  | "task"
  | "vault_note";

export interface KGNode {
  readonly id: string;
  readonly type: KGNodeType;
  readonly label: string;
  readonly metadata: Record<string, unknown>;
}

export interface KGEdge {
  readonly from: string;
  readonly to: string;
  readonly type: string;
}

interface GraphResponse {
  readonly nodes: readonly KGNode[];
  readonly edges: readonly KGEdge[];
}

interface KnowledgeGraphState {
  nodes: readonly KGNode[];
  edges: readonly KGEdge[];
  visibleTypes: Record<KGNodeType, boolean>;
  search: string;
  selectedNode: KGNode | null;
  selectedEdges: readonly KGEdge[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  channel: Channel | null;

  loadViaRest: () => Promise<void>;
  connect: () => Promise<void>;
  selectNode: (node: KGNode | null) => void;
  toggleType: (type: KGNodeType) => void;
  setSearch: (q: string) => void;
  filteredNodes: () => readonly KGNode[];
  filteredEdges: () => readonly KGEdge[];
  matchingIds: () => Set<string>;
}

export const ALL_NODE_TYPES: readonly KGNodeType[] = [
  "project",
  "proposal",
  "execution",
  "task",
  "vault_note",
];

export const useKnowledgeGraphStore = create<KnowledgeGraphState>(
  (set, get) => ({
    nodes: [],
    edges: [],
    visibleTypes: {
      project: true,
      proposal: true,
      execution: true,
      task: true,
      vault_note: true,
    },
    search: "",
    selectedNode: null,
    selectedEdges: [],
    loading: false,
    error: null,
    connected: false,
    channel: null,

    async loadViaRest() {
      set({ loading: true, error: null });
      try {
        const data = await api.get<GraphResponse>("/intelligence/graph");
        set({ nodes: data.nodes, edges: data.edges, loading: false });
      } catch (err) {
        set({
          error: err instanceof Error ? err.message : "Failed to load graph",
          loading: false,
        });
      }
    },

    async connect() {
      try {
        const { channel } = await joinChannel("knowledge_graph:lobby");
        set({ channel, connected: true });
        channel.on("graph_updated", () => get().loadViaRest());
        channel.on("node_updated", (payload: { node: KGNode }) => {
          set((state) => ({
            nodes: state.nodes.map((n) =>
              n.id === payload.node.id ? payload.node : n,
            ),
            selectedNode:
              state.selectedNode?.id === payload.node.id
                ? payload.node
                : state.selectedNode,
          }));
        });
      } catch {
        // WS optional — REST is source of truth
      }
    },

    selectNode(node) {
      if (!node) {
        set({ selectedNode: null, selectedEdges: [] });
        return;
      }
      const edges = get().edges.filter(
        (e) => e.from === node.id || e.to === node.id,
      );
      set({ selectedNode: node, selectedEdges: edges });
    },

    toggleType(type) {
      set((state) => ({
        visibleTypes: {
          ...state.visibleTypes,
          [type]: !state.visibleTypes[type],
        },
      }));
    },

    setSearch(q) {
      set({ search: q });
    },

    filteredNodes() {
      const { nodes, visibleTypes } = get();
      return nodes.filter((n) => visibleTypes[n.type]);
    },

    filteredEdges() {
      const visible = new Set(get().filteredNodes().map((n) => n.id));
      return get().edges.filter(
        (e) => visible.has(e.from) && visible.has(e.to),
      );
    },

    matchingIds() {
      const { search, nodes } = get();
      if (!search.trim()) return new Set<string>();
      const q = search.toLowerCase();
      return new Set(
        nodes
          .filter((n) => n.label.toLowerCase().includes(q))
          .map((n) => n.id),
      );
    },
  }),
);
