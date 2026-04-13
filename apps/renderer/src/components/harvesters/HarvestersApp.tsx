import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { APP_CONFIGS } from "@/types/workspace";
import { api } from "@/lib/api";

const cfg = APP_CONFIGS["harvesters"];

interface Harvester { name: string; last_run_at: string | null; status: string; items_count: number; }
interface HarvestItem { id: string; harvester: string; title: string; created_at: string; }

export function HarvestersApp() {
  const [harvesters, setHarvesters] = useState<Harvester[]>([]);
  const [recent, setRecent] = useState<HarvestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Harvester[]>("/harvesters").catch((): Harvester[] => []),
      api.get<HarvestItem[]>("/harvesters/recent").catch((): HarvestItem[] => []),
    ]).then(([h, r]) => { setHarvesters(h); setRecent(r); }).finally(() => setLoading(false));
  }, []);

  const runHarvester = (name: string) => {
    setRunning(name);
    api.post(`/harvesters/${name}/run`, {})
      .then(() => setHarvesters((prev) => prev.map((h) => h.name === name ? { ...h, status: "idle", last_run_at: new Date().toISOString() } : h)))
      .finally(() => setRunning(null));
  };

  return (
    <AppWindowChrome appId="harvesters" title={cfg.title} icon={cfg.icon} accent={cfg.accent}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
          {loading && <div style={{ opacity: 0.5, fontSize: 13 }}>Loading…</div>}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, opacity: 0.7 }}>Harvesters</div>
            {harvesters.map((h) => (
              <div key={h.name} style={{ display: "flex", alignItems: "center", padding: "10px 14px", marginBottom: 6, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: h.status === "running" ? "#22c55e" : h.status === "failed" ? "#ef4444" : "rgba(255,255,255,0.3)", marginRight: 10, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{h.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.45 }}>{h.items_count ?? 0} items · {h.last_run_at ? new Date(h.last_run_at).toLocaleString() : "never run"}</div>
                </div>
                <button onClick={() => runHarvester(h.name)} disabled={running === h.name}
                  style={{ padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(16,185,129,0.2)", color: "#6ee7b7", fontSize: 11 }}>
                  {running === h.name ? "…" : "Run"}
                </button>
              </div>
            ))}
            {harvesters.length === 0 && !loading && <div style={{ fontSize: 12, opacity: 0.5 }}>No harvesters configured.</div>}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, opacity: 0.7 }}>Recent Harvests</div>
            {recent.slice(0, 20).map((r) => (
              <div key={r.id} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
                <span style={{ opacity: 0.4, width: 80, flexShrink: 0 }}>{r.harvester}</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.8 }}>{r.title}</span>
                <span style={{ opacity: 0.35, flexShrink: 0 }}>{new Date(r.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppWindowChrome>
  );
}
