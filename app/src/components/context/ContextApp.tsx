import { useEffect, useState } from "react";
import { AppWindowChrome } from "@/components/layout/AppWindowChrome";
import { api } from "@/lib/api";

type Tab = "summary" | "sessions" | "crystallize";

export function ContextApp() {
  const [tab, setTab] = useState<Tab>("summary");
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [crystallizing, setCrystallizing] = useState(false);
  const [crystallizeResult, setCrystallizeResult] = useState<string>("");

  useEffect(() => {
    if (tab === "summary") {
      setLoading(true);
      api.get<{ summary: string }>("/context/executive-summary")
        .then((d) => setSummary(d.summary ?? ""))
        .catch(() => setSummary("Could not load summary."))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  const tabs: Tab[] = ["summary", "sessions", "crystallize"];

  return (
    <AppWindowChrome appId="context" title="Context">
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 2, padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500,
              background: tab === t ? "rgba(139,92,246,0.25)" : "transparent",
              color: tab === t ? "#c4b5fd" : "rgba(255,255,255,0.55)",
            }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
          {tab === "summary" && (
            loading ? <div style={{ opacity: 0.5 }}>Loading…</div> :
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6, opacity: 0.87 }}>{summary || "No summary available."}</pre>
          )}
          {tab === "sessions" && (
            <div style={{ fontSize: 13, opacity: 0.6 }}>Session context links — see Claude Bridge for full session history.</div>
          )}
          {tab === "crystallize" && (
            <div>
              <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
                Crystallize compresses current session context into a persistent executive summary.
              </p>
              <button
                onClick={() => {
                  setCrystallizing(true);
                  setCrystallizeResult("");
                  api.post<{ result: string }>("/context/crystallize", {})
                    .then((d) => setCrystallizeResult(d.result ?? "Done"))
                    .catch(() => setCrystallizeResult("Error during crystallization"))
                    .finally(() => setCrystallizing(false));
                }}
                disabled={crystallizing}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "none", cursor: crystallizing ? "not-allowed" : "pointer",
                  background: "rgba(139,92,246,0.25)", color: "#c4b5fd", fontSize: 13, fontWeight: 600,
                }}
              >
                {crystallizing ? "Crystallizing…" : "Crystallize Now"}
              </button>
              {crystallizeResult && (
                <pre style={{ marginTop: 16, whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.8 }}>{crystallizeResult}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </AppWindowChrome>
  );
}
