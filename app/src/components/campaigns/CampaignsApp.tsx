import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";

interface Campaign { id: string; name: string; goal: string; status: string; execution_count: number; completion_pct: number; last_run_at: string | null; }

export function CampaignsApp() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Campaign[]>("/campaigns").then(setCampaigns).catch(() => []).finally(() => setLoading(false));
  }, []);

  const statusColor = (s: string) => s === "active" ? "#22c55e" : s === "paused" ? "#f59e0b" : "rgba(255,255,255,0.4)";

  return (
    <AppWindowChrome appId="campaigns" title="Campaigns">
      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
        <div style={{ width: 280, borderRight: "1px solid rgba(255,255,255,0.08)", overflowY: "auto" }}>
          {loading && <div style={{ padding: 16, opacity: 0.5, fontSize: 13 }}>Loading…</div>}
          {campaigns.map((c) => (
            <div key={c.id} onClick={() => setSelected(c)} style={{
              padding: "12px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)",
              background: selected?.id === c.id ? "rgba(255,255,255,0.07)" : "transparent",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                <span style={{ fontSize: 11, color: statusColor(c.status) }}>{c.status}</span>
              </div>
              <div style={{ fontSize: 11, opacity: 0.5 }}>{c.execution_count} executions · {c.completion_pct}%</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
          {selected ? (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{selected.name}</div>
              <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 16 }}>{selected.goal}</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                <button onClick={() => api.post(`/campaigns/${selected.id}/advance`, {}).then(() => { setSelected({ ...selected, status: "active" }); })}
                  style={{ padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(34,197,94,0.2)", color: "#86efac", fontSize: 12 }}>
                  Start
                </button>
                <button onClick={() => api.post(`/campaigns/${selected.id}/advance`, {}).then(() => { setSelected({ ...selected, status: "paused" }); })}
                  style={{ padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(245,158,11,0.2)", color: "#fde68a", fontSize: 12 }}>
                  Pause
                </button>
              </div>
              <div style={{ fontSize: 12, opacity: 0.5 }}>{selected.execution_count} executions · {selected.completion_pct}% complete</div>
            </div>
          ) : (
            <div style={{ opacity: 0.4, fontSize: 13, marginTop: 40, textAlign: "center" }}>Select a campaign</div>
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}
