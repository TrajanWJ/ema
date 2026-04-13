import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";

type Tab = "all" | "executions" | "proposals";

interface Execution {
  id: string;
  mode: string;
  status: string;
  intent_title?: string;
  inserted_at: string;
}

interface Proposal {
  id: string;
  title: string;
  status: string;
  inserted_at: string;
}

interface StreamItem {
  id: string;
  type: "execution" | "proposal";
  title: string;
  status: string;
  timestamp: string;
  meta?: string;
}

function merge(executions: Execution[], proposals: Proposal[]): StreamItem[] {
  const items: StreamItem[] = [
    ...executions.map((e): StreamItem => ({
      id: e.id,
      type: "execution",
      title: e.intent_title ?? `Execution ${e.id.slice(0, 8)}`,
      status: e.status,
      timestamp: e.inserted_at,
      meta: e.mode,
    })),
    ...proposals.map((p): StreamItem => ({
      id: p.id,
      type: "proposal",
      title: p.title,
      status: p.status,
      timestamp: p.inserted_at,
      meta: undefined,
    })),
  ];
  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return items;
}

const STATUS_COLORS: Record<string, string> = {
  running: "#22c55e",
  completed: "#6b95f0",
  failed: "#ef4444",
  queued: "#f59e0b",
  approved: "#2dd4a8",
  killed: "#ef4444",
  generated: "#6b95f0",
  pending_approval: "#f59e0b",
  revised: "#8b5cf6",
  superseded: "#8b5cf6",
  rejected: "#ef4444",
};

export function AgentStreamApp() {
  const [tab, setTab] = useState<Tab>("all");
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<{ executions: Execution[] }>("/executions").catch((): { executions: Execution[] } => ({ executions: [] })),
      api.get<{ proposals: Proposal[] }>("/proposals").catch((): { proposals: Proposal[] } => ({ proposals: [] })),
    ]).then(([ex, pr]) => {
      setExecutions(ex.executions ?? []);
      setProposals(pr.proposals ?? []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const items = tab === "executions"
    ? merge(executions, [])
    : tab === "proposals"
      ? merge([], proposals)
      : merge(executions, proposals);

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "executions", label: "Executions" },
    { key: "proposals", label: "Proposals" },
  ];

  return (
    <AppWindowChrome appId="agent-stream" title="Agent Stream" icon="📡" accent="#E8A838">
      <div style={{ padding: "16px 20px", overflowY: "auto", height: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: tab === t.key ? "rgba(232,168,56,0.15)" : "rgba(255,255,255,0.05)",
                  color: tab === t.key ? "#E8A838" : "rgba(255,255,255,0.5)",
                  fontSize: 12,
                  fontWeight: tab === t.key ? 600 : 400,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            style={{ padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {items.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.4, textAlign: "center", marginTop: 40 }}>No items yet.</div>
        ) : items.map((item) => (
          <div key={`${item.type}-${item.id}`}
            style={{ display: "flex", gap: 10, padding: "10px 12px", marginBottom: 6, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
              background: STATUS_COLORS[item.status] ?? "rgba(255,255,255,0.3)",
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.87)" }}>{item.title}</div>
              <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>
                {item.type} · {item.status}{item.meta ? ` · ${item.meta}` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppWindowChrome>
  );
}
