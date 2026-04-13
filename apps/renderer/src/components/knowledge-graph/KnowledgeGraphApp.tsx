import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ForceGraph2D, {
  type ForceGraphMethods,
  type NodeObject,
  type LinkObject,
} from "react-force-graph-2d";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { APP_CONFIGS } from "@/types/workspace";
import {
  useKnowledgeGraphStore,
  ALL_NODE_TYPES,
  type KGNodeType,
  type KGNode,
} from "@/stores/knowledge-graph-store";

const NODE_COLORS: Record<KGNodeType, string> = {
  project: "#3b82f6",
  proposal: "#8b5cf6",
  execution: "#10b981",
  task: "#f59e0b",
  vault_note: "#6b7280",
};

const NODE_LABELS: Record<KGNodeType, string> = {
  project: "Projects",
  proposal: "Proposals",
  execution: "Executions",
  task: "Tasks",
  vault_note: "Vault Notes",
};

const REFRESH_MS = 30_000;
const cfg = APP_CONFIGS["knowledge-graph"];

interface FGNode extends NodeObject {
  id: string;
  label: string;
  type: KGNodeType;
  metadata: Record<string, unknown>;
}

interface FGLink extends LinkObject {
  source: string;
  target: string;
  type: string;
}

export function KnowledgeGraphApp() {
  const store = useKnowledgeGraphStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [searchInput, setSearchInput] = useState("");

  // Load + auto-refresh
  useEffect(() => {
    store.loadViaRest();
    store.connect();
    const interval = setInterval(() => store.loadViaRest(), REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sync search to store
  useEffect(() => {
    store.setSearch(searchInput);
  }, [searchInput]);

  const filteredNodes = store.filteredNodes();
  const filteredEdges = store.filteredEdges();
  const matchingIds = store.matchingIds();

  // Type counts from full node set
  const typeCounts = useMemo(() => {
    const counts: Record<KGNodeType, number> = {
      project: 0,
      proposal: 0,
      execution: 0,
      task: 0,
      vault_note: 0,
    };
    for (const n of store.nodes) counts[n.type]++;
    return counts;
  }, [store.nodes]);

  // Build force-graph data
  const graphData = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const nodes: FGNode[] = filteredNodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      metadata: n.metadata,
    }));
    const links: FGLink[] = filteredEdges
      .filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))
      .map((e) => ({ source: e.from, target: e.to, type: e.type }));
    return { nodes, links };
  }, [filteredNodes, filteredEdges]);

  // Node edges for detail panel
  const selectedEdges = store.selectedEdges;

  const linkedNodes = useMemo(() => {
    if (!store.selectedNode) return [];
    const ids = new Set(
      selectedEdges.flatMap((e) => [e.from, e.to]).filter((id) => id !== store.selectedNode?.id),
    );
    return store.nodes.filter((n) => ids.has(n.id));
  }, [store.selectedNode, selectedEdges, store.nodes]);

  const handleNodeClick = useCallback(
    (node: NodeObject) => store.selectNode(node as unknown as KGNode),
    [],
  );

  const nodeCanvasObject = useCallback(
    (node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as FGNode;
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const baseSize = 5;
      const color = NODE_COLORS[n.type] ?? "#6b7280";
      const isMatch = matchingIds.size > 0 && matchingIds.has(n.id);
      const isDimmed = matchingIds.size > 0 && !isMatch;
      const isSelected = store.selectedNode?.id === n.id;

      // Circle
      ctx.beginPath();
      ctx.arc(x, y, baseSize, 0, 2 * Math.PI);
      ctx.fillStyle = isDimmed ? `${color}33` : color;
      ctx.fill();

      // Selection / match ring
      if (isSelected || isMatch) {
        ctx.strokeStyle = isSelected ? "#ffffff" : "#fbbf24";
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // Label
      if (globalScale > 1.0 || isMatch || isSelected) {
        const fontSize = Math.max(10 / globalScale, 2);
        ctx.font = `${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isDimmed ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.7)";
        ctx.fillText(n.label, x, y + baseSize + 2);
      }
    },
    [matchingIds, store.selectedNode],
  );

  const nodePointerArea = useCallback(
    (node: NodeObject, color: string, ctx: CanvasRenderingContext2D) => {
      const n = node as FGNode;
      ctx.beginPath();
      ctx.arc(n.x ?? 0, n.y ?? 0, 7, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    },
    [],
  );

  const linkColor = useCallback(() => "rgba(255,255,255,0.1)", []);

  if (!cfg) return null;

  return (
    <AppWindowChrome
      appId="knowledge-graph"
      title={cfg.title}
      icon={cfg.icon}
      accent={cfg.accent}
    >
      <div className="flex h-full overflow-hidden">
        {/* Left filter panel */}
        <div className="w-52 min-w-52 border-r border-white/[0.06] bg-white/[0.03] p-4 flex flex-col gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">
            Node Types
          </div>
          {ALL_NODE_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => store.toggleType(type)}
              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-[13px] transition-all duration-150 cursor-pointer border"
              style={{
                borderColor: store.visibleTypes[type]
                  ? `${NODE_COLORS[type]}44`
                  : "rgba(255,255,255,0.06)",
                background: store.visibleTypes[type]
                  ? `${NODE_COLORS[type]}18`
                  : "rgba(255,255,255,0.02)",
                color: store.visibleTypes[type]
                  ? NODE_COLORS[type]
                  : "rgba(255,255,255,0.3)",
              }}
            >
              <span className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: store.visibleTypes[type]
                      ? NODE_COLORS[type]
                      : "rgba(255,255,255,0.15)",
                  }}
                />
                {NODE_LABELS[type]}
              </span>
              <span className="text-[11px] opacity-60 tabular-nums">
                {typeCounts[type]}
              </span>
            </button>
          ))}

          <div className="mt-auto text-[11px] text-white/25 text-center">
            {filteredNodes.length} nodes / {filteredEdges.length} edges
          </div>
        </div>

        {/* Center — graph */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden">
          {/* Search bar */}
          <div className="absolute top-3 left-3 right-3 z-10">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search nodes..."
              className="w-64 px-3 py-1.5 bg-zinc-800/90 border border-zinc-700 rounded-lg text-sm backdrop-blur-sm placeholder:text-zinc-500 text-zinc-200"
            />
            {matchingIds.size > 0 && (
              <span className="ml-3 text-xs text-amber-400/70">
                {matchingIds.size} match{matchingIds.size !== 1 ? "es" : ""}
              </span>
            )}
          </div>

          {store.loading && store.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/30 text-sm">
              Loading graph...
            </div>
          ) : store.error ? (
            <div className="flex flex-col items-center justify-center h-full text-red-400 text-sm gap-3">
              <span>{store.error}</span>
              <button
                onClick={() => store.loadViaRest()}
                className="px-3 py-1 bg-zinc-700 rounded hover:bg-zinc-600 text-xs"
              >
                Retry
              </button>
            </div>
          ) : filteredNodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-white/30 text-sm">
              No nodes to display
            </div>
          ) : (
            <ForceGraph2D
              ref={fgRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={graphData}
              nodeCanvasObject={nodeCanvasObject}
              nodePointerAreaPaint={nodePointerArea}
              onNodeClick={handleNodeClick}
              linkColor={linkColor}
              linkWidth={1}
              linkDirectionalArrowLength={3.5}
              linkDirectionalArrowRelPos={1}
              backgroundColor="rgba(0,0,0,0)"
              cooldownTicks={100}
            />
          )}
        </div>

        {/* Right detail panel */}
        {store.selectedNode && (
          <div className="w-72 min-w-72 border-l border-white/[0.06] bg-white/[0.03] p-4 overflow-y-auto flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <h3 className="text-[15px] font-semibold text-white/87 leading-tight">
                {store.selectedNode.label}
              </h3>
              <button
                onClick={() => store.selectNode(null)}
                className="text-white/30 hover:text-white/60 text-lg px-1 bg-transparent border-none cursor-pointer"
              >
                x
              </button>
            </div>

            <span
              className="self-start px-2 py-0.5 rounded text-[11px] font-semibold"
              style={{
                background: `${NODE_COLORS[store.selectedNode.type]}22`,
                color: NODE_COLORS[store.selectedNode.type],
                border: `1px solid ${NODE_COLORS[store.selectedNode.type]}44`,
              }}
            >
              {store.selectedNode.type.replace("_", " ")}
            </span>

            {/* Metadata */}
            <div className="flex flex-col gap-1.5 mt-1">
              {Object.entries(store.selectedNode.metadata).map(
                ([key, value]) => (
                  <div key={key} className="flex gap-2 text-xs leading-relaxed">
                    <span className="text-white/40 min-w-[80px] shrink-0">
                      {key}
                    </span>
                    <span className="text-white/70 break-words">
                      {typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value ?? "\u2014")}
                    </span>
                  </div>
                ),
              )}
            </div>

            {/* Linked nodes */}
            {linkedNodes.length > 0 && (
              <div className="border-t border-white/[0.06] pt-3 mt-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-2">
                  Connections ({linkedNodes.length})
                </div>
                <div className="flex flex-col gap-1">
                  {linkedNodes.map((ln) => (
                    <button
                      key={ln.id}
                      onClick={() => store.selectNode(ln)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-white/[0.05] transition-colors cursor-pointer bg-transparent border-none text-left"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: NODE_COLORS[ln.type] }}
                      />
                      <span className="text-white/70 truncate">
                        {ln.label}
                      </span>
                      <span className="text-white/25 ml-auto text-[10px]">
                        {ln.type.replace("_", " ")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppWindowChrome>
  );
}
