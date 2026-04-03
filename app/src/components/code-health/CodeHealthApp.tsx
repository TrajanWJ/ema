import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { useSupermanStore } from "@/stores/superman-store";
import type { SupermanGap, SupermanFlow } from "@/stores/superman-store";
import { APP_CONFIGS } from "@/types/workspace";

const config = APP_CONFIGS["code-health"];

const SEVERITY_CONFIG: Record<string, { color: string; bg: string }> = {
  critical: { color: "#EF4444", bg: "rgba(239,68,68,0.15)" },
  high: { color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  medium: { color: "#6b95f0", bg: "rgba(107,149,240,0.15)" },
  low: { color: "var(--pn-text-tertiary)", bg: "rgba(255,255,255,0.06)" },
};

function GapCard({ gap }: { gap: SupermanGap }) {
  const sev = SEVERITY_CONFIG[gap.severity] ?? SEVERITY_CONFIG.low;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: "rgba(14, 16, 23, 0.55)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: 12,
        cursor: "pointer",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{gap.title}</span>
        <span style={{
          fontSize: 10,
          padding: "2px 8px",
          borderRadius: 6,
          background: sev.bg,
          color: sev.color,
          fontWeight: 500,
          textTransform: "uppercase",
        }}>
          {gap.severity}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--pn-text-secondary)", marginBottom: 4 }}>{gap.description}</div>
      {gap.category && (
        <span style={{ fontSize: 10, color: "var(--pn-text-tertiary)", fontFamily: "'JetBrains Mono', monospace" }}>
          {gap.category}
        </span>
      )}
      {expanded && gap.affectedFiles.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 10, color: "var(--pn-text-muted)", marginBottom: 4 }}>Affected files:</div>
          {gap.affectedFiles.map((f) => (
            <div key={f} style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-tertiary)", paddingLeft: 8 }}>
              {f}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FlowCard({ flow }: { flow: SupermanFlow }) {
  return (
    <div style={{
      background: "rgba(14, 16, 23, 0.55)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{flow.name}</span>
        <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-tertiary)" }}>
          {(flow.completeness * 100).toFixed(0)}%
        </span>
      </div>
      {/* Completeness bar */}
      <div style={{ width: "100%", height: 4, borderRadius: 999, background: "rgba(255,255,255,0.06)", marginBottom: 8 }}>
        <div style={{
          height: "100%",
          borderRadius: 999,
          width: `${flow.completeness * 100}%`,
          background: flow.completeness > 0.7 ? "#22C55E" : flow.completeness > 0.4 ? "#f59e0b" : "#EF4444",
        }} />
      </div>
      <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "var(--pn-text-tertiary)", marginBottom: 6 }}>
        Entry: {flow.entryPoint}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {flow.steps.map((step) => (
          <div key={step.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{ color: step.status === "complete" ? "#22C55E" : step.status === "partial" ? "#f59e0b" : "var(--pn-text-muted)" }}>
              {step.status === "complete" ? "\u2713" : step.status === "partial" ? "\u25CB" : "\u2717"}
            </span>
            <span style={{ color: "var(--pn-text-secondary)" }}>{step.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CodeHealthApp() {
  const store = useSupermanStore();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [indexPath, setIndexPath] = useState("");
  const [activeTab, setActiveTab] = useState<"gaps" | "flows">("gaps");

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await store.checkHealth();
        await Promise.all([store.loadGaps(), store.loadFlows()]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load code health");
      }
      if (!cancelled) setReady(true);
      store.connect().catch(() => {
        console.warn("Superman WebSocket failed, using REST");
      });
    }
    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <AppWindowChrome appId="code-health" title={config.title} icon={config.icon} accent={config.accent}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <span style={{ fontSize: 13, color: "var(--pn-text-secondary)" }}>Loading...</span>
        </div>
      </AppWindowChrome>
    );
  }

  const statusColor = store.serverStatus === "connected" ? "#22C55E" : store.serverStatus === "checking" ? "#f59e0b" : "#EF4444";
  const gaps = (store.gaps as { gaps?: SupermanGap[] })?.gaps ?? [];
  const flows = store.flows;

  async function handleIndex() {
    if (!indexPath.trim()) return;
    await store.indexPath(indexPath.trim());
    setIndexPath("");
  }

  return (
    <AppWindowChrome appId="code-health" title={config.title} icon={config.icon} accent={config.accent}>
      <div style={{ padding: 24, color: "var(--pn-text-primary)", height: "100%", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Code Health</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
              display: "inline-block",
            }} />
            <span style={{ fontSize: 11, color: statusColor, textTransform: "capitalize" }}>
              {store.serverStatus}
            </span>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Health status card */}
        <div style={{
          background: "rgba(14, 16, 23, 0.55)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: statusColor,
              boxShadow: `0 0 8px ${statusColor}`,
              display: "inline-block",
            }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>
              Superman Server {store.serverStatus === "connected" ? "Connected" : store.serverStatus === "checking" ? "Checking..." : "Disconnected"}
            </span>
          </div>
          {/* Index repo */}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={indexPath}
              onChange={(e) => setIndexPath(e.target.value)}
              placeholder="Path to repo (e.g., ~/Projects/ema)"
              onKeyDown={(e) => e.key === "Enter" && handleIndex()}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 12,
                color: "var(--pn-text-primary)",
                outline: "none",
              }}
            />
            <button
              onClick={handleIndex}
              disabled={store.indexing || !indexPath.trim()}
              style={{
                fontSize: 12,
                padding: "6px 14px",
                borderRadius: 8,
                background: "rgba(34,197,94,0.15)",
                color: "#22C55E",
                border: "none",
                cursor: store.indexing ? "default" : "pointer",
                opacity: store.indexing || !indexPath.trim() ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {store.indexing ? "Indexing..." : "Index Repo"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {(["gaps", "flows"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                fontSize: 12,
                padding: "6px 16px",
                borderRadius: 6,
                background: activeTab === tab ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
                color: activeTab === tab ? "#22C55E" : "var(--pn-text-secondary)",
                border: activeTab === tab ? "1px solid rgba(34,197,94,0.2)" : "1px solid transparent",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {tab} ({tab === "gaps" ? gaps.length : flows.length})
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "gaps" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {gaps.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--pn-text-muted)", textAlign: "center", padding: 32 }}>
                No gaps found. Index a repository to analyze code health.
              </div>
            ) : (
              gaps.map((gap) => <GapCard key={gap.id} gap={gap} />)
            )}
          </div>
        )}

        {activeTab === "flows" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {flows.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--pn-text-muted)", textAlign: "center", padding: 32 }}>
                No flows found. Index a repository to discover code flows.
              </div>
            ) : (
              flows.map((flow) => <FlowCard key={flow.name} flow={flow} />)
            )}
          </div>
        )}
      </div>
    </AppWindowChrome>
  );
}
