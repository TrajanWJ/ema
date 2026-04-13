import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { APP_CONFIGS } from "@/types/workspace";
import { api } from "@/lib/api";

const cfg = APP_CONFIGS["temporal"];

type Tab = "now" | "rhythm" | "history";

interface TemporalContext { time_of_day: string; recommended_task_type: string; estimated_energy: number; next_peak_in_hours: number | null; }
interface Rhythm { hour: number; avg_energy: number; avg_focus: number; sample_count: number; }
interface EnergyLog { id: string; logged_at: string; energy: number; focus: number | null; activity_type: string | null; }

export function TemporalApp() {
  const [tab, setTab] = useState<Tab>("now");
  const [ctx, setCtx] = useState<TemporalContext | null>(null);
  const [rhythm, setRhythm] = useState<Rhythm[]>([]);
  const [history, setHistory] = useState<EnergyLog[]>([]);
  const [energy, setEnergy] = useState(3);
  const [activity, setActivity] = useState("deep-work");
  const [logging, setLogging] = useState(false);
  const [logMsg, setLogMsg] = useState("");

  useEffect(() => {
    api.get<TemporalContext>("/temporal/now").then(setCtx).catch(() => null);
    if (tab === "rhythm") api.get<Rhythm[]>("/temporal/rhythm").then(setRhythm).catch(() => []);
    if (tab === "history") api.get<EnergyLog[]>("/temporal/history").then(setHistory).catch(() => []);
  }, [tab]);

  const logEnergy = () => {
    setLogging(true);
    api.post("/temporal/log", { energy, activity_type: activity })
      .then(() => setLogMsg("Logged!"))
      .catch(() => setLogMsg("Error"))
      .finally(() => { setLogging(false); setTimeout(() => setLogMsg(""), 2000); });
  };

  const maxEnergy = Math.max(...rhythm.map((r) => r.avg_energy), 1);

  return (
    <AppWindowChrome appId="temporal" title={cfg.title} icon={cfg.icon} accent={cfg.accent}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 2, padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {(["now", "rhythm", "history"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500,
              background: tab === t ? "rgba(249,115,22,0.2)" : "transparent",
              color: tab === t ? "#fdba74" : "rgba(255,255,255,0.55)",
            }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
          {tab === "now" && (
            <div>
              {ctx && (
                <div style={{ marginBottom: 24, padding: 16, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(249,115,22,0.2)" }}>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                    {ctx.time_of_day} · ⚡ {ctx.estimated_energy}/5
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.7 }}>Best for: {ctx.recommended_task_type}</div>
                  {ctx.next_peak_in_hours != null && (
                    <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>Next peak in ~{ctx.next_peak_in_hours}h</div>
                  )}
                </div>
              )}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Log Energy</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, opacity: 0.6, width: 60 }}>Energy: {energy}/5</span>
                  <input type="range" min={1} max={5} value={energy} onChange={(e) => setEnergy(Number(e.target.value))}
                    style={{ flex: 1 }} />
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                  <select value={activity} onChange={(e) => setActivity(e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white", fontSize: 12 }}>
                    {["deep-work", "meetings", "admin", "breaks", "learning"].map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <button onClick={logEnergy} disabled={logging}
                    style={{ padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer", background: "rgba(249,115,22,0.25)", color: "#fdba74", fontSize: 12, fontWeight: 600 }}>
                    {logging ? "…" : "Log"}
                  </button>
                  {logMsg && <span style={{ fontSize: 12, color: "#22c55e" }}>{logMsg}</span>}
                </div>
              </div>
            </div>
          )}
          {tab === "rhythm" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Daily Energy Pattern</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120, marginBottom: 16 }}>
                {Array.from({ length: 24 }, (_, h) => {
                  const r = rhythm.find((x) => x.hour === h);
                  const height = r ? Math.max(4, (r.avg_energy / maxEnergy) * 100) : 4;
                  const color = r ? (r.avg_focus > 3.5 ? "#22c55e" : r.avg_focus > 2.5 ? "#f59e0b" : "#ef4444") : "rgba(255,255,255,0.1)";
                  return (
                    <div key={h} title={`${h}:00 — energy: ${r?.avg_energy?.toFixed(1) ?? "—"}`}
                      style={{ flex: 1, height: `${height}%`, background: color, borderRadius: 2, opacity: r ? 0.9 : 0.3 }} />
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.4, marginBottom: 16 }}>
                <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
              </div>
            </div>
          )}
          {tab === "history" && (
            <div>
              {history.length === 0 && <div style={{ opacity: 0.5, fontSize: 13 }}>No history yet. Log your first energy reading in the Now tab.</div>}
              {history.map((e) => (
                <div key={e.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 12, fontSize: 12 }}>
                  <span style={{ opacity: 0.5, width: 100, flexShrink: 0 }}>{new Date(e.logged_at).toLocaleString()}</span>
                  <span>{"★".repeat(e.energy)}{"☆".repeat(5 - e.energy)}</span>
                  <span style={{ opacity: 0.6 }}>{e.activity_type ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}
