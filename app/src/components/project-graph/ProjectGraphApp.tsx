import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import ForceGraph2D, {
  type ForceGraphMethods,
  type NodeObject,
  type LinkObject,
} from "react-force-graph-2d";
import { useGraphStore } from "@/stores/graph-store";

// ── Types ────────────────────────────────────────────────────────────────────

interface GraphNode extends NodeObject {
  id: string;
  name: string;
  type: string;
  status: string;
  health_score: number;
  metrics: Record<string, unknown>;
  color: string;
}

interface GraphLink extends LinkObject {
  source: string;
  target: string;
  type: string;
  label: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  project: "#4f8ef7",
  proposal: "#f7b94f",
  execution: "#4ff7a0",
  decision: "#f74f8e",
  intent: "#b94ff7",
  vault_note: "#8b8b8b",
};

const EDGE_COLORS: Record<string, string> = {
  has_proposal: "#f7b94f55",
  has_execution: "#4ff7a055",
  implements: "#b94ff755",
  references: "#8b8b8b55",
  evolves_from: "#f74f8e55",
};

const REFRESH_INTERVAL = 30_000;

// ── Component ────────────────────────────────────────────────────────────────

export function ProjectGraphApp() {
  const { graph, selectedNode, loading, error, loadViaRest, selectNode, loadNodeDetail } =
    useGraphStore();
  const [search, setSearch] = useState("");
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);

  // Initial load + auto-refresh
  useEffect(() => {
    loadViaRest();
    const interval = setInterval(loadViaRest, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadViaRest]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Transform data for force-graph
  const graphData = useMemo(() => {
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, true]));
    const nodes: GraphNode[] = graph.nodes.map((n) => ({
      ...n,
      color: NODE_COLORS[n.type] ?? "#888",
    }));
    // Only include edges where both endpoints exist
    const links: GraphLink[] = graph.edges
      .filter((e) => nodeMap.has(e.from) && nodeMap.has(e.to))
      .map((e) => ({
        source: e.from,
        target: e.to,
        type: e.type,
        label: e.label,
      }));
    return { nodes, links };
  }, [graph]);

  // Search filter
  const highlightedNodes = useMemo(() => {
    if (!search.trim()) return new Set<string>();
    const q = search.toLowerCase();
    return new Set(
      graph.nodes.filter((n) => n.name.toLowerCase().includes(q)).map((n) => n.id)
    );
  }, [search, graph.nodes]);

  const handleNodeClick = useCallback(
    (node: NodeObject) => {
      const gn = node as GraphNode;
      loadNodeDetail(gn.id);
    },
    [loadNodeDetail]
  );

  const nodeCanvasObject = useCallback(
    (node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const gn = node as GraphNode;
      const x = gn.x ?? 0;
      const y = gn.y ?? 0;
      const size = 4 + (gn.health_score ?? 0.5) * 8;
      const isHighlighted = highlightedNodes.size > 0 && highlightedNodes.has(gn.id);
      const isSelected = selectedNode?.id === gn.id;
      const dimmed = highlightedNodes.size > 0 && !isHighlighted;

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, size, 0, 2 * Math.PI);
      ctx.fillStyle = dimmed ? `${gn.color}44` : gn.color;
      ctx.fill();

      // Selection ring
      if (isSelected || isHighlighted) {
        ctx.strokeStyle = isSelected ? "#fff" : "#ffcc00";
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // Label
      if (globalScale > 1.2 || isHighlighted || isSelected) {
        const label = gn.name;
        const fontSize = Math.max(10 / globalScale, 2);
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = dimmed ? "#666" : "#e0e0e0";
        ctx.fillText(label, x, y + size + 2);
      }
    },
    [highlightedNodes, selectedNode]
  );

  const linkColor = useCallback((link: LinkObject) => {
    const gl = link as GraphLink;
    return EDGE_COLORS[gl.type] ?? "#44444455";
  }, []);

  if (loading && graph.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400">
        <div className="text-center">
          <div className="animate-spin mb-4 text-2xl">⟳</div>
          <div>Loading project graph…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        <div className="text-center">
          <div className="text-2xl mb-2">⚠</div>
          <div>{error}</div>
          <button
            onClick={loadViaRest}
            className="mt-3 px-3 py-1 bg-zinc-700 rounded hover:bg-zinc-600 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-200">
      {/* Main graph area */}
      <div ref={containerRef} className="flex-1 relative">
        {/* Top bar */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes…"
            className="px-3 py-1.5 bg-zinc-800/90 border border-zinc-700 rounded-lg text-sm w-64 backdrop-blur-sm placeholder:text-zinc-500"
          />
          <div className="flex gap-2 text-xs">
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <span key={type} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
                {type}
              </span>
            ))}
          </div>
          <span className="ml-auto text-xs text-zinc-500">
            {graph.nodes.length} nodes · {graph.edges.length} edges
          </span>
        </div>

        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          nodeCanvasObject={nodeCanvasObject}
          linkColor={linkColor}
          linkWidth={1}
          linkDirectionalArrowLength={3.5}
          linkDirectionalArrowRelPos={1}
          onNodeClick={handleNodeClick}
          backgroundColor="#09090b"
          cooldownTicks={100}
          nodePointerAreaPaint={(node, color, ctx) => {
            const gn = node as GraphNode;
            const size = 4 + (gn.health_score ?? 0.5) * 8;
            ctx.beginPath();
            ctx.arc(gn.x ?? 0, gn.y ?? 0, size + 2, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
        />
      </div>

      {/* Side panel */}
      {selectedNode && (
        <div className="w-80 border-l border-zinc-800 bg-zinc-900 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">{selectedNode.name}</h3>
            <button
              onClick={() => selectNode(null)}
              className="text-zinc-500 hover:text-zinc-300 text-lg"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Type</span>
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: NODE_COLORS[selectedNode.type] + "33", color: NODE_COLORS[selectedNode.type] }}
              >
                {selectedNode.type}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-zinc-400">Status</span>
              <span>{selectedNode.status}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-zinc-400">Health</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(selectedNode.health_score ?? 0) * 100}%`,
                      backgroundColor:
                        selectedNode.health_score > 0.7
                          ? "#4ff7a0"
                          : selectedNode.health_score > 0.4
                          ? "#f7b94f"
                          : "#f74f8e",
                    }}
                  />
                </div>
                <span>{((selectedNode.health_score ?? 0) * 100).toFixed(0)}%</span>
              </div>
            </div>

            {selectedNode.metrics && (
              <div className="border-t border-zinc-800 pt-3 mt-3">
                <h4 className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Metrics</h4>
                {Object.entries(selectedNode.metrics).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-0.5">
                    <span className="text-zinc-500">{k.replace(/_/g, " ")}</span>
                    <span>{String(v ?? "—")}</span>
                  </div>
                ))}
              </div>
            )}

            {selectedNode.detail && (
              <div className="border-t border-zinc-800 pt-3 mt-3">
                <h4 className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Details</h4>
                {Object.entries(selectedNode.detail).map(([k, v]) =>
                  v ? (
                    <div key={k} className="py-0.5">
                      <span className="text-zinc-500 text-xs">{k}</span>
                      <p className="text-zinc-300 text-xs mt-0.5 break-words">{String(v)}</p>
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
