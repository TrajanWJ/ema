import { useEffect } from "react";
import { useVaultStore } from "@/stores/vault-store";

export function VaultGraph() {
  const graph = useVaultStore((s) => s.graph);
  const loadGraph = useVaultStore((s) => s.loadGraph);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const nodeCount = graph?.nodes.length ?? 0;
  const edgeCount = graph?.edges.length ?? 0;

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div
        className="glass-surface rounded-lg p-6 text-center"
        style={{ maxWidth: "400px" }}
      >
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
          &#9670;
        </div>
        <h3
          className="text-[0.875rem] font-medium mb-2"
          style={{ color: "var(--pn-text-primary)" }}
        >
          Graph Visualization
        </h3>
        <p className="text-[0.75rem] mb-4" style={{ color: "var(--pn-text-tertiary)" }}>
          Interactive force-directed graph coming soon
        </p>
        <div className="flex justify-center gap-6">
          <div>
            <div
              className="text-[1.2rem] font-semibold"
              style={{ color: "#2dd4a8" }}
            >
              {nodeCount}
            </div>
            <div className="text-[0.6rem] uppercase tracking-wider" style={{ color: "var(--pn-text-tertiary)" }}>
              Nodes
            </div>
          </div>
          <div>
            <div
              className="text-[1.2rem] font-semibold"
              style={{ color: "#6b95f0" }}
            >
              {edgeCount}
            </div>
            <div className="text-[0.6rem] uppercase tracking-wider" style={{ color: "var(--pn-text-tertiary)" }}>
              Edges
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
