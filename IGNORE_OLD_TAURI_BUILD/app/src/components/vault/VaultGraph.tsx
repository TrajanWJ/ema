import { useEffect, useState, useRef, useCallback } from "react";
import { useVaultStore } from "@/stores/vault-store";
import { EDGE_TYPES, EDGE_TYPE_CONFIG } from "@/types/vault";
import type { EdgeType, VaultLink, VaultNote } from "@/types/vault";

interface NodePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
  note: VaultNote;
}

export function VaultGraph() {
  const graph = useVaultStore((s) => s.graph);
  const [enabledTypes, setEnabledTypes] = useState<Set<EdgeType>>(
    () => new Set(EDGE_TYPES)
  );
  const [hoveredEdge, setHoveredEdge] = useState<VaultLink | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<NodePosition[]>([]);
  const animRef = useRef<number>(0);
  const dragRef = useRef<{ nodeIdx: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    useVaultStore.getState().loadGraph();
  }, []);

  const filteredEdges = graph?.edges.filter((e) => enabledTypes.has(e.edge_type)) ?? [];
  const nodeCount = graph?.nodes.length ?? 0;
  const edgeCount = filteredEdges.length;

  // Initialize node positions
  useEffect(() => {
    if (!graph?.nodes.length) return;

    const cx = 400;
    const cy = 300;
    nodesRef.current = graph.nodes.map((note, i) => {
      const angle = (i / graph.nodes.length) * Math.PI * 2;
      const r = 120 + Math.random() * 100;
      return {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        note,
      };
    });
  }, [graph?.nodes]);

  const findNodeAt = useCallback((mx: number, my: number): number => {
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i];
      const dx = mx - n.x;
      const dy = my - n.y;
      if (dx * dx + dy * dy < 64) return i;
    }
    return -1;
  }, []);

  const findEdgeAt = useCallback(
    (mx: number, my: number): VaultLink | null => {
      if (!graph) return null;
      const nodeMap = new Map(nodesRef.current.map((n) => [n.note.id, n]));

      for (const edge of filteredEdges) {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) continue;

        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) continue;

        const param = Math.max(0, Math.min(1, ((mx - s.x) * dx + (my - s.y) * dy) / len2));
        const px = s.x + param * dx;
        const py = s.y + param * dy;
        const dist2 = (mx - px) * (mx - px) + (my - py) * (my - py);
        if (dist2 < 25) return edge;
      }
      return null;
    },
    [graph, filteredEdges]
  );

  // Force simulation + render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graph?.nodes.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nodes = nodesRef.current;
    const nodeMap = new Map(nodes.map((n, i) => [n.note.id, i]));

    function tick() {
      const W = canvas!.width;
      const H = canvas!.height;

      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let dx = nodes[j].x - nodes[i].x;
          let dy = nodes[j].y - nodes[i].y;
          const d2 = dx * dx + dy * dy + 1;
          const force = 800 / d2;
          dx *= force;
          dy *= force;
          nodes[i].vx -= dx;
          nodes[i].vy -= dy;
          nodes[j].vx += dx;
          nodes[j].vy += dy;
        }
      }

      // Attraction along edges
      for (const edge of filteredEdges) {
        const si = nodeMap.get(edge.source);
        const ti = nodeMap.get(edge.target);
        if (si === undefined || ti === undefined) continue;
        const dx = nodes[ti].x - nodes[si].x;
        const dy = nodes[ti].y - nodes[si].y;
        const d = Math.sqrt(dx * dx + dy * dy) + 1;
        const force = (d - 100) * 0.005;
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        nodes[si].vx += fx;
        nodes[si].vy += fy;
        nodes[ti].vx -= fx;
        nodes[ti].vy -= fy;
      }

      // Center gravity
      for (const n of nodes) {
        n.vx += (W / 2 - n.x) * 0.001;
        n.vy += (H / 2 - n.y) * 0.001;
      }

      // Apply velocity with damping
      for (const n of nodes) {
        if (dragRef.current && nodes[dragRef.current.nodeIdx] === n) continue;
        n.vx *= 0.9;
        n.vy *= 0.9;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(8, Math.min(W - 8, n.x));
        n.y = Math.max(8, Math.min(H - 8, n.y));
      }

      // Draw
      ctx!.clearRect(0, 0, W, H);

      // Edges
      for (const edge of filteredEdges) {
        const si = nodeMap.get(edge.source);
        const ti = nodeMap.get(edge.target);
        if (si === undefined || ti === undefined) continue;
        const config = EDGE_TYPE_CONFIG[edge.edge_type] ?? EDGE_TYPE_CONFIG["references"];
        const isHovered = hoveredEdge?.id === edge.id;

        ctx!.beginPath();
        ctx!.moveTo(nodes[si].x, nodes[si].y);
        ctx!.lineTo(nodes[ti].x, nodes[ti].y);
        ctx!.strokeStyle = config.color;
        ctx!.lineWidth = isHovered ? 2.5 : 1;
        ctx!.globalAlpha = isHovered ? 1 : 0.5;
        ctx!.stroke();
        ctx!.globalAlpha = 1;

        // Edge label on hover
        if (isHovered) {
          const mx = (nodes[si].x + nodes[ti].x) / 2;
          const my = (nodes[si].y + nodes[ti].y) / 2;
          ctx!.font = "10px system-ui";
          ctx!.fillStyle = config.color;
          ctx!.textAlign = "center";
          ctx!.fillText(edge.edge_type, mx, my - 6);
        }
      }

      // Nodes
      for (const n of nodes) {
        const isHovered = hoveredNode === n.note.id;
        const radius = isHovered ? 7 : 5;

        ctx!.beginPath();
        ctx!.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx!.fillStyle = isHovered ? "#2dd4a8" : "#6b95f0";
        ctx!.fill();
        ctx!.strokeStyle = "rgba(255,255,255,0.2)";
        ctx!.lineWidth = 1;
        ctx!.stroke();

        if (isHovered && n.note.title) {
          ctx!.font = "11px system-ui";
          ctx!.fillStyle = "rgba(255,255,255,0.87)";
          ctx!.textAlign = "center";
          ctx!.fillText(n.note.title, n.x, n.y - 12);
        }
      }

      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [graph, filteredEdges, hoveredEdge, hoveredNode]);

  // Canvas interaction handlers
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (dragRef.current) {
        const n = nodesRef.current[dragRef.current.nodeIdx];
        n.x = mx - dragRef.current.offsetX;
        n.y = my - dragRef.current.offsetY;
        return;
      }

      const nodeIdx = findNodeAt(mx, my);
      setHoveredNode(nodeIdx >= 0 ? nodesRef.current[nodeIdx].note.id : null);

      if (nodeIdx < 0) {
        setHoveredEdge(findEdgeAt(mx, my));
      } else {
        setHoveredEdge(null);
      }
    },
    [findNodeAt, findEdgeAt]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const idx = findNodeAt(mx, my);
      if (idx >= 0) {
        dragRef.current = {
          nodeIdx: idx,
          offsetX: mx - nodesRef.current[idx].x,
          offsetY: my - nodesRef.current[idx].y,
        };
      }
    },
    [findNodeAt]
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  function toggleType(type: EdgeType) {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  if (!graph || nodeCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="glass-surface rounded-lg p-6 text-center" style={{ maxWidth: "400px" }}>
          <h3 className="text-[0.875rem] font-medium mb-2" style={{ color: "var(--pn-text-primary)" }}>
            Graph Visualization
          </h3>
          <p className="text-[0.75rem]" style={{ color: "var(--pn-text-tertiary)" }}>
            No notes in vault yet
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 h-full">
      {/* Graph canvas */}
      <div className="flex-1 min-w-0 rounded-lg overflow-hidden" style={{ border: "1px solid var(--pn-border-subtle)" }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          style={{ width: "100%", height: "100%", background: "rgba(6,6,16,0.6)", cursor: dragRef.current ? "grabbing" : "default" }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* Legend sidebar */}
      <div
        className="shrink-0 rounded-lg p-3 overflow-auto"
        style={{
          width: "180px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--pn-border-subtle)",
        }}
      >
        <div className="text-[0.7rem] font-medium mb-3" style={{ color: "var(--pn-text-secondary)" }}>
          Edge Types
        </div>

        <div className="flex flex-col gap-1.5">
          {EDGE_TYPES.map((type) => {
            const config = EDGE_TYPE_CONFIG[type];
            const count = graph.edges.filter((e) => e.edge_type === type).length;
            if (count === 0) return null;

            return (
              <label
                key={type}
                className="flex items-center gap-2 cursor-pointer rounded px-1.5 py-1 transition-colors"
                style={{ background: enabledTypes.has(type) ? "rgba(255,255,255,0.04)" : "transparent" }}
              >
                <input
                  type="checkbox"
                  checked={enabledTypes.has(type)}
                  onChange={() => toggleType(type)}
                  className="sr-only"
                />
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 transition-opacity"
                  style={{
                    background: config.color,
                    opacity: enabledTypes.has(type) ? 1 : 0.3,
                  }}
                />
                <span
                  className="text-[0.65rem] flex-1 truncate"
                  style={{ color: enabledTypes.has(type) ? "var(--pn-text-primary)" : "var(--pn-text-muted)" }}
                >
                  {config.label}
                </span>
                <span className="text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
                  {count}
                </span>
              </label>
            );
          })}
        </div>

        <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--pn-border-subtle)" }}>
          <div className="flex justify-between text-[0.6rem]" style={{ color: "var(--pn-text-tertiary)" }}>
            <span>{nodeCount} nodes</span>
            <span>{edgeCount} edges</span>
          </div>
        </div>
      </div>
    </div>
  );
}
